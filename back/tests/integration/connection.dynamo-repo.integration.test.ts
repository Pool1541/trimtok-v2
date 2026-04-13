/**
 * Integration tests for ConnectionDynamoRepo — requires DynamoDB Local on port 8000.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createTestTable, deleteTestTable, TEST_TABLE_NAME, TEST_REGION, DYNAMO_LOCAL_ENDPOINT } from "./setup.js";

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

const { ConnectionDynamoRepo } = await import(
  "../../src/notifications/infrastructure/dynamo/connection.dynamo-repo.js"
);

describe("ConnectionDynamoRepo (integration)", () => {
  let repo: InstanceType<typeof ConnectionDynamoRepo>;

  beforeAll(async () => {
    await createTestTable(testDocClient);
    repo = new ConnectionDynamoRepo();
  });

  afterAll(async () => {
    await deleteTestTable();
    await testRawClient.destroy();
  });

  it("saves a new connection", async () => {
    const conn = { pk: "", sk: "", type: "CONN" as const, connectionId: "conn-int-1", connectedAt: new Date().toISOString(), expiresAt: 0 };
    await repo.save(conn);
    // Just verify no error thrown
  });

  it("updates subscription and allows finding by jobId", async () => {
    const conn = { pk: "", sk: "", type: "CONN" as const, connectionId: "conn-int-2", connectedAt: new Date().toISOString(), expiresAt: 0 };
    await repo.save(conn);
    await repo.updateSubscription("conn-int-2", "job-abc-123");

    const conns = await repo.findByJobId("job-abc-123");
    expect(conns.length).toBeGreaterThan(0);
    expect(conns[0].connectionId).toBe("conn-int-2");
  });

  it("returns empty array for jobId with no subscribers", async () => {
    const conns = await repo.findByJobId("no-subscribers-job-id");
    expect(conns).toEqual([]);
  });

  it("deletes a connection", async () => {
    const conn = { pk: "", sk: "", type: "CONN" as const, connectionId: "conn-int-3", connectedAt: new Date().toISOString(), expiresAt: 0 };
    await repo.save(conn);
    await repo.updateSubscription("conn-int-3", "job-del-test");

    await repo.delete("conn-int-3");

    // After deletion, findByJobId should not return this connection
    const conns = await repo.findByJobId("job-del-test");
    const found = conns.find((c) => c.connectionId === "conn-int-3");
    expect(found).toBeUndefined();
  });
});
