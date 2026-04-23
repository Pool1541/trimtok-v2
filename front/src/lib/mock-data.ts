"use client";

import type { VideoData, TrimSelection } from "@/lib/app-state";

// Datos mock para desarrollo y tests (FR-005, data-model.md)
export const MOCK_VIDEO_DATA: VideoData = {
  jobId: "mock-job-id-001",
  videoUrl: "/mock/sample-video.mp4",
  title:
    "First Gran Turismo editt #edit #granturismomovie #movie #movieclips #granturismo #granturismo7 #ps5 #gaming",
  durationSeconds: 25,
  sourceUrl: "https://www.tiktok.com/@user/video/7123456789012345678",
};

/** Duración del segmento en segundos (calculada, no almacenada). */
export function getSegmentDuration(trim: TrimSelection): number {
  return trim.endSeconds - trim.startSeconds;
}
