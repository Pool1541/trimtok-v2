"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { createJob, getJob, ApiError, mapErrorMessage } from "@/lib/api-client";
import { useJobWebSocket } from "@/lib/ws-client";
import type { AppAction, VideoData } from "@/lib/app-state";

interface DownloadingScreenProps {
  url: string;
  dispatch: (action: AppAction) => void;
}

// FR-004, FR-005: Pantalla de carga animada con petición real al backend
export function DownloadingScreen({ url, dispatch }: DownloadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

  // Animación de la barra (avanza de 0 a 85 en ~8 s, el resto cuando finalice)
  useEffect(() => {
    const step = 85 / (8000 / 100);
    intervalRef.current = setInterval(() => {
      setProgress((prev) => (prev < 85 ? Math.min(prev + step, 85) : prev));
    }, 100);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function finishWithVideoData(videoData: VideoData) {
    if (doneRef.current) return;
    doneRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setProgress(100);
    dispatch({ type: "DOWNLOAD_COMPLETE", videoData });
  }

  function finishWithError(message = "No se pudo descargar el video") {
    if (doneRef.current) return;
    doneRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    dispatch({ type: "DOWNLOAD_ERROR", message });
  }

  async function resolveJob(jobId: string) {
    try {
      const job = await getJob(jobId);
      if (job.status === "error") {
        finishWithError();
        return;
      }
      const videoData: VideoData = {
        jobId: job.jobId,
        videoUrl: job.downloadUrl ?? "",
        title: job.title ?? "",
        durationSeconds: job.duration ?? 0,
        sourceUrl: url,
        thumbnailUrl: job.thumbnailUrl ?? undefined,
      };
      finishWithVideoData(videoData);
    } catch {
      finishWithError();
    }
  }

  const { mutate } = useMutation({
    mutationFn: (tiktokUrl: string) => createJob(tiktokUrl, "mp4"),
    onSuccess: async (data) => {
      if (data.status === "ready" && data.downloadUrl) {
        // Cache hit: already have the URL, but still call getJob for full metadata
        await resolveJob(data.jobId);
      } else {
        // Cache miss: job enqueued, wait for WS notification
        setActiveJobId(data.jobId);
      }
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "VIDEO_TOO_LONG") {
        finishWithError(mapErrorMessage(err.message));
      } else {
        finishWithError(err instanceof ApiError ? err.message : undefined);
      }
    },
  });

  // Fire on mount
  useEffect(() => {
    mutate(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WS listener (only active when activeJobId is set)
  useJobWebSocket(activeJobId, (msg) => {
    if (msg.type === "timeout") {
      finishWithError();
      return;
    }
    if (msg.type === "job_update") {
      if (msg.status === "error") {
        finishWithError(mapErrorMessage(msg.errorMessage));
      } else if (msg.status === "ready") {
        void resolveJob(msg.jobId);
      }
    }
  });

  return (
    <div className="flex min-h-screen flex-col bg-(--trimtok-bg)">
      <Header />

      {/* Loader centrado en el espacio restante */}
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          <Progress
            value={progress}
            role="progressbar"
            aria-label="Descargando video"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-full"
          />
          <p className="text-lg font-semibold text-white">Descargando...</p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
