import { describe, it, expect, vi, beforeEach } from "vitest";
import { RequestMp3UseCase } from "../../../../src/jobs/application/request-mp3.usecase.js";
import { ErrorCode } from "../../../../src/shared/errors.js";
import { JobStatus } from "../../../../src/jobs/domain/job-status.js";

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    pk: "JOB#01ABC", sk: "METADATA", type: "JOB",
    jobId: "01ABC", videoId: "vid123",
    tiktokUrl: "https://tiktok.com/@u/video/vid123",
    status: JobStatus.ready, format: "mp4", duration: 60,
    retryCount: 0, createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(), expiresAt: 9999999999,
    ...overrides,
  };
}

function makeMocks() {
  return {
    jobRepo: {
      findById: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      save: vi.fn(), acquireLock: vi.fn(), releaseLock: vi.fn(),
    },
    artifactRepo: { findByKey: vi.fn(), save: vi.fn(), incrementDownloadCount: vi.fn() },
    queuePort: {
      enqueueDownload: vi.fn(), enqueueTrim: vi.fn(), enqueueGif: vi.fn(),
      enqueueMp3: vi.fn().mockResolvedValue(undefined),
    },
    storage: {
      objectExists: vi.fn(), generatePresignedUrl: vi.fn(), upload: vi.fn(), download: vi.fn(),
    },
  };
}

describe("RequestMp3UseCase", () => {
  let mocks: ReturnType<typeof makeMocks>;
  let useCase: RequestMp3UseCase;

  beforeEach(() => {
    mocks = makeMocks();
    useCase = new RequestMp3UseCase(
      mocks.jobRepo as any, mocks.artifactRepo as any, mocks.queuePort as any, mocks.storage as any,
    );
  });

  it("throws JOB_NOT_READY when status is downloading", async () => {
    mocks.jobRepo.findById.mockResolvedValue(makeJob({ status: JobStatus.downloading }));
    await expect(useCase.execute("01ABC")).rejects.toMatchObject({ code: ErrorCode.JOB_NOT_READY });
  });

  it("uses artifactType=original when no range provided", async () => {
    mocks.jobRepo.findById.mockResolvedValue(makeJob());
    mocks.artifactRepo.findByKey.mockResolvedValue(null);

    await useCase.execute("01ABC");
    expect(mocks.artifactRepo.findByKey).toHaveBeenCalledWith("vid123", "mp3", "original", undefined, undefined);
  });

  it("uses artifactType=trim when range provided", async () => {
    mocks.jobRepo.findById.mockResolvedValue(makeJob());
    mocks.artifactRepo.findByKey.mockResolvedValue(null);

    await useCase.execute("01ABC", 10, 30);
    expect(mocks.artifactRepo.findByKey).toHaveBeenCalledWith("vid123", "mp3", "trim", 10, 30);
  });

  it("returns cache hit with presigned URL", async () => {
    mocks.jobRepo.findById.mockResolvedValue(makeJob());
    mocks.artifactRepo.findByKey.mockResolvedValue({ s3Key: "mp3s/originals/vid123/vid123.mp3" });
    mocks.storage.objectExists.mockResolvedValue(true);
    mocks.storage.generatePresignedUrl.mockResolvedValue("https://mp3.signed.url");

    const result = await useCase.execute("01ABC");
    expect(result.hit).toBe(true);
    expect(result.downloadUrl).toBe("https://mp3.signed.url");
    expect(mocks.queuePort.enqueueMp3).not.toHaveBeenCalled();
  });
});
