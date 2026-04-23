/**
 * api-client.ts — HTTP client for the TrimTok API.
 *
 * All functions throw `ApiError` on non-2xx responses.
 * Use NEXT_PUBLIC_API_URL env var; falls back to empty string (relative) in tests.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// ─── Error class ─────────────────────────────────────────────────────────────

export const mapErrorMessage = (errorMessage: unknown) => {
  if (typeof errorMessage !== "string") return "Ocurrió un error desconocido";
  
  switch (errorMessage) {
    case "Video exceeds the maximum allowed duration of 5 minutes.":
      return "El video supera los 5 minutos de duración máxima permitida.";
    default:
      return errorMessage;
  }
}

export class ApiError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    const code: string = body?.error?.code ?? "UNKNOWN_ERROR";
    const message: string = body?.error?.message ?? res.statusText;
    return new ApiError(res.status, code, message);
  } catch {
    return new ApiError(res.status, "UNKNOWN_ERROR", res.statusText);
  }
}

// ─── Response types ───────────────────────────────────────────────────────────

export interface CreateJobResponse {
  jobId: string;
  /** "pending" → job enqueued (HTTP 201); "ready" → cache hit (HTTP 200) */
  status: "pending" | "ready";
  /** Only present when status === "ready" */
  downloadUrl?: string;
}

export interface GetJobResponse {
  jobId: string;
  status: string;
  format: "mp4" | "mp3";
  title: string | null;
  duration: number | null;
  thumbnailUrl: string | null;
  trimStart: number | null;
  trimEnd: number | null;
  downloadUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrimResponse {
  /** "trimmed" → cache hit (HTTP 200); "trimming" → enqueued (HTTP 202) */
  status: "trimmed" | "trimming";
  downloadUrl?: string;
  /** jobId del job hijo (solo presente en HTTP 202). Usar para suscripción WS. */
  jobId?: string;
}

export interface GifResponse {
  /** "gif_created" → cache hit (HTTP 200); "creating_gif" → enqueued (HTTP 202) */
  status: "gif_created" | "creating_gif";
  downloadUrl?: string;
  /** jobId del job hijo (solo presente en HTTP 202). Usar para suscripción WS. */
  jobId?: string;
}

export interface Mp3Response {
  /** "mp3_ready" → cache hit (HTTP 200); "creating_mp3" → enqueued (HTTP 202) */
  status: "mp3_ready" | "creating_mp3";
  downloadUrl?: string;
  /** jobId del job hijo (solo presente en HTTP 202). Usar para suscripción WS. */
  jobId?: string;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  return res.json() as Promise<T>;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw await parseError(res);
  return res.json() as Promise<T>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create or retrieve a video download job.
 * HTTP 201 → job enqueued; HTTP 200 → cache hit (downloadUrl present).
 */
export function createJob(
  tiktokUrl: string,
  format: "mp4" | "mp3" = "mp4",
): Promise<CreateJobResponse> {
  return postJson<CreateJobResponse>("/v1/jobs", { tiktokUrl, format });
}

/**
 * Get full job details including a fresh presigned downloadUrl.
 * Call this after receiving a terminal WS notification.
 */
export function getJob(jobId: string): Promise<GetJobResponse> {
  return getJson<GetJobResponse>(`/v1/jobs/${encodeURIComponent(jobId)}`);
}

/**
 * Request a trimmed video segment (MP4).
 * HTTP 200 → downloadUrl ready; HTTP 202 → wait for WS "trimmed" then call getJob.
 */
export function requestTrim(
  jobId: string,
  trimStart: number,
  trimEnd: number,
): Promise<TrimResponse> {
  return postJson<TrimResponse>(`/v1/jobs/${encodeURIComponent(jobId)}/trim`, {
    trimStart,
    trimEnd,
  });
}

/**
 * Request a GIF (H.264 silent MP4) from a segment.
 * HTTP 200 → downloadUrl ready; HTTP 202 → wait for WS "gif_created" then call getJob.
 */
export function requestGif(
  jobId: string,
  trimStart?: number,
  trimEnd?: number,
): Promise<GifResponse> {
  return postJson<GifResponse>(`/v1/jobs/${encodeURIComponent(jobId)}/gif`, {
    trimStart,
    trimEnd,
  });
}

/**
 * Request an MP3 audio extraction.
 * HTTP 200 → downloadUrl ready; HTTP 202 → wait for WS "mp3_ready" then call getJob.
 */
export function requestMp3(
  jobId: string,
  trimStart?: number,
  trimEnd?: number,
): Promise<Mp3Response> {
  return postJson<Mp3Response>(`/v1/jobs/${encodeURIComponent(jobId)}/mp3`, {
    trimStart,
    trimEnd,
  });
}

/**
 * Trigger a browser file download from a presigned URL.
 * Creates a temporary <a> element, clicks it, then removes it.
 */
export async function triggerDownload(url: string, filename?: string): Promise<void> {
  const res = await fetch(url);
  const blob = await res.blob();

  const blobUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename ?? "";
  document.body.appendChild(a);
  a.click();

  URL.revokeObjectURL(blobUrl);
  a.remove();
}
