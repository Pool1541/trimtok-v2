import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateGifUseCase } from "../../../../src/processing/application/create-gif.usecase.js";
import { JobStatus } from "../../../../src/jobs/domain/job-status.js";

function makeMocks() {
  return {
    jobRepo: {
      updateStatus: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(), save: vi.fn(), acquireLock: vi.fn(), releaseLock: vi.fn(),
    },
    artifactRepo: { save: vi.fn().mockResolvedValue(undefined), findByKey: vi.fn(), incrementDownloadCount: vi.fn() },
    transcoder: { trim: vi.fn(), createGif: vi.fn().mockResolvedValue(undefined), extractMp3: vi.fn() },
    storage: {
      download: vi.fn().mockResolvedValue(undefined),
      upload: vi.fn().mockResolvedValue(500000),
      generatePresignedUrl: vi.fn(), objectExists: vi.fn(),
    },
    notifier: { execute: vi.fn().mockResolvedValue(undefined) },
  };
}

describe("CreateGifUseCase", () => {
  let mocks: ReturnType<typeof makeMocks>;
  let useCase: CreateGifUseCase;

  beforeEach(() => {
    mocks = makeMocks();
    useCase = new CreateGifUseCase(
      mocks.jobRepo as any, mocks.artifactRepo as any, mocks.transcoder as any,
      mocks.storage as any, mocks.notifier as any,
    );
  });

  it("downloads original from S3 as first step", async () => {
    await useCase.execute("job1", "vid123", "originals/vid123/vid123.mp4", 0, 5);
    expect(mocks.storage.download).toHaveBeenCalledWith("originals/vid123/vid123.mp4", expect.any(String));
  });

  it("calls transcoder.createGif", async () => {
    await useCase.execute("job1", "vid123", "originals/vid123/vid123.mp4", 2, 8);
    expect(mocks.transcoder.createGif).toHaveBeenCalledWith(expect.any(String), expect.any(String), 2, 8);
  });

  it("uploads to gifs/ S3 path", async () => {
    await useCase.execute("job1", "vid123", "originals/vid123/vid123.mp4", 0, 5);
    expect(mocks.storage.upload).toHaveBeenCalledWith("gifs/vid123/job1.gif", expect.any(String), "image/gif");
  });

  it("updates job to gif_created and notifies", async () => {
    await useCase.execute("job1", "vid123", "originals/vid123/vid123.mp4", 0, 5);
    expect(mocks.jobRepo.updateStatus).toHaveBeenCalledWith("job1", JobStatus.gif_created, expect.objectContaining({ s3Key: "gifs/vid123/job1.gif" }));
    expect(mocks.notifier.execute).toHaveBeenCalledWith("job1");
  });
});
