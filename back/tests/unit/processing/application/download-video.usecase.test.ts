import { describe, it, expect, vi, beforeEach } from "vitest";
import { DownloadVideoUseCase } from "../../../../src/processing/application/download-video.usecase.js";
import { ErrorCode } from "../../../../src/shared/errors.js";
import { JobStatus } from "../../../../src/jobs/domain/job-status.js";

const { rmMock } = vi.hoisted(() => ({
  rmMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("node:fs/promises", async (importActual) => ({
  ...(await importActual<typeof import("node:fs/promises")>()),
  rm: rmMock,
}));

function makeMocks() {
  return {
    jobRepo: {
      findById: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      save: vi.fn(),
      acquireLock: vi.fn().mockResolvedValue(true),
      releaseLock: vi.fn().mockResolvedValue(undefined),
    },
    artifactRepo: { findByKey: vi.fn(), save: vi.fn().mockResolvedValue(undefined), incrementDownloadCount: vi.fn() },
    downloader: {
      downloadVideo: vi.fn().mockResolvedValue({
        localPath: "/tmp/dl-abc123/vid123.mp4",
        videoInfo: { videoId: "vid123", title: "Test", durationSeconds: 45, originalUrl: "https://tiktok.com/video/123" },
        fileSizeBytes: 5000000,
      }),
    },
    storage: {
      upload: vi.fn().mockResolvedValue(5000000),
      download: vi.fn().mockResolvedValue(undefined),
      generatePresignedUrl: vi.fn(),
      objectExists: vi.fn(),
    },
    notifier: { execute: vi.fn().mockResolvedValue(undefined) },
  };
}

describe("DownloadVideoUseCase", () => {
  let mocks: ReturnType<typeof makeMocks>;
  let useCase: DownloadVideoUseCase;

  beforeEach(() => {
    mocks = makeMocks();
    useCase = new DownloadVideoUseCase(
      mocks.jobRepo as any,
      mocks.artifactRepo as any,
      mocks.downloader as any,
      mocks.storage as any,
      mocks.notifier as any,
    );
    rmMock.mockClear();
  });

  it("returns false when lock is not acquired (concurrent worker)", async () => {
    mocks.jobRepo.acquireLock.mockResolvedValue(false);

    const result = await useCase.execute("job1", "https://tiktok.com/video/123", "vid123", "mp4");

    expect(result).toBe(false);
    expect(mocks.downloader.downloadVideo).not.toHaveBeenCalled();
    expect(mocks.jobRepo.updateStatus).not.toHaveBeenCalled();
    expect(mocks.notifier.execute).not.toHaveBeenCalled();
  });

  it("returns true and executes full success path when lock acquired", async () => {
    const result = await useCase.execute("job1", "https://tiktok.com/video/123", "vid123", "mp4");

    expect(result).toBe(true);

    expect(mocks.jobRepo.updateStatus).toHaveBeenCalledWith("job1", JobStatus.downloading);
    expect(mocks.downloader.downloadVideo).toHaveBeenCalledOnce();
    expect(mocks.storage.upload).toHaveBeenCalledWith("originals/vid123/vid123.mp4", "/tmp/dl-abc123/vid123.mp4", "video/mp4");
    expect(mocks.artifactRepo.save).toHaveBeenCalledOnce();
    expect(mocks.jobRepo.updateStatus).toHaveBeenCalledWith("job1", JobStatus.ready, expect.objectContaining({ s3Key: "originals/vid123/vid123.mp4" }));
    expect(mocks.notifier.execute).toHaveBeenCalledWith("job1");
    expect(mocks.jobRepo.releaseLock).toHaveBeenCalled();
  });

  it("propagates VIDEO_TOO_LONG error and releases lock", async () => {
    const err = { code: ErrorCode.VIDEO_TOO_LONG, message: "too long" };
    mocks.downloader.downloadVideo.mockRejectedValue(err);

    await expect(
      useCase.execute("job1", "https://tiktok.com/video/123", "vid123", "mp4"),
    ).rejects.toMatchObject({ code: ErrorCode.VIDEO_TOO_LONG });

    expect(mocks.jobRepo.releaseLock).toHaveBeenCalled();
  });

  it("releases lock when S3 upload fails", async () => {
    mocks.storage.upload.mockRejectedValue(new Error("S3 error"));

    await expect(
      useCase.execute("job1", "https://tiktok.com/video/123", "vid123", "mp4"),
    ).rejects.toThrow("S3 error");

    expect(mocks.jobRepo.releaseLock).toHaveBeenCalled();
  });

  it("removes workDir after successful download", async () => {
    await useCase.execute("job1", "https://tiktok.com/video/123", "vid123", "mp4");
    expect(rmMock).toHaveBeenCalledWith("/tmp/dl-abc123", { recursive: true, force: true });
  });

  it("removes workDir even when S3 upload fails", async () => {
    mocks.storage.upload.mockRejectedValue(new Error("S3 error"));

    await expect(
      useCase.execute("job1", "https://tiktok.com/video/123", "vid123", "mp4"),
    ).rejects.toThrow("S3 error");

    expect(rmMock).toHaveBeenCalledWith("/tmp/dl-abc123", { recursive: true, force: true });
  });

  it("resolves from existing artifact after acquiring lock (SQS retry path)", async () => {
    const artifact = {
      pk: "ARTIFACT#vid123", sk: "MP4#ORIGINAL", type: "ARTIFACT" as const,
      videoId: "vid123", tiktokUrl: "https://tiktok.com/video/123",
      format: "mp4" as const, artifactType: "original" as const,
      s3Key: "originals/vid123/vid123.mp4",
      title: "Test", duration: 45, thumbnailUrl: "https://thumb.example.com/t.jpg",
      downloadCount: 1, createdAt: new Date().toISOString(), expiresAt: 9999999999,
    };
    mocks.artifactRepo.findByKey.mockResolvedValue(artifact);
    mocks.storage.objectExists.mockResolvedValue(true);

    const result = await useCase.execute("job1", "https://tiktok.com/video/123", "vid123", "mp4");

    expect(result).toBe(true);
    expect(mocks.downloader.downloadVideo).not.toHaveBeenCalled();
    expect(mocks.storage.upload).not.toHaveBeenCalled();
    expect(mocks.jobRepo.updateStatus).toHaveBeenCalledWith("job1", JobStatus.ready,
      expect.objectContaining({ s3Key: "originals/vid123/vid123.mp4", title: "Test" })
    );
    expect(mocks.jobRepo.releaseLock).toHaveBeenCalled();
    expect(mocks.notifier.execute).toHaveBeenCalledWith("job1");
  });

  it("does not call rm when downloader fails (workDir not set)", async () => {
    mocks.downloader.downloadVideo.mockRejectedValue(new Error("yt-dlp error"));

    await expect(
      useCase.execute("job1", "https://tiktok.com/video/123", "vid123", "mp4"),
    ).rejects.toThrow("yt-dlp error");

    expect(rmMock).not.toHaveBeenCalled();
  });
});
