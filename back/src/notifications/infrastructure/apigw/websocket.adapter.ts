import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { Resource } from "sst";
import type { IWebSocketAdapter } from "../../application/ports/websocket.port.js";

const r = Resource as unknown as Record<string, { managementEndpoint: string }>;

let _client: ApiGatewayManagementApiClient | undefined;

function getClient(): ApiGatewayManagementApiClient {
  if (!_client) {
    _client = new ApiGatewayManagementApiClient({
      endpoint: r["WsApi"].managementEndpoint,
    });
  }
  return _client;
}

export class WebSocketAdapter implements IWebSocketAdapter {
  async send(connId: string, data: unknown): Promise<void> {
    await getClient().send(
      new PostToConnectionCommand({
        ConnectionId: connId,
        Data: Buffer.from(JSON.stringify(data)),
      }),
    );
  }
}
