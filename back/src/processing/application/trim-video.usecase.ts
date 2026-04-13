import { JobStatus } from "../../jobs/domain/job-status.js";
import { artifactTtlSeconds } from "../../jobs/domain/cache-artifact.entity.js";
import { artifactPk, artifactSk } from "../../shared/table-keys.js";
import type { IJobRepository } from "../../jobs/application/ports/job.repository.js";
import type { IArtifactRepository } from "../../jobs/application/ports/artifact.repository.js";
import type { IStoragePort } from "../../jobs/application/ports/storage.port.js";
import type { ITranscoderPort } from "./ports/transcoder.port.js";
import type { INotifyJobUpdateUseCase } from "../../notifications/application/notify-job-update.usecase.js";
import { join } from "node:path";

export class TrimVideoUseCase {
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
    const localIn = join("/tmp", `${videoId}_orig.mp4`);
    const localOut = join("/tmp", `${jobId}_trim.mp4`);

    // (1) Download original from S3
    await this.storage.download(s3Key, localIn);

    // (2) Trim via ffmpeg
    await this.transcoder.trim(localIn, localOut, trimStart, trimEnd);

    // (3) Upload to S3
    const outKey = `trims/${videoId}/${jobId}.mp4`;
    const fileSizeBytes = await this.storage.upload(outKey, localOut, "video/mp4");

    // (4) Write CacheArtifact (format:mp4, type:trim, expiresAt +1d)
    const now = new Date().toISOString();
    const ttlSec = artifactTtlSeconds("mp4", "trim");
    await this.artifactRepo.save({
      pk: artifactPk(videoId),
      sk: artifactSk("mp4", "trim", trimStart, trimEnd),
      type: "ARTIFACT",
      videoId,
      tiktokUrl: "",
      format: "mp4",
      artifactType: "trim",
      s3Key: outKey,
      fileSizeBytes,
      trimStart,
      trimEnd,
      downloadCount: 0,
      createdAt: now,
      expiresAt: Math.floor(Date.now() / 1000) + ttlSec,
    });

    // (5) Update job to trimmed
    await this.jobRepo.updateStatus(jobId, JobStatus.trimmed, { s3Key: outKey, trimStart, trimEnd });

    // (6) Notify WS subscribers
    await this.notifier.execute(jobId);
  }
}
