/**
 * ws-client.ts — WebSocket hook for real-time job status notifications.
 *
 * Protocol (API Gateway WebSocket):
 *  1. Client opens connection to NEXT_PUBLIC_WS_URL
 *  2. On open, client sends: { action: "subscribe", jobId }
 *  3. Server responds: { type: "subscribed", jobId, currentStatus }
 *     → If currentStatus is terminal, treat as immediate job_update
 *  4. Server pushes: { type: "job_update", jobId, status, ... }
 *  5. After receiving a terminal-with-artifact status, frontend calls GET /v1/jobs/:jobId
 */

"use client";

import { useEffect, useRef } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";

// ─── Job status constants ─────────────────────────────────────────────────────

export type JobStatus =
  | "pending"
  | "downloading"
  | "ready"
  | "trimming"
  | "trimmed"
  | "creating_gif"
  | "gif_created"
  | "creating_mp3"
  | "mp3_ready"
  | "error";

/** Statuses from which no further transitions occur (success or failure). */
export const TERMINAL_STATUSES = new Set<JobStatus>([
  "ready",
  "trimmed",
  "gif_created",
  "mp3_ready",
  "error",
]);

// ─── WS message types ─────────────────────────────────────────────────────────

export interface WsSubscribedMessage {
  type: "subscribed";
  jobId: string;
  currentStatus: JobStatus | null;
}

export interface WsJobUpdateMessage {
  type: "job_update";
  jobId: string;
  status: JobStatus;
  title?: string | null;
  duration?: number | null;
  thumbnailUrl?: string | null;
  s3Key?: string;
  errorMessage?: string | null;
  updatedAt: string;
}

export interface WsTimeoutMessage {
  type: "timeout";
}

export type WsJobMessage =
  | WsSubscribedMessage
  | WsJobUpdateMessage
  | WsTimeoutMessage;

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseJobWebSocketResult {
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
}

/**
 * Opens a WebSocket connection and subscribes to job status updates.
 *
 * @param jobId    The job to subscribe to. Pass `null` to skip connection.
 * @param onMessage  Callback invoked for each WsJobMessage (including timeout).
 * @param timeoutMs  Max ms to wait for a terminal status. Default 300 000 = 5 minutes.
 */
export function useJobWebSocket(
  jobId: string | null,
  onMessage: (msg: WsJobMessage) => void,
  timeoutMs = 300_000,
): UseJobWebSocketResult {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? null;
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const terminalReceivedRef = useRef(false);

  function clearTimer() {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  const { readyState, sendJsonMessage } = useWebSocket(
    // react-use-websocket requires a non-null string when active; skip when no jobId
    jobId !== null && wsUrl !== null ? wsUrl : null,
    {
      share: false,
      shouldReconnect: () => false,
      onOpen: () => {
        terminalReceivedRef.current = false;
        sendJsonMessage({ action: "subscribe", jobId });

        // Start timeout timer after subscribe
        clearTimer();
        timeoutRef.current = setTimeout(() => {
          if (!terminalReceivedRef.current) {
            onMessageRef.current({ type: "timeout" });
          }
        }, timeoutMs);
      },
      onMessage: (event: MessageEvent) => {
        let parsed: WsJobMessage;
        try {
          parsed = JSON.parse(event.data as string) as WsJobMessage;
        } catch {
          return; // Ignore unparseable frames
        }

        if (parsed.type === "subscribed") {
          const { currentStatus } = parsed;
          if (currentStatus !== null && TERMINAL_STATUSES.has(currentStatus)) {
            // Race condition: job already terminal before WS connected
            terminalReceivedRef.current = true;
            clearTimer();
            onMessageRef.current({
              type: "job_update",
              jobId: parsed.jobId,
              status: currentStatus,
              updatedAt: new Date().toISOString(),
            });
          } else {
            onMessageRef.current(parsed);
          }
          return;
        }

        if (
          parsed.type === "job_update" &&
          TERMINAL_STATUSES.has(parsed.status)
        ) {
          terminalReceivedRef.current = true;
          clearTimer();
        }

        onMessageRef.current(parsed);
      },
      onError: () => {
        clearTimer();
      },
      onClose: () => {
        clearTimer();
      },
    },
  );

  // Cleanup timer on unmount
  // biome-ignore lint/correctness/useExhaustiveDependencies: clearTimer is stable (no deps)
  useEffect(() => () => clearTimer(), []);

  const isConnected = readyState === ReadyState.OPEN;
  const isConnecting =
    readyState === ReadyState.CONNECTING ||
    readyState === ReadyState.UNINSTANTIATED;
  const connectionError =
    readyState === ReadyState.CLOSED && jobId !== null
      ? "WebSocket cerrado inesperadamente"
      : null;

  return { isConnected, isConnecting, connectionError };
}
