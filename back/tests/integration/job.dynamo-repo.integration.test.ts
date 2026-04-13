/**
 * Integration tests for JobDynamoRepo — requires DynamoDB Local running on port 8000.
 * Start with: docker run -p 8000:8000 amazon/dynamodb-local
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createTestTable, deleteTestTable, TEST_TABLE_NAME, TEST_REGION, DYNAMO_LOCAL_ENDPOINT } from "./setup.js";
import { JobStatus } from "../../src/jobs/domain/job-status.js";
import { createJob } from "../../src/jobs/domain/job.entity.js";

// Override the shared dynamo client to point to DynamoDB Local
const testRawClient = new DynamoDBClient({
  endpoint: DYNAMO_LOCAL_ENDPOINT,
  region: TEST_REGION,
  credentials: { accessKeyId: "fake", secretAccessKey: "fake" },
});
const testDocClient = DynamoDBDocumentClient.from(testRawClient, {
  marshallOptions: { removeUndefinedValues: true },
});

vi.mock("../../src/shared/dynamo.client.js", () => ({
  getDynamoClient: () => testDocClient,
  TABLE_NAME: TEST_TABLE_NAME,
}));

// Import AFTER mocking
const { JobDynamoRepo } = await import("../../src/jobs/infrastructure/dynamo/job.dynamo-repo.js");

describe("JobDynamoRepo (integration)", () => {
  let repo: InstanceType<typeof JobDynamoRepo>;

  beforeAll(async () => {
    await createTestTable(testDocClient);
    repo = new JobDynamoRepo();
  });

  afterAll(async () => {
    await deleteTestTable();
    await testRawClient.destroy();
  });

  it("saves and retrieves a job by ID", async () => {
    const job = createJob({ tiktokUrl: "https://tiktok.com/@u/video/abc", format: "mp4", videoId: "abc" });
    await repo.save(job);

    const found = await repo.findById(job.jobId);
    expect(found).not.toBeNull();
    expect(found?.jobId).toBe(job.jobId);
    expect(found?.status).toBe(JobStatus.pending);
  });

  it("returns null for non-existent job", async () => {
    const result = await repo.findById("nonexistent-id-xyz");
    expect(result).toBeNull();
  });

  it("updates job status", async () => {
    const job = createJob({ tiktokUrl: "https://tiktok.com/@u/video/def", format: "mp4", videoId: "def" });
    await repo.save(job);
    await repo.updateStatus(job.jobId, JobStatus.downloading);

    const found = await repo.findById(job.jobId);
    expect(found?.status).toBe(JobStatus.downloading);
  });

  it("acquireLock returns true on first call and false on second", async () => {
    const first = await repo.acquireLock("lockVideo1", "job1");
    expect(first).toBe(true);

    const second = await repo.acquireLock("lockVideo1", "job2");
    expect(second).toBe(false);
  });

  it("releaseLock allows locking again", async () => {
    await repo.acquireLock("lockVideo2", "job3");
    await repo.releaseLock("lockVideo2");

    const again = await repo.acquireLock("lockVideo2", "job4");
    expect(again).toBe(true);
    await repo.releaseLock("lockVideo2");
  });
});
