import { describe, it, expect } from "vitest";
import { MAX_VIDEO_DURATION_SECONDS } from "../../../../src/processing/domain/video-processor.entity.js";
import type { VideoInfo, DownloadResult } from "../../../../src/processing/domain/video-processor.entity.js";

describe("video-processor.entity", () => {
  it("MAX_VIDEO_DURATION_SECONDS is 300", () => {
    expect(MAX_VIDEO_DURATION_SECONDS).toBe(300);
  });

  it("VideoInfo can be constructed", () => {
    const info: VideoInfo = { videoId: "abc123", title: "test", duration: 60, thumbnailUrl: "https://tiktok.com/video/abc123" };
    expect(info.videoId).toBe("abc123");
    expect(info.duration).toBe(60);
  });

  it("DownloadResult can be constructed", () => {
    const result: DownloadResult = { s3Key: "/tmp/abc.mp4", videoInfo: { videoId: "abc", title: "t", duration: 10, thumbnailUrl: "u" }, fileSizeBytes: 1024 };
    expect(result.fileSizeBytes).toBe(1024);
  });
});
