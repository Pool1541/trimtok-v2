import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { ConnectionDynamoRepo } from "../../notifications/infrastructure/dynamo/connection.dynamo-repo.js";
import { WebSocketAdapter } from "../../notifications/infrastructure/apigw/websocket.adapter.js";
import { JobDynamoRepo } from "../../jobs/infrastructure/dynamo/job.dynamo-repo.js";

const connRepo = new ConnectionDynamoRepo();
const wsAdapter = new WebSocketAdapter();
const jobRepo = new JobDynamoRepo();

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connId = event.requestContext.connectionId;
  const body = JSON.parse(event.body ?? "{}") as { action?: string; jobId?: string };

  if (!body.jobId) return { statusCode: 400 };

  await connRepo.updateSubscription(connId, body.jobId);

  const job = await jobRepo.findById(body.jobId);
  await wsAdapter.send(connId, {
    type: "subscribed",
    jobId: body.jobId,
    currentStatus: job?.status ?? null,
  });

  return { statusCode: 200 };
};
