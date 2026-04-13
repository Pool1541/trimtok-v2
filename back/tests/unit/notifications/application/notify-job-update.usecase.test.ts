import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotifyJobUpdateUseCase } from "../../../../src/notifications/application/notify-job-update.usecase.js";
import { JobStatus } from "../../../../src/jobs/domain/job-status.js";

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    pk: "JOB#01ABC", sk: "METADATA", type: "JOB",
    jobId: "01ABC", videoId: "vid123",
    tiktokUrl: "https://tiktok.com/@u/video/vid123",
    status: JobStatus.ready, format: "mp4",
    retryCount: 0, createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(), expiresAt: 9999999999,
    ...overrides,
  };
}

function makeMocks() {
  return {
    connRepo: {
      findByJobId: vi.fn().mockResolvedValue([]),
      save: vi.fn(), updateSubscription: vi.fn(), delete: vi.fn().mockResolvedValue(undefined),
    },
    wsAdapter: { send: vi.fn().mockResolvedValue(undefined) },
    jobReader: { findById: vi.fn() },
  };
}

describe("NotifyJobUpdateUseCase", () => {
  let mocks: ReturnType<typeof makeMocks>;
  let useCase: NotifyJobUpdateUseCase;

  beforeEach(() => {
    mocks = makeMocks();
    useCase = new NotifyJobUpdateUseCase(
      mocks.connRepo as any, mocks.wsAdapter as any, mocks.jobReader as any,
    );
  });

  it("does nothing when job is not found", async () => {
    mocks.jobReader.findById.mockResolvedValue(null);
    await useCase.execute("job1");
    expect(mocks.connRepo.findByJobId).not.toHaveBeenCalled();
  });

  it("does nothing when there are no connections", async () => {
    mocks.jobReader.findById.mockResolvedValue(makeJob());
    mocks.connRepo.findByJobId.mockResolvedValue([]);
    await useCase.execute("job1");
    expect(mocks.wsAdapter.send).not.toHaveBeenCalled();
  });

  it("sends to all connections", async () => {
    mocks.jobReader.findById.mockResolvedValue(makeJob());
    mocks.connRepo.findByJobId.mockResolvedValue([
      { connectionId: "conn1", jobId: "01ABC" },
      { connectionId: "conn2", jobId: "01ABC" },
    ]);

    await useCase.execute("01ABC");
    expect(mocks.wsAdapter.send).toHaveBeenCalledTimes(2);
  });

  it("deletes stale connection on GoneException", async () => {
    mocks.jobReader.findById.mockResolvedValue(makeJob());
    mocks.connRepo.findByJobId.mockResolvedValue([{ connectionId: "conn1", jobId: "01ABC" }]);
    mocks.wsAdapter.send.mockRejectedValue(new Error("GoneException: Connection gone"));

    await useCase.execute("01ABC");
    expect(mocks.connRepo.delete).toHaveBeenCalledWith("conn1");
  });

  it("includes s3Key in payload when job has terminal status with artifact", async () => {
    const job = makeJob({ status: JobStatus.ready, s3Key: "originals/vid123/vid123.mp4" });
    mocks.jobReader.findById.mockResolvedValue(job);
    mocks.connRepo.findByJobId.mockResolvedValue([{ connectionId: "conn1", jobId: "01ABC" }]);

    await useCase.execute("01ABC");

    const payload = mocks.wsAdapter.send.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.s3Key).toBe("originals/vid123/vid123.mp4");
  });
});
