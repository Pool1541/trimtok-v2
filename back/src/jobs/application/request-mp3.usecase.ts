import { JobStatus } from "../domain/job-status.js";
import { jobNotFound, jobNotReady } from "../../shared/errors.js";
import type { IJobRepository } from "./ports/job.repository.js";
import type { IArtifactRepository } from "./ports/artifact.repository.js";
import type { IJobQueuePort } from "./ports/job-queue.port.js";
import type { IStoragePort } from "./ports/storage.port.js";

const MP3_READY_STATUSES: ReadonlySet<string> = new Set([JobStatus.ready, JobStatus.trimmed]);

export interface RequestMp3Result {
  hit: boolean;
  downloadUrl?: string;
}

export class RequestMp3UseCase {
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
  ): Promise<RequestMp3Result> {
    const job = await this.jobRepo.findById(jobId);
    if (!job) throw jobNotFound();
    if (!MP3_READY_STATUSES.has(job.status)) throw jobNotReady();

    const videoId = job.videoId ?? jobId;
    const hasRange = trimStart !== undefined && trimEnd !== undefined;
    const artifactType = hasRange ? "trim" : "original";

    // Check cache
    const artifact = await this.artifactRepo.findByKey(
      videoId, "mp3", artifactType, trimStart, trimEnd,
    );
    if (artifact) {
      const exists = await this.storage.objectExists(artifact.s3Key);
      if (exists) {
        const downloadUrl = await this.storage.generatePresignedUrl(artifact.s3Key, 3600);
        await this.jobRepo.updateStatus(jobId, JobStatus.mp3_ready, { s3Key: artifact.s3Key });
        return { hit: true, downloadUrl };
      }
    }

    // Cache miss — enqueue
    await this.jobRepo.updateStatus(jobId, JobStatus.creating_mp3);
    await this.queuePort.enqueueMp3({ jobId, videoId, trimStart, trimEnd });
    return { hit: false };
  }
}
