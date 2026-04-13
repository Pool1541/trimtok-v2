import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

let _client: DynamoDBDocumentClient | undefined;

export function getDynamoClient(): DynamoDBDocumentClient {
  if (!_client) {
    const base = new DynamoDBClient({});
    _client = DynamoDBDocumentClient.from(base, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _client;
}

export const TABLE_NAME: string = (Resource as unknown as Record<string, { name: string }>)["TrimtokTable"].name;
