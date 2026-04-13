export const MAX_VIDEO_DURATION_SECONDS = 300; // 5 minutes

export interface VideoInfo {
  videoId: string;
  title: string;
  duration: number;
  thumbnailUrl: string | null;
}

export interface DownloadResult {
  videoInfo: VideoInfo;
  s3Key: string;
  fileSizeBytes: number;
}
