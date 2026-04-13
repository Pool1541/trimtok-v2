import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { JobDynamoRepo } from "../../jobs/infrastructure/dynamo/job.dynamo-repo.js";
import { ArtifactDynamoRepo } from "../../jobs/infrastructure/dynamo/artifact.dynamo-repo.js";
import { ArtifactStorageAdapter } from "../../jobs/infrastructure/s3/artifact-storage.adapter.js";
import { JobQueueAdapter } from "../../jobs/infrastructure/sqs/job-queue.adapter.js";
import { RequestGifUseCase } from "../../jobs/application/request-gif.usecase.js";
import type { AppError } from "../../shared/errors.js";

const app = new Hono();

const schema = z.object({
  trimStart: z.number().min(0).optional(),
  trimEnd: z.number().positive().optional(),
});

app.post(
  "/v1/jobs/:jobId/gif",
  zValidator("json", schema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", details: result.error.issues } }, 400);
    }
  }),
  async (c) => {
    const jobId = c.req.param("jobId");
    const { trimStart, trimEnd } = c.req.valid("json");

    const useCase = new RequestGifUseCase(
      new JobDynamoRepo(),
      new ArtifactDynamoRepo(),
      new JobQueueAdapter(),
      new ArtifactStorageAdapter(),
    );

    try {
      const result = await useCase.execute(jobId, trimStart, trimEnd);
      if (result.hit) {
        return c.json({ status: "gif_created", downloadUrl: result.downloadUrl }, 200);
      }
      return c.json({ status: "creating_gif" }, 202);
    } catch (err) {
      const e = err as AppError;
      if (e.name === "AppError") {
        return c.json({ error: { code: e.code, message: e.message } }, e.httpStatus as 400 | 404 | 409);
      }
      throw err;
    }
  },
);

export const handler = handle(app);
