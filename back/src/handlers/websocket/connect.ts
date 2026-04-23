import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { ConnectionDynamoRepo } from "../../notifications/infrastructure/dynamo/connection.dynamo-repo.js";
import { connPk, connSk } from "../../shared/table-keys.js";
import { createLogger, runWithContext } from "../../shared/logger/index.js";

const connRepo = new ConnectionDynamoRepo();
const logger = createLogger("ws/connect");

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connId = event.requestContext.connectionId;
  return runWithContext({ correlationId: connId, handler: "ws/connect" }, async () => {
    logger.info({ connId }, "ws connect");
    await connRepo.save({
      pk: connPk(connId),
      sk: connSk(),
      type: "CONN",
      connectionId: connId,
      connectedAt: new Date().toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
    });
    return { statusCode: 200 };
  });
};
