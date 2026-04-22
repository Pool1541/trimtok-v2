import { AsyncLocalStorage } from "node:async_hooks";
import type { LogContext } from "./types.js";

const store = new AsyncLocalStorage<LogContext>();

export function runWithContext<T>(ctx: LogContext, fn: () => Promise<T>): Promise<T> {
  return store.run(ctx, fn);
}

export function getContext(): LogContext | undefined {
  return store.getStore();
}

/**
 * Updates jobId in the active context (call after parsing the SQS message body).
 * No-op if called outside a context.
 */
export function setJobId(jobId: string): void {
  const ctx = store.getStore();
  if (ctx) ctx.jobId = jobId;
}
