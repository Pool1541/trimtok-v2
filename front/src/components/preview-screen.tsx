"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/video-player";
import { Footer } from "@/components/footer";
import { createJob, getJob, requestMp3, triggerDownload, ApiError } from "@/lib/api-client";
import { useJobWebSocket } from "@/lib/ws-client";
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

  const [activeFormat, setActiveFormat] = useState<"mp4" | "mp3" | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  function resetDownloadState() {
    setActiveFormat(null);
    setActiveJobId(null);
  }

  async function resolveAndDownload(jobId: string, format: "mp4" | "mp3") {
    try {
      const job = await getJob(jobId);
      if (job.downloadUrl) {
        const ext = format === "mp3" ? "mp3" : "mp4";
        await triggerDownload(job.downloadUrl, `trimtok-${jobId}.${ext}`);
      }
    } catch {
      setDownloadError("Error al obtener el enlace de descarga");
    } finally {
      resetDownloadState();
    }
  }

  // Descarga MP4: crea o reutiliza el job original mediante createJob
  const { mutate: startMp4Download, isPending: isMp4Pending } = useMutation({
    mutationFn: () => createJob(videoData.sourceUrl, "mp4"),
    onMutate: () => {
      setActiveFormat("mp4");
      setDownloadError(null);
    },
    onSuccess: async (data) => {
      if (data.status === "ready" && data.downloadUrl) {
        await resolveAndDownload(data.jobId, "mp4");
      } else {
        setActiveJobId(data.jobId);
      }
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError ? err.message : "Error al iniciar la descarga";
      setDownloadError(msg);
      setActiveFormat(null);
    },
  });

  // Descarga MP3: solicita directamente la extracción de audio del job existente
  const { mutate: startMp3Download, isPending: isMp3Pending } = useMutation({
    mutationFn: () => requestMp3(videoData.jobId),
    onMutate: () => {
      setActiveFormat("mp3");
      setDownloadError(null);
    },
    onSuccess: async (data) => {
      if (data.status === "mp3_ready" && data.downloadUrl) {
        // Cache hit: descarga inmediata
        await triggerDownload(data.downloadUrl, `trimtok-${videoData.jobId}.mp3`);
        resetDownloadState();
      } else if (data.jobId) {
        // Cache miss: job hijo encolado — el WS notificará "mp3_ready"
        setActiveJobId(data.jobId);
      }
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError ? err.message : "Error al extraer el audio";
      setDownloadError(msg);
      setActiveFormat(null);
    },
  });

  useJobWebSocket(activeJobId, (msg) => {
    if (msg.type === "timeout") {
      setDownloadError("Tiempo de espera agotado. Intenta de nuevo.");
      resetDownloadState();
      return;
    }
    if (msg.type !== "job_update") return;

    switch (msg.status) {
      case "error":
        setDownloadError("Error en el servidor al procesar el video.");
        resetDownloadState();
        break;
      case "ready":
        void resolveAndDownload(msg.jobId, "mp4");
        break;
      case "mp3_ready":
        void resolveAndDownload(msg.jobId, "mp3");
        break;
    }
  });

  const isLoading = isMp4Pending || isMp3Pending || activeJobId !== null;

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

        {downloadError && (
          <p role="alert" className="text-sm text-red-400">
            {downloadError}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            className="w-full bg-(--trimtok-download-green) hover:bg-[#00a844] text-black font-semibold"
            disabled={isLoading}
            onClick={() => startMp4Download()}
            aria-busy={isLoading && activeFormat === "mp4"}
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            {isLoading && activeFormat === "mp4"
              ? "Descargando..."
              : "Descargar MP4"}
          </Button>
          <Button
            className="w-full bg-(--trimtok-download-green) hover:bg-[#00a844] text-black font-semibold"
            disabled={isLoading}
            onClick={() => startMp3Download()}
            aria-busy={isLoading && activeFormat === "mp3"}
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            {isLoading && activeFormat === "mp3"
              ? "Descargando..."
              : "Descargar MP3"}
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
