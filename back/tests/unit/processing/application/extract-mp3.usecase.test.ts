import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExtractMp3UseCase } from "../../../../src/processing/application/extract-mp3.usecase.js";
import { JobStatus } from "../../../../src/jobs/domain/job-status.js";

function makeMocks() {
  return {
    jobRepo: {
      updateStatus: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(), save: vi.fn(), acquireLock: vi.fn(), releaseLock: vi.fn(),
    },
    artifactRepo: { save: vi.fn().mockResolvedValue(undefined), findByKey: vi.fn(), incrementDownloadCount: vi.fn() },
    transcoder: { trim: vi.fn(), createGif: vi.fn(), extractMp3: vi.fn().mockResolvedValue(undefined) },
    storage: {
      download: vi.fn().mockResolvedValue(undefined),
      upload: vi.fn().mockResolvedValue(3000000),
      generatePresignedUrl: vi.fn(), objectExists: vi.fn(),
    },
    notifier: { execute: vi.fn().mockResolvedValue(undefined) },
  };
}

describe("ExtractMp3UseCase", () => {
  let mocks: ReturnType<typeof makeMocks>;
  let useCase: ExtractMp3UseCase;

  beforeEach(() => {
    mocks = makeMocks();
    useCase = new ExtractMp3UseCase(
      mocks.jobRepo as any, mocks.artifactRepo as any, mocks.transcoder as any,
      mocks.storage as any, mocks.notifier as any,
    );
  });

  it("downloads original from S3 first", async () => {
    await useCase.execute("job1", "vid123", "originals/vid123/vid123.mp4");
    expect(mocks.storage.download).toHaveBeenCalledWith("originals/vid123/vid123.mp4", expect.any(String));
  });

  it("uploads to mp3s/originals/ when no range provided", async () => {
    await useCase.execute("job1", "vid123", "originals/vid123/vid123.mp4");
    expect(mocks.storage.upload).toHaveBeenCalledWith(
      "mp3s/originals/vid123/vid123.mp3", expect.any(String), "audio/mpeg",
    );
  });

  it("uploads to mp3s/trims/ when range provided", async () => {
    await useCase.execute("job1", "vid123", "originals/vid123/vid123.mp4", 10, 30);
    expect(mocks.storage.upload).toHaveBeenCalledWith(
      "mp3s/trims/vid123/job1.mp3", expect.any(String), "audio/mpeg",
    );
  });

  it("updates job to mp3_ready and notifies", async () => {
    await useCase.execute("job1", "vid123", "originals/vid123/vid123.mp4");
    expect(mocks.jobRepo.updateStatus).toHaveBeenCalledWith("job1", JobStatus.mp3_ready, expect.any(Object));
    expect(mocks.notifier.execute).toHaveBeenCalledWith("job1");
  });
});
