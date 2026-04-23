export interface DownloadMessage {
  jobId: string;
  tiktokUrl: string;
  format: "mp4" | "mp3";
}

export interface TrimMessage {
  jobId: string;
  videoId: string;
  /** s3Key del video fuente (del job padre) para que el worker no necesite leerlo del job hijo */
  s3Key: string;
  trimStart: number;
  trimEnd: number;
}

export interface GifMessage {
  jobId: string;
  videoId: string;
  /** s3Key del video fuente (del job padre) para que el worker no necesite leerlo del job hijo */
  s3Key: string;
  trimStart: number;
  trimEnd: number;
}

export interface Mp3Message {
  jobId: string;
  videoId: string;
  /** s3Key del video fuente (del job padre) para que el worker no necesite leerlo del job hijo */
  s3Key: string;
  trimStart?: number;
  trimEnd?: number;
}

export interface IJobQueuePort {
  enqueueDownload(msg: DownloadMessage, correlationId?: string): Promise<void>;
  enqueueTrim(msg: TrimMessage, correlationId?: string): Promise<void>;
  enqueueGif(msg: GifMessage, correlationId?: string): Promise<void>;
  enqueueMp3(msg: Mp3Message, correlationId?: string): Promise<void>;
}
