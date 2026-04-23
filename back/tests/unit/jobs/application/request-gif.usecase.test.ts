import { describe, it, expect, vi, beforeEach } from "vitest";
import { RequestGifUseCase } from "../../../../src/jobs/application/request-gif.usecase.js";
import { ErrorCode } from "../../../../src/shared/errors.js";
import { JobStatus } from "../../../../src/jobs/domain/job-status.js";

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    pk: "JOB#01ABC", sk: "METADATA", type: "JOB",
    jobId: "01ABC", videoId: "vid123",
    tiktokUrl: "https://tiktok.com/@u/video/vid123",
    status: JobStatus.ready, format: "mp4", duration: 30,
    s3Key: "originals/vid123/vid123.mp4",
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
      enqueueDownload: vi.fn(), enqueueTrim: vi.fn(),
      enqueueGif: vi.fn().mockResolvedValue(undefined), enqueueMp3: vi.fn(),
    },
    storage: {
      objectExists: vi.fn(), generatePresignedUrl: vi.fn(), upload: vi.fn(), download: vi.fn(),
    },
  };
}

describe("RequestGifUseCase", () => {
  let mocks: ReturnType<typeof makeMocks>;
  let useCase: RequestGifUseCase;

  beforeEach(() => {
    mocks = makeMocks();
    useCase = new RequestGifUseCase(
      mocks.jobRepo as any, mocks.artifactRepo as any, mocks.queuePort as any, mocks.storage as any,
    );
  });

  it("throws JOB_NOT_READY when status is pending", async () => {
    mocks.jobRepo.findById.mockResolvedValue(makeJob({ status: JobStatus.pending }));
    await expect(useCase.execute("01ABC")).rejects.toMatchObject({ code: ErrorCode.JOB_NOT_READY });
  });

  it("uses default trimEnd = min(10, duration) when trimEnd is not provided", async () => {
    mocks.jobRepo.findById.mockResolvedValue(makeJob({ duration: 30 }));
    mocks.artifactRepo.findByKey.mockResolvedValue(null);

    await useCase.execute("01ABC");

    // findByKey should be called with trimEnd = min(10, 30) = 10
    expect(mocks.artifactRepo.findByKey).toHaveBeenCalledWith("vid123", "gif", "gif", 0, 10);
  });

  it("enqueues gif on cache miss", async () => {
    mocks.jobRepo.findById.mockResolvedValue(makeJob());
    mocks.artifactRepo.findByKey.mockResolvedValue(null);

    const result = await useCase.execute("01ABC", 0, 10);
    expect(result.hit).toBe(false);
    expect(result.childJobId).toBeDefined();
    // Crea el job hijo (no muta el job original)
    expect(mocks.jobRepo.save).toHaveBeenCalledOnce();
    const savedChild = mocks.jobRepo.save.mock.calls[0][0];
    expect(savedChild.parentJobId).toBe("01ABC");
    expect(savedChild.status).toBe(JobStatus.creating_gif);
    // Encola con el s3Key del job original
    expect(mocks.queuePort.enqueueGif).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: result.childJobId, s3Key: "originals/vid123/vid123.mp4" }),
    );
    // No debe mutar el job original
    expect(mocks.jobRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("returns cache hit with presigned URL", async () => {
    mocks.jobRepo.findById.mockResolvedValue(makeJob());
    mocks.artifactRepo.findByKey.mockResolvedValue({ s3Key: "gifs/vid123/01ABC.gif" });
    mocks.storage.objectExists.mockResolvedValue(true);
    mocks.storage.generatePresignedUrl.mockResolvedValue("https://gif.signed.url");

    const result = await useCase.execute("01ABC", 0, 10);
    expect(result.hit).toBe(true);
    expect(result.downloadUrl).toBe("https://gif.signed.url");
    expect(mocks.queuePort.enqueueGif).not.toHaveBeenCalled();
    // No debe mutar el job original en cache hit
    expect(mocks.jobRepo.updateStatus).not.toHaveBeenCalled();
  });
});
