import type { SQSHandler, SQSBatchResponse } from "aws-lambda";
import { JobDynamoRepo } from "../../jobs/infrastructure/dynamo/job.dynamo-repo.js";
import { ArtifactDynamoRepo } from "../../jobs/infrastructure/dynamo/artifact.dynamo-repo.js";
import { ArtifactStorageAdapter } from "../../jobs/infrastructure/s3/artifact-storage.adapter.js";
import { YtDlpAdapter } from "../../processing/infrastructure/ytdlp.adapter.js";
import { ConnectionDynamoRepo } from "../../notifications/infrastructure/dynamo/connection.dynamo-repo.js";
import { WebSocketAdapter } from "../../notifications/infrastructure/apigw/websocket.adapter.js";
import { NotifyJobUpdateUseCase } from "../../notifications/application/notify-job-update.usecase.js";
import { DownloadVideoUseCase } from "../../processing/application/download-video.usecase.js";
import { getDynamoClient, TABLE_NAME } from "../../shared/dynamo.client.js";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { processingEventSk, jobPk } from "../../shared/table-keys.js";
import { ulid } from "ulidx";
import { JobStatus } from "../../jobs/domain/job-status.js";
import { AppError, ErrorCode } from "../../shared/errors.js";
import { createLogger, withSqsRecordContext, setJobId } from "../../shared/logger/index.js";

const NON_RETRIABLE_CODES = new Set<ErrorCode>([
  ErrorCode.VIDEO_TOO_LONG,
  ErrorCode.INVALID_URL,
]);

const EVENT_TTL = 7 * 24 * 3600;
const logger = createLogger("workers/download-worker");

async function writeEvent(jobId: string, eventType: string): Promise<void> {
  const now = new Date().toISOString();
  await getDynamoClient().send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: jobPk(jobId),
        sk: processingEventSk(now, ulid()),
        type: "EVENT",
        eventType,
        jobId,
        createdAt: now,
        expiresAt: Math.floor(Date.now() / 1000) + EVENT_TTL,
      },
    }),
  );
}

export const handler: SQSHandler = async (event): Promise<SQSBatchResponse> => {
  logger.info({ count: event.Records.length }, "batch received");
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    await withSqsRecordContext(record, "workers/download-worker", async () => {
      let msg: { jobId: string; tiktokUrl: string; format: "mp4" | "mp3" };
      try {
        msg = JSON.parse(record.body) as typeof msg;
      } catch (parseErr) {
        logger.error({ body: record.body, err: parseErr }, "failed to parse SQS message body");
        return;
      }

      setJobId(msg.jobId);
      logger.info({ tiktokUrl: msg.tiktokUrl, format: msg.format }, "processing message");

      const jobRepo = new JobDynamoRepo();
      const artifactRepo = new ArtifactDynamoRepo();
      const storage = new ArtifactStorageAdapter();
      const downloader = new YtDlpAdapter();
      const connRepo = new ConnectionDynamoRepo();
      const wsAdapter = new WebSocketAdapter();
      const notifier = new NotifyJobUpdateUseCase(connRepo, wsAdapter, jobRepo);
      const useCase = new DownloadVideoUseCase(jobRepo, artifactRepo, downloader, storage, notifier);

      try {
        logger.debug("fetching job from DB");
        const job = await jobRepo.findById(msg.jobId);
        if (!job) {
          logger.warn("job not found in DB, skipping");
          return;
        }
        logger.debug({ status: job.status, retryCount: job.retryCount, videoId: job.videoId }, "job found");

        const videoId = job.videoId ?? msg.jobId;
        logger.debug("writing download_started event");
        await writeEvent(msg.jobId, "download_started");

        logger.debug("executing DownloadVideoUseCase");
        const processed = await useCase.execute(msg.jobId, msg.tiktokUrl, videoId, msg.format);

        if (!processed) {
          logger.warn("lock not acquired, scheduling SQS retry");
          batchItemFailures.push({ itemIdentifier: record.messageId });
          return;
        }

        await writeEvent(msg.jobId, "download_completed");
        logger.info("job finished successfully");
      } catch (err) {
        logger.error({ err }, "error processing job");

        const isNonRetriable = err instanceof AppError && NON_RETRIABLE_CODES.has(err.code);

        if (isNonRetriable) {
          logger.error({ code: (err as AppError).code }, "non-retriable error, marking job as failed");
          await new JobDynamoRepo().updateStatus(msg.jobId, JobStatus.error, {
            errorMessage: (err as AppError).message,
          }).catch((e) => logger.error({ err: e }, "failed to update job status to error"));
          await writeEvent(msg.jobId, "download_failed").catch((e) => logger.error({ err: e }, "failed to write download_failed event"));
          await new NotifyJobUpdateUseCase(
            new ConnectionDynamoRepo(),
            new WebSocketAdapter(),
            new JobDynamoRepo(),
          ).execute(msg.jobId).catch((e) => logger.error({ err: e }, "failed to send error notification"));
        } else {
          const job = await new JobDynamoRepo().findById(msg.jobId).catch(() => null);
          if (job && job.retryCount < 1) {
            logger.warn({ retryCount: job.retryCount }, "scheduling retry");
            await new JobDynamoRepo().updateStatus(msg.jobId, job.status, {
              retryCount: job.retryCount + 1,
            }).catch((e) => logger.error({ err: e }, "failed to update retryCount"));
            batchItemFailures.push({ itemIdentifier: record.messageId });
          } else {
            logger.error("max retries reached, marking job as failed");
            await new JobDynamoRepo().updateStatus(msg.jobId, JobStatus.error, {
              errorMessage: err instanceof Error ? err.message : String(err),
            }).catch((e) => logger.error({ err: e }, "failed to update job status to error"));
            await writeEvent(msg.jobId, "download_failed").catch((e) => logger.error({ err: e }, "failed to write download_failed event"));
            await new NotifyJobUpdateUseCase(
              new ConnectionDynamoRepo(),
              new WebSocketAdapter(),
              new JobDynamoRepo(),
            ).execute(msg.jobId).catch((e) => logger.error({ err: e }, "failed to send error notification"));
          }
        }
      }
    });
  }

  logger.debug({ failures: batchItemFailures.length }, "batch done");
  return { batchItemFailures };
};
