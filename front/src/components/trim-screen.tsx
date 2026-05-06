"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Play, Scissors, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VideoPlayer } from "@/components/video-player";
import { Footer } from "@/components/footer";
import {
  formatHHMMSS,
  parseHHMMSS,
  GIF_MAX_DURATION_SECONDS,
} from "@/lib/time-format";
import {
  requestTrim,
  requestMp3,
  requestGif,
  getJob,
  triggerDownload,
  ApiError,
} from "@/lib/api-client";
import { useJobWebSocket } from "@/lib/ws-client";
import type {
  AppAction,
  VideoData,
  TrimSelection,
  TrimResult,
} from "@/lib/app-state";

type TrimDownloadType = "mp4" | "mp3" | "gif";

interface TrimScreenProps {
  videoData: VideoData;
  trimSelection: TrimSelection;
  trimResult: TrimResult | null;
  dispatch: (action: AppAction) => void;
}

// FR-008 a FR-016: Pantalla de recorte con slider bidireccional y botones de descarga
export function TrimScreen({
  videoData,
  trimSelection,
  trimResult,
  dispatch,
}: TrimScreenProps) {
  const { durationSeconds, jobId } = videoData;
  const { startSeconds, endSeconds } = trimSelection;

  const [startInput, setStartInput] = useState(formatHHMMSS(startSeconds));
  const [endInput, setEndInput] = useState(formatHHMMSS(endSeconds));
  const [startError, setStartError] = useState(false);
  const [endError, setEndError] = useState(false);

  const [activeDownload, setActiveDownload] = useState<TrimDownloadType | null>(
    null,
  );
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const segmentDuration = endSeconds - startSeconds;
  const isGifDisabled = segmentDuration > GIF_MAX_DURATION_SECONDS;
  const isDownloading = activeDownload !== null;

  function dispatchSelection(selection: TrimSelection) {
    dispatch({ type: "UPDATE_TRIM_SELECTION", selection });
    setStartInput(formatHHMMSS(selection.startSeconds));
    setEndInput(formatHHMMSS(selection.endSeconds));
  }

  function handleSliderChange([s, e]: number[]) {
    dispatchSelection({ startSeconds: s, endSeconds: e });
  }

  function handleStartBlur() {
    const parsed = parseHHMMSS(startInput);
    if (parsed === null || parsed >= endSeconds || parsed < 0) {
      setStartError(true);
      setStartInput(formatHHMMSS(startSeconds));
      return;
    }
    setStartError(false);
    dispatchSelection({ startSeconds: parsed, endSeconds });
  }

  function handleEndBlur() {
    const parsed = parseHHMMSS(endInput);
    if (parsed === null || parsed <= startSeconds || parsed > durationSeconds) {
      setEndError(true);
      setEndInput(formatHHMMSS(endSeconds));
      return;
    }
    setEndError(false);
    dispatchSelection({ startSeconds, endSeconds: parsed });
  }

  function handlePreview() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = startSeconds;
    video.play();
  }

  async function resolveAndDownload(
    jobIdToGet: string,
    type: TrimDownloadType,
  ) {
    try {
      const job = await getJob(jobIdToGet);
      if (job.downloadUrl) {
        const ext = type === "mp3" ? "mp3" : "mp4";
        triggerDownload(
          job.downloadUrl,
          `trimtok-${type}-${jobIdToGet}.${ext}`,
        );
        dispatch({ type: "TRIM_COMPLETE", downloadUrl: job.downloadUrl });
      }
    } catch {
      dispatch({
        type: "TRIM_ERROR",
        message: "Error al obtener el enlace de descarga",
      });
      setDownloadError("Error al obtener el enlace de descarga");
    } finally {
      setActiveDownload(null);
      setActiveJobId(null);
    }
  }

  function handleDownloadError(err: unknown) {
    const msg =
      err instanceof ApiError ? err.message : "Error al procesar la solicitud";
    setDownloadError(msg);
    dispatch({ type: "TRIM_ERROR", message: msg });
    setActiveDownload(null);
    setActiveJobId(null);
  }

  const { mutate: startTrimMp4 } = useMutation({
    mutationFn: () => requestTrim(jobId, startSeconds, endSeconds),
    onMutate: () => {
      setActiveDownload("mp4");
      setDownloadError(null);
    },
    onSuccess: async (data) => {
      if (data.status === "trimmed" && data.downloadUrl) {
        triggerDownload(data.downloadUrl, `trimtok-mp4-${jobId}.mp4`);
        dispatch({ type: "TRIM_COMPLETE", downloadUrl: data.downloadUrl });
        setActiveDownload(null);
      } else {
        // Suscribir al job hijo para recibir notificaciones del proceso de recorte
        setActiveJobId(data.jobId ?? jobId);
      }
    },
    onError: handleDownloadError,
  });

  const { mutate: startTrimMp3 } = useMutation({
    mutationFn: () => requestMp3(jobId, startSeconds, endSeconds),
    onMutate: () => {
      setActiveDownload("mp3");
      setDownloadError(null);
    },
    onSuccess: async (data) => {
      if (data.status === "mp3_ready" && data.downloadUrl) {
        triggerDownload(data.downloadUrl, `trimtok-mp3-${jobId}.mp3`);
        dispatch({ type: "TRIM_COMPLETE", downloadUrl: data.downloadUrl });
        setActiveDownload(null);
      } else {
        // Suscribir al job hijo para recibir notificaciones del proceso de MP3
        setActiveJobId(data.jobId ?? jobId);
      }
    },
    onError: handleDownloadError,
  });

  const { mutate: startGif } = useMutation({
    mutationFn: () => requestGif(jobId, startSeconds, endSeconds),
    onMutate: () => {
      setActiveDownload("gif");
      setDownloadError(null);
    },
    onSuccess: async (data) => {
      if (data.status === "gif_created" && data.downloadUrl) {
        triggerDownload(data.downloadUrl, `trimtok-gif-${jobId}.mp4`);
        dispatch({ type: "TRIM_COMPLETE", downloadUrl: data.downloadUrl });
        setActiveDownload(null);
      } else {
        // Suscribir al job hijo para recibir notificaciones del proceso de GIF
        setActiveJobId(data.jobId ?? jobId);
      }
    },
    onError: handleDownloadError,
  });

  // WS listener para resultados de trim/mp3/gif
  useJobWebSocket(activeJobId, (msg) => {
    if (msg.type === "timeout") {
      setDownloadError("Tiempo de espera agotado. Intenta de nuevo.");
      dispatch({ type: "TRIM_ERROR", message: "Tiempo de espera agotado" });
      setActiveDownload(null);
      setActiveJobId(null);
      return;
    }
    if (msg.type === "job_update") {
      const { status } = msg;
      if (status === "error") {
        handleDownloadError(
          new ApiError(500, "WORKER_ERROR", "Error en el servidor al procesar"),
        );
      } else if (
        status === "trimmed" ||
        status === "mp3_ready" ||
        status === "gif_created"
      ) {
        void resolveAndDownload(msg.jobId, activeDownload ?? "mp4");
      }
    }
  });

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-4 py-8 bg-(--trimtok-bg)">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="text-(--trimtok-text-muted) hover:bg-(--trimtok-surface) hover:text-white px-2"
            onClick={() => dispatch({ type: "BACK_TO_PREVIEW" })}
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Volver
          </Button>
          <h1 className="text-xl font-bold text-white">Recortar video</h1>
        </div>

        {/* Video player con soporte de segmento — ref expuesto para previsualizar */}
        <VideoPlayer
          ref={videoRef}
          src={videoData.videoUrl}
          startTime={startSeconds}
          endTime={endSeconds}
        />

        <p className="text-sm text-(--trimtok-text-muted) leading-relaxed line-clamp-2">
          {videoData.title}
        </p>

        {/* Slider de rango */}
        <div className="flex flex-col gap-3">
          <TooltipProvider>
            <Slider
              value={[startSeconds, endSeconds]}
              min={0}
              max={durationSeconds}
              step={0.1}
              minStepsBetweenThumbs={0.1}
              onValueChange={handleSliderChange}
              aria-label="Rango de recorte"
              className="w-full"
            />
          </TooltipProvider>

          {/* Marcadores de tiempo */}
          <div className="flex justify-between text-xs text-(--trimtok-text-muted)">
            <span>0:00:00</span>
            <span>Duración total: {formatHHMMSS(durationSeconds)}</span>
            <span>{formatHHMMSS(durationSeconds)}</span>
          </div>
        </div>

        {/* Campos editables INICIO / FIN */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="trim-start"
              className="text-xs text-(--trimtok-text-muted) font-medium"
            >
              INICIO
            </label>
            <input
              id="trim-start"
              type="text"
              value={startInput}
              onChange={(e) => {
                setStartInput(e.target.value);
                if (trimResult)
                  dispatch({
                    type: "UPDATE_TRIM_SELECTION",
                    selection: trimSelection,
                  });
              }}
              onBlur={handleStartBlur}
              aria-invalid={startError ? "true" : "false"}
              className={`px-3 py-2 rounded-md text-sm font-mono bg-(--trimtok-surface) text-white border ${
                startError ? "border-red-500" : "border-(--trimtok-border)"
              } focus:outline-none focus:ring-1 focus:ring-white`}
            />
            {startError && (
              <p className="text-xs text-red-500">Tiempo inválido</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="trim-end"
              className="text-xs text-(--trimtok-text-muted) font-medium"
            >
              FIN
            </label>
            <input
              id="trim-end"
              type="text"
              value={endInput}
              onChange={(e) => {
                setEndInput(e.target.value);
                if (trimResult)
                  dispatch({
                    type: "UPDATE_TRIM_SELECTION",
                    selection: trimSelection,
                  });
              }}
              onBlur={handleEndBlur}
              aria-invalid={endError ? "true" : "false"}
              className={`px-3 py-2 rounded-md text-sm font-mono bg-(--trimtok-surface) text-white border ${
                endError ? "border-red-500" : "border-(--trimtok-border)"
              } focus:outline-none focus:ring-1 focus:ring-white`}
            />
            {endError && (
              <p className="text-xs text-red-500">Tiempo inválido</p>
            )}
          </div>
        </div>

        {/* Error message */}
        {downloadError && (
          <p role="alert" className="text-sm text-red-400 text-center">
            {downloadError}
          </p>
        )}

        {/* Botones de acción — cambian según trimResult */}
        {trimResult === null ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1 border-(--trimtok-border) bg-(--trimtok-surface) text-white hover:bg-(--trimtok-surface)/80 hover:text-white"
              onClick={handlePreview}
            >
              <Play className="w-4 h-4" aria-hidden="true" />
              Previsualizar segmento
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-(--trimtok-border) bg-(--trimtok-surface) text-white hover:bg-(--trimtok-surface)/80 hover:text-white"
              onClick={() => dispatch({ type: "CONFIRM_TRIM", mode: "video" })}
            >
              <Scissors className="w-4 h-4" aria-hidden="true" />
              Recortar
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    aria-disabled={isGifDisabled ? "true" : "false"}
                    onClick={() => {
                      if (isGifDisabled) return;
                      dispatch({ type: "CONFIRM_TRIM", mode: "gif" });
                    }}
                    className={`flex-1 border-(--trimtok-border) bg-(--trimtok-surface) ${
                      isGifDisabled
                        ? "opacity-50 cursor-not-allowed text-(--trimtok-text-muted)"
                        : "text-white hover:bg-(--trimtok-surface)/80 hover:text-white"
                    }`}
                  >
                    <Scissors className="w-4 h-4" aria-hidden="true" />
                    Crear GIF
                  </Button>
                </TooltipTrigger>
                {isGifDisabled && (
                  <TooltipContent>
                    <p>
                      El segmento no puede superar los{" "}
                      {GIF_MAX_DURATION_SECONDS} segundos para crear un GIF
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {trimResult.mode === "video" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  className="w-full bg-(--trimtok-download-green) hover:bg-[#00a844] text-black font-semibold"
                  disabled={isDownloading}
                  aria-busy={isDownloading && activeDownload === "mp4"}
                  onClick={() => startTrimMp4()}
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  {isDownloading && activeDownload === "mp4"
                    ? "Procesando..."
                    : "Descargar MP4 recortado"}
                </Button>
                <Button
                  className="w-full bg-(--trimtok-download-green) hover:bg-[#00a844] text-black font-semibold"
                  disabled={isDownloading}
                  aria-busy={isDownloading && activeDownload === "mp3"}
                  onClick={() => startTrimMp3()}
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  {isDownloading && activeDownload === "mp3"
                    ? "Procesando..."
                    : "Descargar MP3 recortado"}
                </Button>
              </div>
            ) : (
              <Button
                className="w-full bg-(--trimtok-download-green) hover:bg-[#00a844] text-black font-semibold"
                disabled={isDownloading}
                aria-busy={isDownloading && activeDownload === "gif"}
                onClick={() => startGif()}
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                {isDownloading && activeDownload === "gif"
                  ? "Procesando..."
                  : "Descargar GIF"}
              </Button>
            )}
            <p className="text-xs text-center text-(--trimtok-text-muted)">
              Modifica la selección para restablecer los controles de recorte.
            </p>
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
