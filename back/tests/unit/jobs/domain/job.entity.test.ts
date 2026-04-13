import { describe, it, expect } from "vitest";
import { createJob } from "../../../../src/jobs/domain/job.entity.js";

describe("createJob()", () => {
  it("generates a 26-char ULID jobId", () => {
    const job = createJob({ tiktokUrl: "https://tiktok.com/video/123", format: "mp4" });
    expect(job.jobId).toMatch(/^[0-9A-Z]{26}$/);
  });

  it("sets createdAt as ISO 8601 string", () => {
    const job = createJob({ tiktokUrl: "https://tiktok.com/video/123", format: "mp4" });
    expect(job.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("defaults status to pending", () => {
    const job = createJob({ tiktokUrl: "https://tiktok.com/video/123", format: "mp4" });
    expect(job.status).toBe("pending");
  });

  it("initializes retryCount to 0", () => {
    const job = createJob({ tiktokUrl: "https://tiktok.com/video/123", format: "mp4" });
    expect(job.retryCount).toBe(0);
  });

  it("sets expiresAt to at least 7 days from now", () => {
    const before = Math.floor(Date.now() / 1000);
    const job = createJob({ tiktokUrl: "https://tiktok.com/video/123", format: "mp4" });
    expect(job.expiresAt).toBeGreaterThanOrEqual(before + 7 * 24 * 3600);
  });
});
