import { createJob } from "../domain/job.entity.js";
import { JobStatus } from "../domain/job-status.js";
import { invalidUrl } from "../../shared/errors.js";
import type { IJobRepository } from "./ports/job.repository.js";
import type { IArtifactRepository } from "./ports/artifact.repository.js";
import type { IJobQueuePort } from "./ports/job-queue.port.js";
import type { IStoragePort } from "./ports/storage.port.js";
import type { Job } from "../domain/job.entity.js";

const TIKTOK_DOMAINS = ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com"];

function extractVideoId(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    // /video/{videoId} or /@{user}/video/{videoId}
    const videoIdx = parts.lastIndexOf("video");
    if (videoIdx !== -1 && parts[videoIdx + 1]) {
      return parts[videoIdx + 1];
    }
    // short URLs: use path segment
    return parts[parts.length - 1] ?? ulid();
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

function isValidTiktokUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return TIKTOK_DOMAINS.some((d) => parsed.hostname.endsWith(d));
  } catch {
    return false;
  }
}

// ulid import — used only in fallback path
import { ulid } from "ulidx";

export interface CreateJobResult {
  hit: boolean;
  downloadUrl?: string;
  job: Job;
}

export class CreateJobUseCase {
  constructor(
    private readonly jobRepo: IJobRepository,
    private readonly artifactRepo: IArtifactRepository,
    private readonly queuePort: IJobQueuePort,
    private readonly storage: IStoragePort,
  ) {}

  async execute(tiktokUrl: string, format: "mp4" | "mp3" = "mp4", correlationId: string): Promise<CreateJobResult> {
    if (!isValidTiktokUrl(tiktokUrl)) {
      throw invalidUrl();
    }

    const videoId = extractVideoId(tiktokUrl);

    // Check cache
    const artifact = await this.artifactRepo.findByKey(videoId, format, "original");
    if (artifact) {
      const exists = await this.storage.objectExists(artifact.s3Key);
      if (exists) {
        const downloadUrl = await this.storage.generatePresignedUrl(artifact.s3Key, 3600);
        await this.artifactRepo.incrementDownloadCount(videoId, format, "original");
        // Persist a Job entity so downstream calls (/trim, /gif, /mp3) have a valid jobId.
        // PutCommand overwrites silently — idempotent by design (Constitution VI).
        const hitJob = createJob({ tiktokUrl, format, videoId });
        Object.assign(hitJob, { status: JobStatus.ready, s3Key: artifact.s3Key });
        await this.jobRepo.save(hitJob);
        return { hit: true, downloadUrl, job: hitJob };
      }
      // S3 object expired — fall through to cache miss
    }

    // Cache miss — create job and enqueue
    const job = createJob({ tiktokUrl, format, videoId });
    await this.jobRepo.save(job);
    await this.queuePort.enqueueDownload({ jobId: job.jobId, tiktokUrl, format }, correlationId);

    return { hit: false, job };
  }
}
