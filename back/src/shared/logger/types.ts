export interface LogContext {
  correlationId: string;
  handler: string;
  jobId?: string;
}
