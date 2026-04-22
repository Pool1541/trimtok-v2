import pino from "pino";
import { getContext } from "./context.js";

/**
 * sync:true guarantees all log lines are flushed to stdout before Lambda
 * freezes the execution environment. Without this, the last few log lines
 * can be silently dropped.
 */
const destination = pino.destination({ fd: 1, sync: true });

export function createLogger(handlerName: string) {
  return pino(
    {
      level: process.env["LOG_LEVEL"] ?? "info",
      base: {
        service: "trimtok",
        env: process.env["SST_STAGE"] ?? process.env["NODE_ENV"] ?? "local",
        region: process.env["AWS_REGION"] ?? "local",
        handler: handlerName,
      },
      mixin(_mergeObject: object, _level: number): Record<string, unknown> {
        const ctx = getContext();
        if (!ctx) return {};
        const result: Record<string, unknown> = { correlationId: ctx.correlationId };
        if (ctx.jobId) result["jobId"] = ctx.jobId;
        return result;
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level(label) {
          return { level: label };
        },
      },
    },
    destination,
  );
}
