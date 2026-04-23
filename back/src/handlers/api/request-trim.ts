import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { JobDynamoRepo } from "../../jobs/infrastructure/dynamo/job.dynamo-repo.js";
import { ArtifactDynamoRepo } from "../../jobs/infrastructure/dynamo/artifact.dynamo-repo.js";
import { ArtifactStorageAdapter } from "../../jobs/infrastructure/s3/artifact-storage.adapter.js";
import { JobQueueAdapter } from "../../jobs/infrastructure/sqs/job-queue.adapter.js";
import { RequestTrimUseCase } from "../../jobs/application/request-trim.usecase.js";
import type { AppError } from "../../shared/errors.js";
import { correlationMiddleware, createLogger } from "../../shared/logger/index.js";

const app = new Hono();
const logger = createLogger("api/request-trim");

app.use(correlationMiddleware("api/request-trim"));

const schema = z.object({
  trimStart: z.number().min(0).transform(Math.floor),
  trimEnd: z.number().positive().transform(Math.floor),
});

app.post(
  "/v1/jobs/:jobId/trim",
  zValidator("json", schema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", details: result.error.issues } }, 400);
    }
  }),
  async (c) => {
    const jobId = c.req.param("jobId");
    const { trimStart, trimEnd } = c.req.valid("json");

    const useCase = new RequestTrimUseCase(
      new JobDynamoRepo(),
      new ArtifactDynamoRepo(),
      new JobQueueAdapter(),
      new ArtifactStorageAdapter(),
    );

    logger.debug({ jobId, trimStart, trimEnd }, "request-trim");
    try {
      const result = await useCase.execute(jobId, trimStart, trimEnd);
      if (result.hit) {
        logger.info({ jobId, hit: true }, "trim cache hit");
        return c.json({ status: "trimmed", downloadUrl: result.downloadUrl }, 200);
      }
      logger.info({ jobId, childJobId: result.childJobId }, "trim enqueued");
      return c.json({ status: "trimming", jobId: result.childJobId }, 202);
    } catch (err) {
      const e = err as AppError;
      if (e.name === "AppError") {
        logger.warn({ jobId, code: e.code }, e.message);
        return c.json({ error: { code: e.code, message: e.message } }, e.httpStatus as 400 | 404 | 409);
      }
      logger.error({ jobId, err }, "unhandled error in request-trim");
      throw err;
    }
  },
);

export const handler = handle(app);
