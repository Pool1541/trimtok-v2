import { jobNotFound } from "../../shared/errors.js";
import { TERMINAL_WITH_ARTIFACT } from "../domain/job-status.js";
import type { IJobRepository } from "./ports/job.repository.js";
import type { IStoragePort } from "./ports/storage.port.js";
import type { Job } from "../domain/job.entity.js";

export interface GetJobResult {
  job: Job;
  downloadUrl: string | null;
}

export class GetJobUseCase {
  constructor(
    private readonly jobRepo: IJobRepository,
    private readonly storage: IStoragePort,
  ) {}

  async execute(jobId: string): Promise<GetJobResult> {
    const job = await this.jobRepo.findById(jobId);
    if (!job) throw jobNotFound();

    let downloadUrl: string | null = null;
    if (job.s3Key && TERMINAL_WITH_ARTIFACT.has(job.status)) {
      const exists = await this.storage.objectExists(job.s3Key);
      if (exists) {
        downloadUrl = await this.storage.generatePresignedUrl(job.s3Key, 3600);
      }
      // If not exists: graceful miss — downloadUrl stays null
    }

    return { job, downloadUrl };
  }
}
