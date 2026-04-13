import type { Job } from "../../domain/job.entity.js";
import type { JobStatus } from "../../domain/job-status.js";

export interface IJobRepository {
  save(job: Job): Promise<void>;
  findById(jobId: string): Promise<Job | null>;
  updateStatus(jobId: string, status: JobStatus, extra?: Partial<Job>): Promise<void>;
  /** Returns true if lock acquired, false if already locked by another worker */
  acquireLock(videoId: string, jobId: string): Promise<boolean>;
  releaseLock(videoId: string): Promise<void>;
}
