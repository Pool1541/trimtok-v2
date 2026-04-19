import { Hono, Context } from "hono";
import { handle } from "hono/aws-lambda";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { JobDynamoRepo } from "../../jobs/infrastructure/dynamo/job.dynamo-repo.js";
import { ArtifactDynamoRepo } from "../../jobs/infrastructure/dynamo/artifact.dynamo-repo.js";
import { ArtifactStorageAdapter } from "../../jobs/infrastructure/s3/artifact-storage.adapter.js";
import { JobQueueAdapter } from "../../jobs/infrastructure/sqs/job-queue.adapter.js";
import { CreateJobUseCase } from "../../jobs/application/create-job.usecase.js";
import { getDynamoClient, TABLE_NAME } from "../../shared/dynamo.client.js";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { rateLimitExceeded } from "../../shared/errors.js";
import { rateLimitPk, rateLimitSk } from "../../shared/table-keys.js";
import type { AppError } from "../../shared/errors.js";

const app = new Hono();

const schema = z.object({
  tiktokUrl: z.string().url(),
  format: z.enum(["mp4", "mp3"]).default("mp4"),
});

app.post(
  "/v1/jobs",
  zValidator("json", schema, (result, c: Context) => {
    if (!result.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", details: result.error.issues } }, 400);
    }
  }),
  async (c) => {
    // Rate-limit check: 10 req/min per IP
    const requestContext = (c.env as Record<string, unknown>)?.["requestContext"] as
      | { identity?: { sourceIp?: string } }
      | undefined;
    const clientIp =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      requestContext?.identity?.sourceIp ??
      "unknown";

    const correlationId = randomUUID();

    try {
      await getDynamoClient().send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { pk: rateLimitPk(clientIp), sk: rateLimitSk() },
          UpdateExpression: `
          SET #count = 
            if_not_exists(#count, :zero) + :one,
              #expiresAt = 
            if_not_exists(#expiresAt, :exp)
          `,
          ConditionExpression: `
          attribute_not_exists(#count)
          OR #count < :limit
        `,
          ExpressionAttributeNames: {
            "#count": "count",
            "#expiresAt": "expiresAt",
          },
          ExpressionAttributeValues: {
            ":one": 1,
            ":zero": 0,
            ":limit": 10,
            ":exp": Math.floor(Date.now() / 1000) + 60,
          },
        }),
      );
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        const e = rateLimitExceeded();
        return c.json({ error: { code: e.code } }, 429, { "Retry-After": "60" });
      }
      throw err;
    }

    const body = c.req.valid("json");
    const useCase = new CreateJobUseCase(
      new JobDynamoRepo(),
      new ArtifactDynamoRepo(),
      new JobQueueAdapter(),
      new ArtifactStorageAdapter(),
    );

    try {
      const result = await useCase.execute(body.tiktokUrl, body.format, correlationId);
      if (result.hit) {
        return c.json({ jobId: result.job.jobId, status: "ready" as const, downloadUrl: result.downloadUrl }, 200);
      }
      const job = result.job;
      return c.json({ jobId: job.jobId, status: job.status }, 201);
    } catch (err) {
      const e = err as AppError;
      if (e.name === "AppError") {
        return c.json({ error: { code: e.code, message: e.message } }, e.httpStatus as 400 | 422);
      }
      throw err;
    }
  },
);

export const handler = handle(app);
