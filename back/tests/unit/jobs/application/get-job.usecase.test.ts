import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetJobUseCase } from "../../../../src/jobs/application/get-job.usecase.js";
import { ErrorCode } from "../../../../src/shared/errors.js";
import { JobStatus } from "../../../../src/jobs/domain/job-status.js";

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    pk: "JOB#01ABC",
    sk: "METADATA",
    type: "JOB",
    jobId: "01ABC",
    tiktokUrl: "https://tiktok.com/@u/video/123",
    status: JobStatus.ready,
    format: "mp4",
    retryCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: 9999999999,
    ...overrides,
  };
}

function makeMocks() {
  return {
    jobRepo: { findById: vi.fn() },
    storage: {
      objectExists: vi.fn(),
      generatePresignedUrl: vi.fn(),
      upload: vi.fn(),
      download: vi.fn(),
    },
  };
}

describe("GetJobUseCase", () => {
  let mocks: ReturnType<typeof makeMocks>;
  let useCase: GetJobUseCase;

  beforeEach(() => {
    mocks = makeMocks();
    useCase = new GetJobUseCase(mocks.jobRepo as any, mocks.storage as any);
  });

  it("throws JOB_NOT_FOUND when job is null", async () => {
    mocks.jobRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute("nonexistent")).rejects.toMatchObject({ code: ErrorCode.JOB_NOT_FOUND });
  });

  it("returns downloadUrl when job is ready and S3 object exists", async () => {
    const job = makeJob({ s3Key: "originals/v/v.mp4", status: JobStatus.ready });
    mocks.jobRepo.findById.mockResolvedValue(job);
    mocks.storage.objectExists.mockResolvedValue(true);
    mocks.storage.generatePresignedUrl.mockResolvedValue("https://signed.url");

    const result = await useCase.execute("01ABC");
    expect(result.downloadUrl).toBe("https://signed.url");
  });

  it("returns null downloadUrl when job is ready but S3 object missing", async () => {
    const job = makeJob({ s3Key: "originals/v/v.mp4", status: JobStatus.ready });
    mocks.jobRepo.findById.mockResolvedValue(job);
    mocks.storage.objectExists.mockResolvedValue(false);

    const result = await useCase.execute("01ABC");
    expect(result.downloadUrl).toBeNull();
  });

  it("returns null downloadUrl for non-terminal status", async () => {
    const job = makeJob({ status: JobStatus.downloading });
    mocks.jobRepo.findById.mockResolvedValue(job);

    const result = await useCase.execute("01ABC");
    expect(result.downloadUrl).toBeNull();
    expect(mocks.storage.objectExists).not.toHaveBeenCalled();
  });
});
