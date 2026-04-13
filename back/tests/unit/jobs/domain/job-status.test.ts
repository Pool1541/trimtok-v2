import { describe, it, expect } from "vitest";
import { JobStatus, TERMINAL_STATUSES, TERMINAL_WITH_ARTIFACT } from "../../../../src/jobs/domain/job-status.js";

describe("JobStatus", () => {
  it("has all 10 status values as string literals", () => {
    const expected = [
      "pending", "downloading", "ready", "trimming", "trimmed",
      "creating_gif", "gif_created", "creating_mp3", "mp3_ready", "error",
    ];
    expect(Object.values(JobStatus)).toEqual(expect.arrayContaining(expected));
    expect(Object.values(JobStatus)).toHaveLength(10);
  });

  it("TERMINAL_STATUSES contains exactly {ready, trimmed, gif_created, mp3_ready, error}", () => {
    expect(TERMINAL_STATUSES.has(JobStatus.ready)).toBe(true);
    expect(TERMINAL_STATUSES.has(JobStatus.trimmed)).toBe(true);
    expect(TERMINAL_STATUSES.has(JobStatus.gif_created)).toBe(true);
    expect(TERMINAL_STATUSES.has(JobStatus.mp3_ready)).toBe(true);
    expect(TERMINAL_STATUSES.has(JobStatus.error)).toBe(true);
    expect(TERMINAL_STATUSES.size).toBe(5);
  });

  it("TERMINAL_STATUSES excludes non-terminal statuses", () => {
    expect(TERMINAL_STATUSES.has(JobStatus.pending)).toBe(false);
    expect(TERMINAL_STATUSES.has(JobStatus.downloading)).toBe(false);
    expect(TERMINAL_STATUSES.has(JobStatus.trimming)).toBe(false);
    expect(TERMINAL_STATUSES.has(JobStatus.creating_gif)).toBe(false);
    expect(TERMINAL_STATUSES.has(JobStatus.creating_mp3)).toBe(false);
  });

  it("TERMINAL_WITH_ARTIFACT excludes error", () => {
    expect(TERMINAL_WITH_ARTIFACT.has(JobStatus.error)).toBe(false);
    expect(TERMINAL_WITH_ARTIFACT.has(JobStatus.ready)).toBe(true);
    expect(TERMINAL_WITH_ARTIFACT.has(JobStatus.trimmed)).toBe(true);
    expect(TERMINAL_WITH_ARTIFACT.has(JobStatus.gif_created)).toBe(true);
    expect(TERMINAL_WITH_ARTIFACT.has(JobStatus.mp3_ready)).toBe(true);
  });
});
