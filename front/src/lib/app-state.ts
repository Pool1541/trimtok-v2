"use client";

// ─── Entidades de Dominio ────────────────────────────────────────────────────

export interface VideoData {
  /** URL del video para reproducir en el <video> player. */
  videoUrl: string;
  /** Título o descripción del video. Se trunca en UI si supera ~120 caracteres. */
  title: string;
  /** Duración total del video en segundos. */
  durationSeconds: number;
  /** URL original de TikTok ingresada por el usuario. */
  sourceUrl: string;
  /** jobId del backend. Necesario para llamadas a /trim, /gif, /mp3. */
  jobId: string;
  /** URL de la miniatura del video. Opcional según disponibilidad en el backend. */
  thumbnailUrl?: string;
}

export interface TrimSelection {
  /** Tiempo de inicio del segmento en segundos. Rango: [0, durationSeconds). */
  startSeconds: number;
  /** Tiempo de fin del segmento en segundos. Rango: (startSeconds, durationSeconds]. */
  endSeconds: number;
}

export type TrimMode = "video" | "gif";

export interface TrimResult {
  /** Segmento confirmado al presionar "Recortar" o "Crear GIF". */
  selection: TrimSelection;
  /** Modo de descarga: "video" (MP4/MP3 recortado) o "gif". */
  mode: TrimMode;
}

// ─── AppState discriminated union ───────────────────────────────────────────

export interface HomeState {
  screen: "home";
  errorMessage?: string;
}

export interface DownloadingState {
  screen: "downloading";
  url: string;
}

export interface PreviewState {
  screen: "preview";
  videoData: VideoData;
}

export interface TrimState {
  screen: "trim";
  videoData: VideoData;
  /** Selección actual del slider. Inicializa en [0, durationSeconds]. */
  trimSelection: TrimSelection;
  /**
   * Resultado de la última acción "Recortar" o "Crear GIF".
   * Se pone en null cuando el usuario mueve el slider o edita los campos de tiempo.
   */
  trimResult: TrimResult | null;
  /** URL de descarga resultado de la última operación de trim/gif/mp3. Null mientras espera. */
  trimDownloadUrl: string | null;
  /** Mensaje de error si la última operación de trim/gif/mp3 falló. */
  trimError: string | null;
}

export type AppState = HomeState | DownloadingState | PreviewState | TrimState;

// ─── AppAction ───────────────────────────────────────────────────────────────

export type AppAction =
  | { type: "START_DOWNLOAD"; url: string }
  | { type: "DOWNLOAD_COMPLETE"; videoData: VideoData }
  | { type: "DOWNLOAD_ERROR"; message: string }
  | { type: "OPEN_TRIM" }
  | { type: "UPDATE_TRIM_SELECTION"; selection: TrimSelection }
  | { type: "CONFIRM_TRIM"; mode: TrimMode }
  | { type: "TRIM_COMPLETE"; downloadUrl: string }
  | { type: "TRIM_ERROR"; message: string }
  | { type: "BACK_TO_PREVIEW" }
  | { type: "RESET" };

// ─── Estado inicial ──────────────────────────────────────────────────────────

export const initialState: AppState = { screen: "home" } satisfies AppState;

// ─── Reducer ─────────────────────────────────────────────────────────────────

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "START_DOWNLOAD":
      return { screen: "downloading", url: action.url };

    case "DOWNLOAD_COMPLETE":
      if (state.screen !== "downloading") return state;
      return { screen: "preview", videoData: action.videoData };

    case "OPEN_TRIM":
      if (state.screen !== "preview") return state;
      return {
        screen: "trim",
        videoData: state.videoData,
        trimSelection: {
          startSeconds: 0,
          endSeconds: state.videoData.durationSeconds,
        },
        trimResult: null,
        trimDownloadUrl: null,
        trimError: null,
      };

    case "UPDATE_TRIM_SELECTION":
      if (state.screen !== "trim") return state;
      return {
        ...state,
        trimSelection: action.selection,
        trimResult: null, // FR-016: invalida trimResult al cambiar la selección
      };

    case "CONFIRM_TRIM":
      if (state.screen !== "trim") return state;
      return {
        ...state,
        trimResult: {
          selection: state.trimSelection,
          mode: action.mode,
        },
      };

    case "DOWNLOAD_ERROR":
      return { screen: "home", errorMessage: action.message };

    case "TRIM_COMPLETE":
      if (state.screen !== "trim") return state;
      return { ...state, trimDownloadUrl: action.downloadUrl, trimError: null };

    case "TRIM_ERROR":
      if (state.screen !== "trim") return state;
      return { ...state, trimDownloadUrl: null, trimError: action.message };

    case "BACK_TO_PREVIEW":
      if (state.screen !== "trim") return state;
      return { screen: "preview", videoData: state.videoData };

    case "RESET":
      return { screen: "home" };

    default:
      return state;
  }
}
