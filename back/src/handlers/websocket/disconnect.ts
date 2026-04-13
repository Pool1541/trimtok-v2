import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { ConnectionDynamoRepo } from "../../notifications/infrastructure/dynamo/connection.dynamo-repo.js";

const connRepo = new ConnectionDynamoRepo();

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connId = event.requestContext.connectionId;
  await connRepo.delete(connId);
  return { statusCode: 200 };
};
