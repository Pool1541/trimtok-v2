"use client";

import { forwardRef, useRef } from "react";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  src: string;
  startTime?: number;
  endTime?: number;
  className?: string;
}

// FR-006, FR-010: Reproductor de video accesible con soporte de segmento
export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ src, startTime, endTime, className }, forwardedRef) => {
    const internalRef = useRef<HTMLVideoElement>(null);

    // Callback ref para combinar el ref interno con el externo (forwardedRef)
    const setVideoRef = (node: HTMLVideoElement | null) => {
      (internalRef as React.MutableRefObject<HTMLVideoElement | null>).current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLVideoElement | null>).current = node;
      }
    };

    function handleTimeUpdate() {
      const video = internalRef.current;
      if (!video || endTime === undefined) return;
      if (video.currentTime >= endTime) {
        video.pause();
        video.currentTime = startTime ?? 0;
      }
    }

    return (
      <div role="region" aria-label="Reproductor de video" className={cn("w-full", className)}>
        <video
          ref={setVideoRef}
          src={src}
          controls
          onTimeUpdate={handleTimeUpdate}
          className="w-full rounded-md bg-black aspect-672/600"
        >
          Tu navegador no soporta la reproducción de video.
        </video>
      </div>
    );
  },
);

VideoPlayer.displayName = "VideoPlayer";

export { VideoPlayer as default };
export type { VideoPlayerProps };
