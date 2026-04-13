import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { ConnectionDynamoRepo } from "../../notifications/infrastructure/dynamo/connection.dynamo-repo.js";
import { connPk, connSk } from "../../shared/table-keys.js";

const connRepo = new ConnectionDynamoRepo();

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connId = event.requestContext.connectionId;
  await connRepo.save({
    pk: connPk(connId),
    sk: connSk(),
    type: "CONN",
    connectionId: connId,
    connectedAt: new Date().toISOString(),
    expiresAt: Math.floor(Date.now() / 1000) + 86400,
  });
  return { statusCode: 200 };
};
