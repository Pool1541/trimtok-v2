import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { ConnectionDynamoRepo } from "../../notifications/infrastructure/dynamo/connection.dynamo-repo.js";
import { WebSocketAdapter } from "../../notifications/infrastructure/apigw/websocket.adapter.js";
import { JobDynamoRepo } from "../../jobs/infrastructure/dynamo/job.dynamo-repo.js";
import { createLogger, runWithContext } from "../../shared/logger/index.js";

const connRepo = new ConnectionDynamoRepo();
const wsAdapter = new WebSocketAdapter();
const jobRepo = new JobDynamoRepo();
const logger = createLogger("ws/subscribe");

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connId = event.requestContext.connectionId;
  return runWithContext({ correlationId: connId, handler: "ws/subscribe" }, async () => {
    const body = JSON.parse(event.body ?? "{}") as { action?: string; jobId?: string };
    if (!body.jobId) return { statusCode: 400 };

    logger.info({ connId, jobId: body.jobId }, "ws subscribe");
    await connRepo.updateSubscription(connId, body.jobId);

    const job = await jobRepo.findById(body.jobId);

    // Distributed-lock redirect: if this job is still pending because another worker
    // holds the lock for the same video, re-register the connection under the active
    // job so the WS notification reaches this client when the active job finishes.
    if (job?.status === "pending" && job.videoId) {
      const lock = await jobRepo.getLock(job.videoId);
      if (lock && lock.jobId !== body.jobId) {
        logger.info({ connId, pendingJobId: body.jobId, activeJobId: lock.jobId }, "ws subscribe redirect to active job");
        await connRepo.updateSubscription(connId, lock.jobId);
      }
    }

    await wsAdapter.send(connId, {
      type: "subscribed",
      jobId: body.jobId,
      currentStatus: job?.status ?? null,
    });

    return { statusCode: 200 };
  });
};
