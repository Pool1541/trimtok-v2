import { JobStatus } from "../domain/job-status.js";
import { jobNotFound, jobNotReady } from "../../shared/errors.js";
import type { IJobRepository } from "./ports/job.repository.js";
import type { IArtifactRepository } from "./ports/artifact.repository.js";
import type { IJobQueuePort } from "./ports/job-queue.port.js";
import type { IStoragePort } from "./ports/storage.port.js";

const GIF_READY_STATUSES: ReadonlySet<string> = new Set([JobStatus.ready, JobStatus.trimmed]);
const DEFAULT_GIF_DURATION = 10;

export interface RequestGifResult {
  hit: boolean;
  downloadUrl?: string;
}

export class RequestGifUseCase {
  constructor(
    private readonly jobRepo: IJobRepository,
    private readonly artifactRepo: IArtifactRepository,
    private readonly queuePort: IJobQueuePort,
    private readonly storage: IStoragePort,
  ) {}

  async execute(
    jobId: string,
    trimStart?: number,
    trimEnd?: number,
  ): Promise<RequestGifResult> {
    const job = await this.jobRepo.findById(jobId);
    if (!job) throw jobNotFound();
    if (!GIF_READY_STATUSES.has(job.status)) throw jobNotReady();

    const videoId = job.videoId ?? jobId;
    const start = trimStart ?? 0;
    const end = trimEnd ?? Math.min(DEFAULT_GIF_DURATION, job.duration ?? DEFAULT_GIF_DURATION);

    // Check cache
    const artifact = await this.artifactRepo.findByKey(videoId, "gif", "gif", start, end);
    if (artifact) {
      const exists = await this.storage.objectExists(artifact.s3Key);
      if (exists) {
        const downloadUrl = await this.storage.generatePresignedUrl(artifact.s3Key, 3600);
        await this.jobRepo.updateStatus(jobId, JobStatus.gif_created, { s3Key: artifact.s3Key });
        return { hit: true, downloadUrl };
      }
    }

    // Cache miss — enqueue
    await this.jobRepo.updateStatus(jobId, JobStatus.creating_gif);
    await this.queuePort.enqueueGif({ jobId, videoId, trimStart: start, trimEnd: end });
    return { hit: false };
  }
}
