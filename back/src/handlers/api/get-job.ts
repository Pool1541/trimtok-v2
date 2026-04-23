import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { JobDynamoRepo } from "../../jobs/infrastructure/dynamo/job.dynamo-repo.js";
import { ArtifactStorageAdapter } from "../../jobs/infrastructure/s3/artifact-storage.adapter.js";
import { GetJobUseCase } from "../../jobs/application/get-job.usecase.js";
import type { AppError } from "../../shared/errors.js";
import { correlationMiddleware, createLogger } from "../../shared/logger/index.js";

const app = new Hono();
const logger = createLogger("api/get-job");

app.use(correlationMiddleware("api/get-job"));

app.get("/v1/jobs/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  if (!jobId) return c.json({ error: { code: "VALIDATION_ERROR", message: "jobId is required" } }, 400);

  const useCase = new GetJobUseCase(new JobDynamoRepo(), new ArtifactStorageAdapter());

  try {
    logger.debug({ jobId }, "get-job request");
    const { job, downloadUrl } = await useCase.execute(jobId);
    return c.json({
      jobId: job.jobId,
      status: job.status,
      format: job.format,
      title: job.title,
      duration: job.duration,
      thumbnailUrl: job.thumbnailUrl,
      trimStart: job.trimStart,
      trimEnd: job.trimEnd,
      downloadUrl,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (err) {
    const e = err as AppError;
    if (e.name === "AppError") {
      logger.warn({ jobId, code: e.code }, e.message);
      return c.json({ error: { code: e.code, message: e.message } }, e.httpStatus as 404);
    }
    logger.error({ jobId, err }, "unhandled error in get-job");
    throw err;
  }
});

export const handler = handle(app);
