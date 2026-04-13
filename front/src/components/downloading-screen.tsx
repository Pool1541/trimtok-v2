"use client";

import { useEffect, useRef, useState } from "react";
import { Music2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Footer } from "@/components/footer";
import { MOCK_VIDEO_DATA } from "@/lib/mock-data";
import type { AppAction } from "@/lib/app-state";

interface DownloadingScreenProps {
  url: string;
  dispatch: (action: AppAction) => void;
}

// FR-004, FR-005: Pantalla de carga animada con auto-navegación tras 2500ms
export function DownloadingScreen({ dispatch }: DownloadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Animar la barra de 0 a 100 durante 2500ms
    const step = 100 / (2500 / 50);
    intervalRef.current = setInterval(() => {
      setProgress((prev) => Math.min(prev + step, 100));
    }, 50);

    const timeout = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress(100);
      dispatch({ type: "DOWNLOAD_COMPLETE", videoData: MOCK_VIDEO_DATA });
    }, 2500);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [dispatch]);

  return (
    <div className="flex min-h-screen flex-col bg-(--trimtok-bg)">
      {/* Encabezado con logo y slogan */}
      <header className="flex flex-col items-center pt-8 pb-2 gap-1">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center">
            <Music2 className="w-5 h-5 text-black" aria-hidden="true" />
          </div>
          <span className="text-xl font-bold text-white">TrimTok</span>
        </div>
        <p className="text-sm text-(--trimtok-text-muted)">
          Descarga y recorta videos de TikTok
        </p>
      </header>

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
