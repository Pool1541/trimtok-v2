"use client";

import { Download, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/video-player";
import { Footer } from "@/components/footer";
import type { AppAction, VideoData } from "@/lib/app-state";

interface PreviewScreenProps {
  videoData: VideoData;
  dispatch: (action: AppAction) => void;
}

// FR-006, FR-007: Pantalla de previsualización y descarga del video completo
export function PreviewScreen({ videoData, dispatch }: PreviewScreenProps) {
  const MAX_TITLE_LENGTH = 120;
  const truncatedTitle =
    videoData.title.length > MAX_TITLE_LENGTH
      ? `${videoData.title.slice(0, MAX_TITLE_LENGTH)}...`
      : videoData.title;

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-4 py-8 bg-(--trimtok-bg)">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Vista previa</h1>
          <Button
            variant="ghost"
            className="text-(--trimtok-text-muted) hover:bg-(--trimtok-surface) hover:text-white"
            onClick={() => dispatch({ type: "RESET" })}
          >
            Nueva descarga
          </Button>
        </div>

        <VideoPlayer src={videoData.videoUrl} />

        <p className="text-sm text-(--trimtok-text-muted) leading-relaxed">
          {truncatedTitle}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            className="w-full bg-(--trimtok-download-green) hover:bg-[#00a844] text-black font-semibold"
            onClick={() => console.log("download mp4")}
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Descargar MP4
          </Button>
          <Button
            className="w-full bg-(--trimtok-download-green) hover:bg-[#00a844] text-black font-semibold"
            onClick={() => console.log("download mp3")}
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Descargar MP3
          </Button>
        </div>

        <Button
          variant="outline"
          className="w-full border-(--trimtok-border) bg-(--trimtok-surface) text-white hover:bg-(--trimtok-surface)/80 hover:text-white"
          onClick={() => dispatch({ type: "OPEN_TRIM" })}
        >
          <Scissors className="w-4 h-4" aria-hidden="true" />
          Recortar
        </Button>
      </div>
      <Footer />
    </main>
  );
}
