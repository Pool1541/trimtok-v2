import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateJobUseCase } from "../../../../src/jobs/application/create-job.usecase.js";
import { ErrorCode } from "../../../../src/shared/errors.js";

function makeRepos() {
  return {
    jobRepo: {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      acquireLock: vi.fn(),
      releaseLock: vi.fn(),
    },
    artifactRepo: {
      findByKey: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
      incrementDownloadCount: vi.fn().mockResolvedValue(undefined),
    },
    queuePort: {
      enqueueDownload: vi.fn().mockResolvedValue(undefined),
      enqueueTrim: vi.fn().mockResolvedValue(undefined),
      enqueueGif: vi.fn().mockResolvedValue(undefined),
      enqueueMp3: vi.fn().mockResolvedValue(undefined),
    },
    storage: {
      upload: vi.fn(),
      download: vi.fn(),
      generatePresignedUrl: vi.fn(),
      objectExists: vi.fn(),
    },
  };
}

describe("CreateJobUseCase", () => {
  let mocks: ReturnType<typeof makeRepos>;
  let useCase: CreateJobUseCase;

  beforeEach(() => {
    mocks = makeRepos();
    useCase = new CreateJobUseCase(
      mocks.jobRepo as any,
      mocks.artifactRepo as any,
      mocks.queuePort as any,
      mocks.storage as any,
    );
  });

  it("throws INVALID_URL for non-TikTok URLs", async () => {
    await expect(useCase.execute("https://youtube.com/watch?v=abc")).rejects.toMatchObject({
      code: ErrorCode.INVALID_URL,
    });
  });

  it("creates job and enqueues on cache miss", async () => {
    mocks.artifactRepo.findByKey.mockResolvedValue(null);
    const result = await useCase.execute("https://tiktok.com/@user/video/123456789");
    expect(result.hit).toBe(false);
    expect(result.job).not.toBeNull();
    expect(mocks.jobRepo.save).toHaveBeenCalledOnce();
    expect(mocks.queuePort.enqueueDownload).toHaveBeenCalledOnce();
  });

  it("returns cache hit with presigned URL and persists a Job entity when artifact exists in S3", async () => {
    const fakeArtifact = {
      s3Key: "originals/abc/abc.mp4",
      duration: 42,
      title: "My TikTok video",
      thumbnailUrl: "https://cdn.example.com/thumb.jpg",
    };
    mocks.artifactRepo.findByKey.mockResolvedValue(fakeArtifact);
    mocks.storage.objectExists.mockResolvedValue(true);
    mocks.storage.generatePresignedUrl.mockResolvedValue("https://s3.example.com/signed");

    const result = await useCase.execute("https://tiktok.com/@user/video/123456789");
    expect(result.hit).toBe(true);
    expect(result.downloadUrl).toBe("https://s3.example.com/signed");
    expect(result.job).not.toBeNull();
    expect(result.job.jobId).toBeDefined();
    expect(mocks.jobRepo.save).toHaveBeenCalledOnce();
    // Verifica que los metadatos del artifact se propaguen al job guardado
    const savedJob = mocks.jobRepo.save.mock.calls[0][0];
    expect(savedJob.duration).toBe(42);
    expect(savedJob.title).toBe("My TikTok video");
    expect(savedJob.thumbnailUrl).toBe("https://cdn.example.com/thumb.jpg");
  });

  it("falls through to cache miss when artifact exists in DB but not in S3", async () => {
    const fakeArtifact = { s3Key: "originals/abc/abc.mp4" };
    mocks.artifactRepo.findByKey.mockResolvedValue(fakeArtifact);
    mocks.storage.objectExists.mockResolvedValue(false);

    const result = await useCase.execute("https://tiktok.com/@user/video/123456789");
    expect(result.hit).toBe(false);
    expect(mocks.queuePort.enqueueDownload).toHaveBeenCalledOnce();
  });
});
