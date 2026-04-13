import { JobStatus } from "../domain/job-status.js";
import { jobNotFound, jobNotReady, invalidTrimRange } from "../../shared/errors.js";
import type { IJobRepository } from "./ports/job.repository.js";
import type { IArtifactRepository } from "./ports/artifact.repository.js";
import type { IJobQueuePort } from "./ports/job-queue.port.js";
import type { IStoragePort } from "./ports/storage.port.js";

export interface RequestTrimResult {
  hit: boolean;
  downloadUrl?: string;
}

export class RequestTrimUseCase {
  constructor(
    private readonly jobRepo: IJobRepository,
    private readonly artifactRepo: IArtifactRepository,
    private readonly queuePort: IJobQueuePort,
    private readonly storage: IStoragePort,
  ) {}

  async execute(jobId: string, trimStart: number, trimEnd: number): Promise<RequestTrimResult> {
    const job = await this.jobRepo.findById(jobId);
    if (!job) throw jobNotFound();
    if (job.status !== JobStatus.ready) throw jobNotReady();
    if (trimStart >= trimEnd || (job.duration !== undefined && trimEnd > job.duration)) {
      throw invalidTrimRange();
    }

    const videoId = job.videoId ?? jobId;

    // Check cache
    const artifact = await this.artifactRepo.findByKey(videoId, "mp4", "trim", trimStart, trimEnd);
    if (artifact) {
      const exists = await this.storage.objectExists(artifact.s3Key);
      if (exists) {
        const downloadUrl = await this.storage.generatePresignedUrl(artifact.s3Key, 3600);
        await this.jobRepo.updateStatus(jobId, JobStatus.trimmed, {
          s3Key: artifact.s3Key,
          trimStart,
          trimEnd,
        });
        return { hit: true, downloadUrl };
      }
    }

    // Cache miss — enqueue
    await this.jobRepo.updateStatus(jobId, JobStatus.trimming);
    await this.queuePort.enqueueTrim({ jobId, videoId, trimStart, trimEnd });
    return { hit: false };
  }
}
