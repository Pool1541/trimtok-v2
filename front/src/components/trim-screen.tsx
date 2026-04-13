"use client";

import { useRef, useState } from "react";
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
import { formatHHMMSS, parseHHMMSS, GIF_MAX_DURATION_SECONDS } from "@/lib/time-format";
import type { AppAction, VideoData, TrimSelection, TrimResult } from "@/lib/app-state";

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
  const { durationSeconds } = videoData;
  const { startSeconds, endSeconds } = trimSelection;

  const [startInput, setStartInput] = useState(formatHHMMSS(startSeconds));
  const [endInput, setEndInput] = useState(formatHHMMSS(endSeconds));
  const [startError, setStartError] = useState(false);
  const [endError, setEndError] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const segmentDuration = endSeconds - startSeconds;
  const isGifDisabled = segmentDuration > GIF_MAX_DURATION_SECONDS;

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
            <label htmlFor="trim-start" className="text-xs text-(--trimtok-text-muted) font-medium">
              INICIO
            </label>
            <input
              id="trim-start"
              type="text"
              value={startInput}
              onChange={(e) => {
                setStartInput(e.target.value);
                if (trimResult) dispatch({ type: "UPDATE_TRIM_SELECTION", selection: trimSelection });
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
            <label htmlFor="trim-end" className="text-xs text-(--trimtok-text-muted) font-medium">
              FIN
            </label>
            <input
              id="trim-end"
              type="text"
              value={endInput}
              onChange={(e) => {
                setEndInput(e.target.value);
                if (trimResult) dispatch({ type: "UPDATE_TRIM_SELECTION", selection: trimSelection });
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
                    <p>El segmento no puede superar los {GIF_MAX_DURATION_SECONDS} segundos para crear un GIF</p>
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
                  onClick={() => console.log("download trimmed mp4")}
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  Descargar MP4 recortado
                </Button>
                <Button
                  className="w-full bg-(--trimtok-download-green) hover:bg-[#00a844] text-black font-semibold"
                  onClick={() => console.log("download trimmed mp3")}
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  Descargar MP3 recortado
                </Button>
              </div>
            ) : (
              <Button
                className="w-full bg-(--trimtok-download-green) hover:bg-[#00a844] text-black font-semibold"
                onClick={() => console.log("download gif")}
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                Descargar GIF
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
