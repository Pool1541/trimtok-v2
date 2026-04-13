export interface IConnectionRepository {
  save(conn: WebSocketConnection): Promise<void>;
  updateSubscription(connId: string, jobId: string): Promise<void>;
  delete(connId: string): Promise<void>;
  findByJobId(jobId: string): Promise<WebSocketConnection[]>;
}

export interface WebSocketConnection {
  pk: string;
  sk: string;
  type: "CONN";
  connectionId: string;
  jobId?: string;
  connectedAt: string;
  /** Unix epoch seconds, TTL attribute */
  expiresAt: number;
  gsi1pk?: string;
  gsi1sk?: string;
}
