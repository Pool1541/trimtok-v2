import { describe, it, expect } from "vitest";
import { artifactTtlSeconds } from "../../../../src/jobs/domain/cache-artifact.entity.js";

describe("artifactTtlSeconds()", () => {
  it("returns 172800 for mp4/original", () => {
    expect(artifactTtlSeconds("mp4", "original")).toBe(172800);
  });

  it("returns 86400 for mp4/trim", () => {
    expect(artifactTtlSeconds("mp4", "trim")).toBe(86400);
  });

  it("returns 86400 for gif/gif", () => {
    expect(artifactTtlSeconds("gif", "gif")).toBe(86400);
  });

  it("returns 172800 for mp3/original", () => {
    expect(artifactTtlSeconds("mp3", "original")).toBe(172800);
  });

  it("returns 86400 for mp3/trim", () => {
    expect(artifactTtlSeconds("mp3", "trim")).toBe(86400);
  });
});
