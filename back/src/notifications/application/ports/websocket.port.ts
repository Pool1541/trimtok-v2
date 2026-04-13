export interface IWebSocketAdapter {
  send(connId: string, data: unknown): Promise<void>;
}
