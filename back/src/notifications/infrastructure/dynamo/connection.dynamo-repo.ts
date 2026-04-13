import { PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoClient, TABLE_NAME } from "../../../shared/dynamo.client.js";
import { connPk, connSk, gsi1Pk, gsi1Sk } from "../../../shared/table-keys.js";
import type { IConnectionRepository, WebSocketConnection } from "../../application/ports/connection.repository.js";

const CONN_TTL_SECONDS = 24 * 3600; // 24 hours

export class ConnectionDynamoRepo implements IConnectionRepository {
  private get client() { return getDynamoClient(); }

  async save(conn: WebSocketConnection): Promise<void> {
    const item = {
      ...conn,
      pk: connPk(conn.connectionId),
      sk: connSk(),
      expiresAt: Math.floor(Date.now() / 1000) + CONN_TTL_SECONDS,
    };
    await this.client.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  }

  async updateSubscription(connId: string, jobId: string): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: connPk(connId), sk: connSk() },
        UpdateExpression: "SET jobId = :jobId, gsi1pk = :gsi1pk, gsi1sk = :gsi1sk",
        ExpressionAttributeValues: {
          ":jobId": jobId,
          ":gsi1pk": gsi1Pk(jobId),
          ":gsi1sk": gsi1Sk(connId),
        },
      }),
    );
  }

  async delete(connId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({ TableName: TABLE_NAME, Key: { pk: connPk(connId), sk: connSk() } }),
    );
  }

  async findByJobId(jobId: string): Promise<WebSocketConnection[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :gsi1pk",
        ExpressionAttributeValues: { ":gsi1pk": gsi1Pk(jobId) },
      }),
    );
    return (result.Items ?? []) as WebSocketConnection[];
  }
}
