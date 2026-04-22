import type { SQSRecord } from "aws-lambda";
import { runWithContext } from "./context.js";

/**
 * Wraps the processing of a single SQS record with a log context that
 * carries the correlationId propagated via the MessageAttribute "CorrelationId".
 *
 * Usage:
 *   for (const record of event.Records) {
 *     await withSqsRecordContext(record, "workers/download-worker", async () => {
 *       setJobId(msg.jobId);
 *       // ... processing logic
 *     });
 *   }
 */
export function withSqsRecordContext<T>(
  record: SQSRecord,
  handlerName: string,
  fn: () => Promise<T>,
): Promise<T> {
  const correlationId =
    record.messageAttributes?.["CorrelationId"]?.stringValue ?? "unknown";
  return runWithContext({ correlationId, handler: handlerName }, fn);
}
