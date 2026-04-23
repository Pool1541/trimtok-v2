import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { ConnectionDynamoRepo } from "../../notifications/infrastructure/dynamo/connection.dynamo-repo.js";
import { createLogger, runWithContext } from "../../shared/logger/index.js";

const connRepo = new ConnectionDynamoRepo();
const logger = createLogger("ws/disconnect");

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connId = event.requestContext.connectionId;
  return runWithContext({ correlationId: connId, handler: "ws/disconnect" }, async () => {
    logger.info({ connId }, "ws disconnect");
    await connRepo.delete(connId);
    return { statusCode: 200 };
  });
};
