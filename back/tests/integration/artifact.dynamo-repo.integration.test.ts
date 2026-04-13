/**
 * Integration tests for ArtifactDynamoRepo — requires DynamoDB Local on port 8000.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createTestTable, deleteTestTable, TEST_TABLE_NAME, TEST_REGION, DYNAMO_LOCAL_ENDPOINT } from "./setup.js";
import { artifactPk, artifactSk } from "../../src/shared/table-keys.js";

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

const { ArtifactDynamoRepo } = await import("../../src/jobs/infrastructure/dynamo/artifact.dynamo-repo.js");

describe("ArtifactDynamoRepo (integration)", () => {
  let repo: InstanceType<typeof ArtifactDynamoRepo>;

  beforeAll(async () => {
    await createTestTable(testDocClient);
    repo = new ArtifactDynamoRepo();
  });

  afterAll(async () => {
    await deleteTestTable();
    await testRawClient.destroy();
  });

  it("returns null when artifact does not exist", async () => {
    const result = await repo.findByKey("noVideo", "mp4", "original");
    expect(result).toBeNull();
  });

  it("saves and retrieves an artifact", async () => {
    const now = new Date().toISOString();
    const artifact = {
      pk: artifactPk("vid999"),
      sk: artifactSk("mp4", "original"),
      type: "ARTIFACT" as const,
      videoId: "vid999",
      tiktokUrl: "https://tiktok.com/video/vid999",
      format: "mp4" as const,
      artifactType: "original" as const,
      s3Key: "originals/vid999/vid999.mp4",
      fileSizeBytes: 5000000,
      downloadCount: 0,
      createdAt: now,
      expiresAt: Math.floor(Date.now() / 1000) + 172800,
    };

    await repo.save(artifact);
    const found = await repo.findByKey("vid999", "mp4", "original");
    expect(found).not.toBeNull();
    expect(found?.s3Key).toBe("originals/vid999/vid999.mp4");
    expect(found?.videoId).toBe("vid999");
  });

  it("increments download count", async () => {
    const now = new Date().toISOString();
    const artifact = {
      pk: artifactPk("vid888"),
      sk: artifactSk("mp4", "original"),
      type: "ARTIFACT" as const,
      videoId: "vid888",
      tiktokUrl: "https://tiktok.com/video/vid888",
      format: "mp4" as const,
      artifactType: "original" as const,
      s3Key: "originals/vid888/vid888.mp4",
      fileSizeBytes: 3000000,
      downloadCount: 0,
      createdAt: now,
      expiresAt: Math.floor(Date.now() / 1000) + 172800,
    };

    await repo.save(artifact);
    await repo.incrementDownloadCount("vid888", "mp4", "original");

    const found = await repo.findByKey("vid888", "mp4", "original");
    expect(found?.downloadCount).toBe(1);
  });
});
