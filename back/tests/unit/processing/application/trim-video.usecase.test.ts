import { describe, it, expect, vi, beforeEach } from "vitest";
import { TrimVideoUseCase } from "../../../../src/processing/application/trim-video.usecase.js";
import { JobStatus } from "../../../../src/jobs/domain/job-status.js";

function makeMocks() {
  return {
    jobRepo: {
      updateStatus: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(), save: vi.fn(), acquireLock: vi.fn(), releaseLock: vi.fn(),
    },
    artifactRepo: { save: vi.fn().mockResolvedValue(undefined), findByKey: vi.fn(), incrementDownloadCount: vi.fn() },
    transcoder: { trim: vi.fn().mockResolvedValue(undefined), createGif: vi.fn(), extractMp3: vi.fn() },
    storage: {
      download: vi.fn().mockResolvedValue(undefined),
      upload: vi.fn().mockResolvedValue(2000000),
      generatePresignedUrl: vi.fn(), objectExists: vi.fn(),
    },
    notifier: { execute: vi.fn().mockResolvedValue(undefined) },
  };
}

describe("TrimVideoUseCase", () => {
  let mocks: ReturnType<typeof makeMocks>;
  let useCase: TrimVideoUseCase;

  beforeEach(() => {
    mocks = makeMocks();
    useCase = new TrimVideoUseCase(
      mocks.jobRepo as any, mocks.artifactRepo as any, mocks.transcoder as any,
      mocks.storage as any, mocks.notifier as any,
    );
  });

  it("downloads original from S3 as first step", async () => {
    await useCase.execute("job1", "vid123", "originals/vid123/vid123.mp4", 0, 10);
    expect(mocks.storage.download).toHaveBeenCalledWith("originals/vid123/vid123.mp4", expect.stringContaining("vid123_orig"));
  });

  it("calls transcoder.trim with correct arguments", async () => {
    await useCase.execute("job1", "vid123", "originals/vid123/vid123.mp4", 5, 20);
    expect(mocks.transcoder.trim).toHaveBeenCalledWith(
      expect.stringContaining("vid123_orig"),
      expect.stringContaining("job1"),
      5,
      20,
    );
  });

  it("uploads to trims/ S3 path", async () => {
    await useCase.execute("job1", "vid123", "originals/vid123/vid123.mp4", 0, 10);
    expect(mocks.storage.upload).toHaveBeenCalledWith("trims/vid123/job1.mp4", expect.any(String), "video/mp4");
  });

  it("saves CacheArtifact and updates job to trimmed", async () => {
    await useCase.execute("job1", "vid123", "originals/vid123/vid123.mp4", 0, 10);
    expect(mocks.artifactRepo.save).toHaveBeenCalledOnce();
    expect(mocks.jobRepo.updateStatus).toHaveBeenCalledWith("job1", JobStatus.trimmed, expect.objectContaining({ s3Key: "trims/vid123/job1.mp4" }));
  });

  it("calls notifier after updating job status", async () => {
    await useCase.execute("job1", "vid123", "originals/vid123/vid123.mp4", 0, 10);
    expect(mocks.notifier.execute).toHaveBeenCalledWith("job1");
  });
});
