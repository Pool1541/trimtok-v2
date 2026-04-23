import type { SQSHandler, SQSBatchResponse } from "aws-lambda";
import { JobDynamoRepo } from "../../jobs/infrastructure/dynamo/job.dynamo-repo.js";
import { ArtifactDynamoRepo } from "../../jobs/infrastructure/dynamo/artifact.dynamo-repo.js";
import { ArtifactStorageAdapter } from "../../jobs/infrastructure/s3/artifact-storage.adapter.js";
import { FfmpegAdapter } from "../../processing/infrastructure/ffmpeg.adapter.js";
import { ConnectionDynamoRepo } from "../../notifications/infrastructure/dynamo/connection.dynamo-repo.js";
import { WebSocketAdapter } from "../../notifications/infrastructure/apigw/websocket.adapter.js";
import { NotifyJobUpdateUseCase } from "../../notifications/application/notify-job-update.usecase.js";
import { ExtractMp3UseCase } from "../../processing/application/extract-mp3.usecase.js";
import { getDynamoClient, TABLE_NAME } from "../../shared/dynamo.client.js";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { processingEventSk, jobPk } from "../../shared/table-keys.js";
import { ulid } from "ulidx";
import { JobStatus } from "../../jobs/domain/job-status.js";
import { createLogger, withSqsRecordContext, setJobId } from "../../shared/logger/index.js";

const EVENT_TTL = 7 * 24 * 3600;
const logger = createLogger("workers/mp3-worker");

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
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    await withSqsRecordContext(record, "workers/mp3-worker", async () => {
      const msg = JSON.parse(record.body) as {
        jobId: string;
        videoId: string;
        s3Key: string;
        trimStart?: number;
        trimEnd?: number;
      };

      setJobId(msg.jobId);

      const jobRepo = new JobDynamoRepo();
      const job = await jobRepo.findById(msg.jobId).catch(() => null);
      if (!job) {
        logger.warn("job not found, skipping");
        return;
      }

      const useCase = new ExtractMp3UseCase(
        jobRepo,
        new ArtifactDynamoRepo(),
        new FfmpegAdapter(),
        new ArtifactStorageAdapter(),
        new NotifyJobUpdateUseCase(new ConnectionDynamoRepo(), new WebSocketAdapter(), jobRepo),
      );

      try {
        logger.debug("mp3_started");
        await writeEvent(msg.jobId, "mp3_started");
        await useCase.execute(msg.jobId, msg.videoId, msg.s3Key, msg.trimStart, msg.trimEnd);
        await writeEvent(msg.jobId, "mp3_completed");
        logger.info("mp3 completed");
      } catch (err) {
        logger.error({ err }, "error processing mp3");
        if (job.retryCount < 1) {
          logger.warn({ retryCount: job.retryCount }, "scheduling retry");
          await jobRepo.updateStatus(msg.jobId, job.status, { retryCount: job.retryCount + 1 });
          batchItemFailures.push({ itemIdentifier: record.messageId });
        } else {
          logger.error("max retries reached, marking job as failed");
          await jobRepo.updateStatus(msg.jobId, JobStatus.error, {
            errorMessage: err instanceof Error ? err.message : String(err),
          }).catch((e) => logger.error({ err: e }, "failed to update status"));
          await writeEvent(msg.jobId, "mp3_failed").catch((e) => logger.error({ err: e }, "failed to write mp3_failed event"));
          await new NotifyJobUpdateUseCase(
            new ConnectionDynamoRepo(), new WebSocketAdapter(), new JobDynamoRepo()
          ).execute(msg.jobId).catch((e) => logger.error({ err: e }, "failed to send error notification"));
        }
      }
    });
  }

  return { batchItemFailures };
};
