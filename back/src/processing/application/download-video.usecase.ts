import { JobStatus } from "../../jobs/domain/job-status.js";
import { artifactTtlSeconds } from "../../jobs/domain/cache-artifact.entity.js";
import type { IJobRepository } from "../../jobs/application/ports/job.repository.js";
import type { IArtifactRepository } from "../../jobs/application/ports/artifact.repository.js";
import type { IStoragePort } from "../../jobs/application/ports/storage.port.js";
import type { IDownloaderPort } from "./ports/downloader.port.js";
import type { INotifyJobUpdateUseCase } from "../../notifications/application/notify-job-update.usecase.js";
import { artifactPk, artifactSk } from "../../shared/table-keys.js";
import { ulid } from "ulidx";

export class DownloadVideoUseCase {
  constructor(
    private readonly jobRepo: IJobRepository,
    private readonly artifactRepo: IArtifactRepository,
    private readonly downloader: IDownloaderPort,
    private readonly storage: IStoragePort,
    private readonly notifier: INotifyJobUpdateUseCase,
  ) {}

  /**
   * Returns `true` when the job was fully processed, `false` when the lock
   * could not be acquired (another worker is already downloading the same video).
   * Callers should treat `false` as a retriable failure (add to SQS batchItemFailures).
   */
  async execute(jobId: string, tiktokUrl: string, videoId: string, format: "mp4" | "mp3"): Promise<boolean> {
    // (1) Acquire lock — return false if concurrent worker holds it
    const acquired = await this.jobRepo.acquireLock(videoId, jobId);
    if (!acquired) {
      return false;
    }

    try {
      // (2) Update status to downloading
      await this.jobRepo.updateStatus(jobId, JobStatus.downloading);

      // (3) Download via yt-dlp
      const result = await this.downloader.downloadVideo(tiktokUrl, "/tmp");

      // (4) Upload to S3
      const s3Key = `originals/${videoId}/${videoId}.mp4`;
      const fileSizeBytes = await this.storage.upload(s3Key, result.localPath, "video/mp4");

      // (5) Write CacheArtifact
      const now = new Date().toISOString();
      const ttlSec = artifactTtlSeconds("mp4", "original");
      await this.artifactRepo.save({
        pk: artifactPk(videoId),
        sk: artifactSk("mp4", "original"),
        type: "ARTIFACT",
        videoId,
        tiktokUrl,
        format: "mp4",
        artifactType: "original",
        s3Key,
        fileSizeBytes,
        duration: result.videoInfo.duration,
        title: result.videoInfo.title,
        thumbnailUrl: result.videoInfo.thumbnailUrl ?? undefined,
        downloadCount: 0,
        createdAt: now,
        expiresAt: Math.floor(Date.now() / 1000) + ttlSec,
      });

      // (6) Update job to ready
      await this.jobRepo.updateStatus(jobId, JobStatus.ready, {
        s3Key,
        videoId,
        title: result.videoInfo.title,
        duration: result.videoInfo.duration,
        thumbnailUrl: result.videoInfo.thumbnailUrl ?? undefined,
      });

      // (7) Release lock
      await this.jobRepo.releaseLock(videoId);

      // (8) Notify WS subscribers
      await this.notifier.execute(jobId);
      return true;
    } catch (err) {
      // Always attempt lock release on error
      await this.jobRepo.releaseLock(videoId).catch(() => { /* best-effort */ });
      throw err;
    }
  }
}
