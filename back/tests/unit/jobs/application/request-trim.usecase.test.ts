import { describe, it, expect, vi, beforeEach } from "vitest";
import { RequestTrimUseCase } from "../../../../src/jobs/application/request-trim.usecase.js";
import { ErrorCode } from "../../../../src/shared/errors.js";
import { JobStatus } from "../../../../src/jobs/domain/job-status.js";

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    pk: "JOB#01ABC",
    sk: "METADATA",
    type: "JOB",
    jobId: "01ABC",
    videoId: "vid123",
    tiktokUrl: "https://tiktok.com/@u/video/vid123",
    status: JobStatus.ready,
    format: "mp4",
    duration: 60,
    retryCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: 9999999999,
    ...overrides,
  };
}

function makeMocks() {
  return {
    jobRepo: {
      findById: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      save: vi.fn(),
      acquireLock: vi.fn(),
      releaseLock: vi.fn(),
    },
    artifactRepo: {
      findByKey: vi.fn(),
      save: vi.fn(),
      incrementDownloadCount: vi.fn(),
    },
    queuePort: {
      enqueueDownload: vi.fn(),
      enqueueTrim: vi.fn().mockResolvedValue(undefined),
      enqueueGif: vi.fn(),
      enqueueMp3: vi.fn(),
    },
    storage: {
      objectExists: vi.fn(),
      generatePresignedUrl: vi.fn(),
      upload: vi.fn(),
      download: vi.fn(),
    },
  };
}

describe("RequestTrimUseCase", () => {
  let mocks: ReturnType<typeof makeMocks>;
  let useCase: RequestTrimUseCase;

  beforeEach(() => {
    mocks = makeMocks();
    useCase = new RequestTrimUseCase(
      mocks.jobRepo as any,
      mocks.artifactRepo as any,
      mocks.queuePort as any,
      mocks.storage as any,
    );
  });

  it("throws JOB_NOT_FOUND when job does not exist", async () => {
    mocks.jobRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute("x", 0, 10)).rejects.toMatchObject({ code: ErrorCode.JOB_NOT_FOUND });
  });

  it("throws JOB_NOT_READY when status is not ready", async () => {
    mocks.jobRepo.findById.mockResolvedValue(makeJob({ status: JobStatus.pending }));
    await expect(useCase.execute("x", 0, 10)).rejects.toMatchObject({ code: ErrorCode.JOB_NOT_READY });
  });

  it("throws INVALID_TRIM_RANGE when trimStart >= trimEnd", async () => {
    mocks.jobRepo.findById.mockResolvedValue(makeJob());
    await expect(useCase.execute("x", 10, 10)).rejects.toMatchObject({ code: ErrorCode.INVALID_TRIM_RANGE });
  });

  it("throws INVALID_TRIM_RANGE when trimEnd > duration", async () => {
    mocks.jobRepo.findById.mockResolvedValue(makeJob({ duration: 60 }));
    await expect(useCase.execute("x", 0, 90)).rejects.toMatchObject({ code: ErrorCode.INVALID_TRIM_RANGE });
  });

  it("enqueues trim on cache miss", async () => {
    mocks.jobRepo.findById.mockResolvedValue(makeJob());
    mocks.artifactRepo.findByKey.mockResolvedValue(null);

    const result = await useCase.execute("01ABC", 0, 30);
    expect(result.hit).toBe(false);
    expect(mocks.queuePort.enqueueTrim).toHaveBeenCalledOnce();
    expect(mocks.jobRepo.updateStatus).toHaveBeenCalledWith("01ABC", JobStatus.trimming);
  });

  it("returns cache hit with presigned URL when artifact exists in S3", async () => {
    mocks.jobRepo.findById.mockResolvedValue(makeJob());
    mocks.artifactRepo.findByKey.mockResolvedValue({ s3Key: "trims/vid123/01ABC.mp4" });
    mocks.storage.objectExists.mockResolvedValue(true);
    mocks.storage.generatePresignedUrl.mockResolvedValue("https://signed.url");

    const result = await useCase.execute("01ABC", 0, 30);
    expect(result.hit).toBe(true);
    expect(result.downloadUrl).toBe("https://signed.url");
    expect(mocks.queuePort.enqueueTrim).not.toHaveBeenCalled();
  });
});
