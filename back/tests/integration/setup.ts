import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  CreateTableCommand,
  DeleteTableCommand,
  ResourceNotFoundException,
  UpdateTimeToLiveCommand,
} from "@aws-sdk/client-dynamodb";

export const TEST_TABLE_NAME = "TrimtokTestTable";
export const TEST_REGION = "us-east-1";
export const DYNAMO_LOCAL_ENDPOINT = "http://localhost:8000";

export function createTestDocClient(): DynamoDBDocumentClient {
  const raw = new DynamoDBClient({
    endpoint: DYNAMO_LOCAL_ENDPOINT,
    region: TEST_REGION,
    credentials: { accessKeyId: "fake", secretAccessKey: "fake" },
  });
  return DynamoDBDocumentClient.from(raw, { marshallOptions: { removeUndefinedValues: true } });
}

export async function createTestTable(client: DynamoDBDocumentClient): Promise<void> {
  const raw = (client as any).config.requestHandler?.metadata?.client ?? (client as any)["innerClient"];
  // Access the underlying DynamoDBClient to run CreateTable
  const rawClient = new DynamoDBClient({
    endpoint: DYNAMO_LOCAL_ENDPOINT,
    region: TEST_REGION,
    credentials: { accessKeyId: "fake", secretAccessKey: "fake" },
  });

  await rawClient.send(
    new CreateTableCommand({
      TableName: TEST_TABLE_NAME,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
        { AttributeName: "gsi1pk", AttributeType: "S" },
        { AttributeName: "gsi1sk", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "gsi1",
          KeySchema: [
            { AttributeName: "gsi1pk", KeyType: "HASH" },
            { AttributeName: "gsi1sk", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
      ],
    }),
  );

  try {
    await rawClient.send(
      new UpdateTimeToLiveCommand({
        TableName: TEST_TABLE_NAME,
        TimeToLiveSpecification: { AttributeName: "expiresAt", Enabled: true },
      }),
    );
  } catch {
    // DynamoDB Local may not support TTL — ignore
  }

  await rawClient.destroy();
}

export async function deleteTestTable(): Promise<void> {
  const rawClient = new DynamoDBClient({
    endpoint: DYNAMO_LOCAL_ENDPOINT,
    region: TEST_REGION,
    credentials: { accessKeyId: "fake", secretAccessKey: "fake" },
  });

  try {
    await rawClient.send(new DeleteTableCommand({ TableName: TEST_TABLE_NAME }));
  } catch (err) {
    if (!(err instanceof ResourceNotFoundException)) throw err;
  } finally {
    await rawClient.destroy();
  }
}
