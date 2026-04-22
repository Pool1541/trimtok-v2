import type { MiddlewareHandler } from "hono";
import { randomUUID } from "node:crypto";
import { runWithContext } from "./context.js";

/**
 * Hono middleware that:
 * 1. Reads X-Correlation-ID from the incoming request header (for service-to-service propagation)
 *    or generates a new UUID if absent.
 * 2. Makes the correlationId available via getContext() for the entire request lifecycle.
 * 3. Echoes X-Correlation-ID back in the response.
 */
export function correlationMiddleware(handlerName: string): MiddlewareHandler {
  return (c, next) => {
    const correlationId = c.req.header("x-correlation-id") ?? randomUUID();
    c.header("x-correlation-id", correlationId);
    return runWithContext({ correlationId, handler: handlerName }, next);
  };
}
