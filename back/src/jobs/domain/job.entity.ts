import { ulid } from "ulidx";
import { JobStatus } from "./job-status.js";

export interface Job {
  pk: string;
  sk: string;
  type: "JOB";
  jobId: string;
  videoId?: string;
  tiktokUrl: string;
  status: JobStatus;
  format: "mp4" | "mp3";
  s3Key?: string;
  title?: string;
  duration?: number;
  thumbnailUrl?: string;
  trimStart?: number;
  trimEnd?: number;
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  /** Unix epoch seconds, TTL attribute */
  expiresAt: number;
}

const JOB_TTL_SECONDS = 7 * 24 * 3600; // 7 days

export function createJob(params: {
  tiktokUrl: string;
  format: "mp4" | "mp3";
  videoId?: string;
}): Job {
  const jobId = ulid();
  const now = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + JOB_TTL_SECONDS;

  return {
    pk: `JOB#${jobId}`,
    sk: "METADATA",
    type: "JOB",
    jobId,
    videoId: params.videoId,
    tiktokUrl: params.tiktokUrl,
    status: JobStatus.pending,
    format: params.format,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };
}
