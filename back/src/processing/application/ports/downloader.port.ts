import type { VideoInfo } from "../../domain/video-processor.entity.js";

export interface DownloadOutput {
  localPath: string;
  videoInfo: VideoInfo;
  fileSizeBytes: number;
}

export interface IDownloaderPort {
  /**
   * Downloads a TikTok video to destDir.
   * Validates duration ≤ MAX_VIDEO_DURATION_SECONDS, throws AppError VIDEO_TOO_LONG if exceeded.
   */
  downloadVideo(url: string, destDir: string): Promise<DownloadOutput>;
}
