import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  type PutCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { getDynamoClient, TABLE_NAME } from "../../../shared/dynamo.client.js";
import { jobPk, jobSk, lockPk, lockSk } from "../../../shared/table-keys.js";
import type { IJobRepository } from "../../application/ports/job.repository.js";
import type { Job } from "../../domain/job.entity.js";
import type { JobStatus } from "../../domain/job-status.js";

export class JobDynamoRepo implements IJobRepository {
  private get client() { return getDynamoClient(); }

  async save(job: Job): Promise<void> {
    await this.client.send(new PutCommand({ TableName: TABLE_NAME, Item: job }));
  }

  async findById(jobId: string): Promise<Job | null> {
    const result = await this.client.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { pk: jobPk(jobId), sk: jobSk() } }),
    );
    return (result.Item as Job) ?? null;
  }

  async updateStatus(jobId: string, status: JobStatus, extra?: Partial<Job>): Promise<void> {
    const now = new Date().toISOString();
    const extraKeys = extra ? Object.keys(extra) : [];
    const setExpressions = ["#status = :status", "#updatedAt = :updatedAt"];
    const exprAttrNames: Record<string, string> = { "#status": "status", "#updatedAt": "updatedAt" };
    const exprAttrValues: Record<string, unknown> = { ":status": status, ":updatedAt": now };

    for (const key of extraKeys) {
      const safe = `#${key}`;
      setExpressions.push(`${safe} = :${key}`);
      exprAttrNames[safe] = key;
      exprAttrValues[`:${key}`] = (extra as Record<string, unknown>)[key];
    }

    await this.client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: jobPk(jobId), sk: jobSk() },
        UpdateExpression: `SET ${setExpressions.join(", ")}`,
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: exprAttrValues,
      }),
    );
  }

  async acquireLock(videoId: string, jobId: string): Promise<boolean> {
    const expiresAt = Math.floor(Date.now() / 1000) + 600; // 10 minutes
    try {
      const item: PutCommandInput = {
        TableName: TABLE_NAME,
        Item: {
          pk: lockPk(videoId),
          sk: lockSk(),
          type: "LOCK",
          jobId,
          expiresAt,
        },
        ConditionExpression: "attribute_not_exists(pk)",
      };
      await this.client.send(new PutCommand(item));
      return true;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return false;
      throw err;
    }
  }

  async releaseLock(videoId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({ TableName: TABLE_NAME, Key: { pk: lockPk(videoId), sk: lockSk() } }),
    );
  }
}
