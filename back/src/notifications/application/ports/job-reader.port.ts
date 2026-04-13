import type { Job } from "../../../jobs/domain/job.entity.js";

/** Read-only interface for cross-module job lookups (avoids coupling to IJobRepository) */
export interface IJobReader {
  findById(jobId: string): Promise<Job | null>;
}
