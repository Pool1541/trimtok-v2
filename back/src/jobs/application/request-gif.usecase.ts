import { createJob } from "../domain/job.entity.js";
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
  /** jobId del job hijo creado para este proceso de GIF (presente sólo en cache miss) */
  childJobId?: string;
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

    // Check cache — no se muta el job original
    const artifact = await this.artifactRepo.findByKey(videoId, "gif", "gif", start, end);
    if (artifact) {
      const exists = await this.storage.objectExists(artifact.s3Key);
      if (exists) {
        const downloadUrl = await this.storage.generatePresignedUrl(artifact.s3Key, 3600);
        return { hit: true, downloadUrl };
      }
    }

    // Cache miss — crear job hijo independiente y encolar
    const childJob = createJob({ tiktokUrl: job.tiktokUrl, format: "mp4", videoId: job.videoId });
    childJob.parentJobId = jobId;
    childJob.status = JobStatus.creating_gif;
    await this.jobRepo.save(childJob);
    await this.queuePort.enqueueGif({
      jobId: childJob.jobId,
      videoId,
      s3Key: job.s3Key!,
      trimStart: start,
      trimEnd: end,
    });
    return { hit: false, childJobId: childJob.jobId };
  }
}
