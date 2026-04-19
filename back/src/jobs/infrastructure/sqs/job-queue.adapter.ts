import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Resource } from "sst";
import type { IJobQueuePort, DownloadMessage, TrimMessage, GifMessage, Mp3Message } from "../../application/ports/job-queue.port.js";

const sqs = new SQSClient({});

const r = Resource as unknown as Record<string, { url: string }>;

export class JobQueueAdapter implements IJobQueuePort {
  async enqueueDownload(msg: DownloadMessage, correlationId: string): Promise<void> {
    await sqs.send(new SendMessageCommand({
      QueueUrl: r["DownloadQueue"].url,
      MessageBody: JSON.stringify(msg),
      MessageAttributes: {
        "CorrelationId": {
          DataType: "String",
          StringValue: correlationId,
        },
      },
    }));
  }

  async enqueueTrim(msg: TrimMessage, correlationId: string): Promise<void> {
    await sqs.send(new SendMessageCommand({
      QueueUrl: r["TrimQueue"].url,
      MessageBody: JSON.stringify(msg),
      MessageAttributes: {
        "CorrelationId": {
          DataType: "String",
          StringValue: correlationId,
        },
      },
    }));
  }

  async enqueueGif(msg: GifMessage, correlationId: string): Promise<void> {
    await sqs.send(new SendMessageCommand({
      QueueUrl: r["GifQueue"].url,
      MessageBody: JSON.stringify(msg),
      MessageAttributes: {
        "CorrelationId": {
          DataType: "String",
          StringValue: correlationId,
        },
      },
    }));
  }

  async enqueueMp3(msg: Mp3Message, correlationId: string): Promise<void> {
    await sqs.send(new SendMessageCommand({
      QueueUrl: r["Mp3Queue"].url,
      MessageBody: JSON.stringify(msg),
      MessageAttributes: {
        "CorrelationId": {
          DataType: "String",
          StringValue: correlationId,
        },
      },
    }));
  }
}
