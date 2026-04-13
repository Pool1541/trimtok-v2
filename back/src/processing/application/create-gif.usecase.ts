import { JobStatus } from "../../jobs/domain/job-status.js";
import { artifactTtlSeconds } from "../../jobs/domain/cache-artifact.entity.js";
import { artifactPk, artifactSk } from "../../shared/table-keys.js";
import type { IJobRepository } from "../../jobs/application/ports/job.repository.js";
import type { IArtifactRepository } from "../../jobs/application/ports/artifact.repository.js";
import type { IStoragePort } from "../../jobs/application/ports/storage.port.js";
import type { ITranscoderPort } from "./ports/transcoder.port.js";
import type { INotifyJobUpdateUseCase } from "../../notifications/application/notify-job-update.usecase.js";
import { join } from "node:path";

export class CreateGifUseCase {
  constructor(
    private readonly jobRepo: IJobRepository,
    private readonly artifactRepo: IArtifactRepository,
    private readonly transcoder: ITranscoderPort,
    private readonly storage: IStoragePort,
    private readonly notifier: INotifyJobUpdateUseCase,
  ) {}

  async execute(
    jobId: string,
    videoId: string,
    s3Key: string,
    trimStart: number,
    trimEnd: number,
  ): Promise<void> {
    const localIn = join("/tmp", `${videoId}_orig_gif.mp4`);
    const localOut = join("/tmp", `${jobId}_gif.mp4`);

    // Download original from S3
    await this.storage.download(s3Key, localIn);

    // Create silent looping MP4 (H.264/baseline) via ffmpeg — browser-compatible
    await this.transcoder.createGif(localIn, localOut, trimStart, trimEnd);

    // Upload to S3
    const outKey = `gifs/${videoId}/${jobId}.mp4`;
    const fileSizeBytes = await this.storage.upload(outKey, localOut, "video/mp4");

    // Write CacheArtifact
    const now = new Date().toISOString();
    const ttlSec = artifactTtlSeconds("gif", "gif");
    await this.artifactRepo.save({
      pk: artifactPk(videoId),
      sk: artifactSk("gif", "gif", trimStart, trimEnd),
      type: "ARTIFACT",
      videoId,
      tiktokUrl: "",
      format: "gif",
      artifactType: "gif",
      s3Key: outKey,
      fileSizeBytes,
      trimStart,
      trimEnd,
      downloadCount: 0,
      createdAt: now,
      expiresAt: Math.floor(Date.now() / 1000) + ttlSec,
    });

    // Update job to gif_created
    await this.jobRepo.updateStatus(jobId, JobStatus.gif_created, { s3Key: outKey });

    // Notify WS subscribers
    await this.notifier.execute(jobId);
  }
}
