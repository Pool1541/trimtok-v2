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

const NON_RETRIABLE_CODES = new Set<ErrorCode>([
  ErrorCode.VIDEO_TOO_LONG,
  ErrorCode.INVALID_URL,
]);

const EVENT_TTL = 7 * 24 * 3600;

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
  console.log("[download-worker] handler invoked, records:", event.Records.length);
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    const correlationId = record.messageAttributes?.CorrelationId?.stringValue ?? "unknown";
    let msg: { jobId: string; tiktokUrl: string; format: "mp4" | "mp3" };
    try {
      msg = JSON.parse(record.body) as typeof msg;
    } catch (parseErr) {
      console.error("[download-worker] Failed to parse SQS message body:", record.body, parseErr, { correlationId });
      continue;
    }

    console.log("[download-worker] Processing message:", { jobId: msg.jobId, tiktokUrl: msg.tiktokUrl, format: msg.format, correlationId });

    const jobRepo = new JobDynamoRepo();
    const artifactRepo = new ArtifactDynamoRepo();
    const storage = new ArtifactStorageAdapter();
    const downloader = new YtDlpAdapter();
    const connRepo = new ConnectionDynamoRepo();
    const wsAdapter = new WebSocketAdapter();
    const notifier = new NotifyJobUpdateUseCase(connRepo, wsAdapter, jobRepo);
    const useCase = new DownloadVideoUseCase(jobRepo, artifactRepo, downloader, storage, notifier);

    try {
      console.log("[download-worker] Fetching job from DB:", { jobId: msg.jobId, correlationId });
      const job = await jobRepo.findById(msg.jobId);
      if (!job) {
        console.warn("[download-worker] Job not found in DB, skipping:", { jobId: msg.jobId, correlationId });
        continue;
      }
      console.log("[download-worker] Job found:", { status: job.status, retryCount: job.retryCount, videoId: job.videoId, correlationId });

      const videoId = job.videoId ?? msg.jobId;
      console.log("[download-worker] Writing download_started event", { correlationId });
      await writeEvent(msg.jobId, "download_started");

      console.log("[download-worker] Executing DownloadVideoUseCase");
      const processed = await useCase.execute(msg.jobId, msg.tiktokUrl, videoId, msg.format);

      if (!processed) {
        // Lock not acquired — another worker is already downloading this video.
        // Retry via SQS batchItemFailures so the job is not left stuck in "pending".
        console.warn("[download-worker] Lock not acquired for job, scheduling SQS retry:", { jobId: msg.jobId, correlationId });
        batchItemFailures.push({ itemIdentifier: record.messageId });
        continue;
      }

      console.log("[download-worker] DownloadVideoUseCase completed successfully");
      await writeEvent(msg.jobId, "download_completed");
      // NOTE: notifier.execute() was already called inside DownloadVideoUseCase — do NOT call it again.
      console.log("[download-worker] Job finished successfully:", { jobId: msg.jobId, correlationId });
    } catch (err) {
      console.error("[download-worker] Error processing job:", { jobId: msg.jobId, correlationId, error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err) });

      const isNonRetriable = err instanceof AppError && NON_RETRIABLE_CODES.has(err.code);

      if (isNonRetriable) {
        console.error("[download-worker] Non-retriable error (", err.code, "), marking job as error immediately:", { jobId: msg.jobId, correlationId });
        await new JobDynamoRepo().updateStatus(msg.jobId, JobStatus.error, {
          errorMessage: err.message,
        }).catch((e) => console.error("[download-worker] Failed to update job status to error:", { jobId: msg.jobId, correlationId, error: e }));
        await writeEvent(msg.jobId, "download_failed").catch((e) => console.error("[download-worker] Failed to write download_failed event:", { jobId: msg.jobId, correlationId, error: e }));
        await new NotifyJobUpdateUseCase(
          new ConnectionDynamoRepo(),
          new WebSocketAdapter(),
          new JobDynamoRepo(),
        ).execute(msg.jobId).catch((e) => console.error("[download-worker] Failed to send error notification:", { jobId: msg.jobId, correlationId, error: e }));
      } else {
        const job = await new JobDynamoRepo().findById(msg.jobId).catch(() => null);
        if (job && job.retryCount < 1) {
          console.warn("[download-worker] Scheduling retry (retryCount:", job.retryCount, ") for job:", { jobId: msg.jobId, correlationId });
          await new JobDynamoRepo().updateStatus(msg.jobId, job.status, {
            retryCount: job.retryCount + 1,
          }).catch((e) => console.error("[download-worker] Failed to update retryCount:", { jobId: msg.jobId, correlationId, error: e }));
          batchItemFailures.push({ itemIdentifier: record.messageId });
        } else {
          console.error("[download-worker] Max retries reached, marking job as error:", { jobId: msg.jobId, correlationId });
          await new JobDynamoRepo().updateStatus(msg.jobId, JobStatus.error, {
            errorMessage: err instanceof Error ? err.message : String(err),
          }).catch((e) => console.error("[download-worker] Failed to update job status to error:", { jobId: msg.jobId, correlationId, error: e }));
          await writeEvent(msg.jobId, "download_failed").catch((e) => console.error("[download-worker] Failed to write download_failed event:", { jobId: msg.jobId, correlationId, error: e }));
          await new NotifyJobUpdateUseCase(
            new ConnectionDynamoRepo(),
            new WebSocketAdapter(),
            new JobDynamoRepo(),
          ).execute(msg.jobId).catch((e) => console.error("[download-worker] Failed to send error notification:", { jobId: msg.jobId, correlationId, error: e }));
        }
      }
    }
  }

  console.log("[download-worker] Batch done, failures:", batchItemFailures.length);
  return { batchItemFailures };
};
