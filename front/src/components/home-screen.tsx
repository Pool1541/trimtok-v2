"use client";

import { useState } from "react";
import { Music2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/footer";
import { getUrlError } from "@/lib/tiktok-url";
import type { AppAction } from "@/lib/app-state";

interface HomeScreenProps {
  dispatch: (action: AppAction) => void;
}

// FR-001, FR-002, FR-003: Pantalla principal con validación de URL de TikTok
export function HomeScreen({ dispatch }: HomeScreenProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const urlError = getUrlError(url);
    if (urlError) {
      setError(urlError);
      return;
    }
    setError(null);
    dispatch({ type: "START_DOWNLOAD", url });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUrl(e.target.value);
    if (error) setError(null);
  }

  const errorId = "url-error-message";

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

      {/* Contenido principal centrado */}
      <main className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-8">
        <div className="flex flex-col items-center gap-2 text-center max-w-lg">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Descarga y recorta tus videos favoritos
          </h1>
          <p className="text-sm text-(--trimtok-text-muted)">
            Pega un enlace de TikTok para descargar en MP4 o MP3
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-xl flex-col gap-2"
          noValidate
        >
          <div className="flex gap-2">
            <Input
              type="url"
              value={url}
              onChange={handleChange}
              placeholder="Pega el enlace de TikTok aquí..."
              aria-label="URL del video de TikTok"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? errorId : undefined}
              className={
                error
                  ? "flex-1 border-red-500 focus-visible:ring-red-500 bg-(--trimtok-surface) text-white placeholder:text-(--trimtok-text-muted)"
                  : "flex-1 bg-(--trimtok-surface) text-white placeholder:text-(--trimtok-text-muted) border-(--trimtok-border)"
              }
            />
            <Button
              type="submit"
              className="shrink-0 bg-white text-black font-semibold hover:bg-gray-100"
            >
              Descargar
            </Button>
          </div>
          {error && (
            <p
              id={errorId}
              role="alert"
              data-testid={errorId}
              className="text-sm text-red-500 px-1"
            >
              {error}
            </p>
          )}
        </form>
      </main>

      <Footer />
    </div>
  );
}
