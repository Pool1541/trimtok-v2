import { JobStatus } from "../../jobs/domain/job-status.js";
import { artifactTtlSeconds } from "../../jobs/domain/cache-artifact.entity.js";
import { artifactPk, artifactSk } from "../../shared/table-keys.js";
import type { IJobRepository } from "../../jobs/application/ports/job.repository.js";
import type { IArtifactRepository } from "../../jobs/application/ports/artifact.repository.js";
import type { IStoragePort } from "../../jobs/application/ports/storage.port.js";
import type { ITranscoderPort } from "./ports/transcoder.port.js";
import type { INotifyJobUpdateUseCase } from "../../notifications/application/notify-job-update.usecase.js";
import { join } from "node:path";

export class ExtractMp3UseCase {
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
    trimStart?: number,
    trimEnd?: number,
  ): Promise<void> {
    const localIn = join("/tmp", `${videoId}_orig_mp3.mp4`);

    const hasRange = trimStart !== undefined && trimEnd !== undefined;
    const localOut = join("/tmp", `${jobId}.mp3`);

    // Download original from S3
    await this.storage.download(s3Key, localIn);

    // Extract MP3 via ffmpeg
    await this.transcoder.extractMp3(localIn, localOut, trimStart, trimEnd);

    // Determine S3 key based on range
    const outKey = hasRange
      ? `mp3s/trims/${videoId}/${jobId}.mp3`
      : `mp3s/originals/${videoId}/${videoId}.mp3`;

    const artifactType = hasRange ? "trim" : "original";
    const fileSizeBytes = await this.storage.upload(outKey, localOut, "audio/mpeg");

    // Write CacheArtifact
    const now = new Date().toISOString();
    const ttlSec = artifactTtlSeconds("mp3", artifactType);
    await this.artifactRepo.save({
      pk: artifactPk(videoId),
      sk: artifactSk("mp3", artifactType, trimStart, trimEnd),
      type: "ARTIFACT",
      videoId,
      tiktokUrl: "",
      format: "mp3",
      artifactType,
      s3Key: outKey,
      fileSizeBytes,
      trimStart,
      trimEnd,
      downloadCount: 0,
      createdAt: now,
      expiresAt: Math.floor(Date.now() / 1000) + ttlSec,
    });

    // Update job to mp3_ready
    await this.jobRepo.updateStatus(jobId, JobStatus.mp3_ready, { s3Key: outKey });

    // Notify WS subscribers
    await this.notifier.execute(jobId);
  }
}
