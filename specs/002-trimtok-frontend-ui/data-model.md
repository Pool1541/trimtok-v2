# Data Model: TrimTok Frontend UI

**Feature**: `002-trimtok-frontend-ui`
**Date**: 2026-04-09

Este documento define las entidades de datos y el modelo de estado del cliente.
No hay persistencia en base de datos ni comunicación con backend en esta fase;
todos los datos son en memoria e incluyen objetos mock para desarrollo.

---

## Entidades de Dominio

### `VideoData`

Representa la información del video descargado (o simulada con mock).

```ts
interface VideoData {
  /** URL del video para reproducir en el <video> player. Mock: URL de archivo local o CDN de prueba. */
  videoUrl: string;

  /** Título o descripción del video. Puede estar truncado en la UI si supera ~120 caracteres. */
  title: string;

  /** Duración total del video en segundos (float). Derivado del video al cargar en el player. */
  durationSeconds: number;

  /** URL original de TikTok ingresada por el usuario. Sirve como identificador de sesión. */
  sourceUrl: string;
}
```

**Objeto mock de referencia** (usado durante desarrollo y tests):

```ts
export const MOCK_VIDEO_DATA: VideoData = {
  videoUrl: "/mock/sample-video.mp4",
  title: "First Gran Turismo editt #edit #granturismomovie #movie #movieclips #...",
  durationSeconds: 25,
  sourceUrl: "https://www.tiktok.com/@user/video/7123456789012345678",
};
```

---

### `TrimSelection`

Representa el segmento de recorte seleccionado por el usuario en la pantalla de recorte.

```ts
interface TrimSelection {
  /** Tiempo de inicio del segmento en segundos (float). Rango: [0, durationSeconds). */
  startSeconds: number;

  /** Tiempo de fin del segmento en segundos (float). Rango: (startSeconds, durationSeconds]. */
  endSeconds: number;
}

/** Duración calculada del segmento (derivada, no almacenada). */
function getSegmentDuration(trim: TrimSelection): number {
  return trim.endSeconds - trim.startSeconds;
}

/** Umbral para habilitar la opción GIF. */
const GIF_MAX_DURATION_SECONDS = 6;

function canCreateGif(trim: TrimSelection): boolean {
  return getSegmentDuration(trim) <= GIF_MAX_DURATION_SECONDS;
}
```

**Reglas de validación:**

| Regla | Condición |
|---|---|
| Start < End | `startSeconds < endSeconds` |
| Start en rango | `startSeconds >= 0` |
| End en rango | `endSeconds <= videoDuration` |
| GIF habilitado | `(endSeconds - startSeconds) <= 6` |

---

### `TrimResult`

Representa el resultado confirmado de presionar "Recortar" o "Crear GIF".
Al cambiar `TrimSelection`, `TrimResult` se invalida (se pone en `null`).

```ts
type TrimMode = "video" | "gif";

interface TrimResult {
  /** Segmento confirmado en el momento de presionar el botón de acción. */
  selection: TrimSelection;

  /** Modo de descarga: "video" (MP4/MP3 recortado) o "gif" (GIF/MP4 sin audio). */
  mode: TrimMode;
}
```

---

## Modelo de Estado de la Aplicación

El estado de la app es un discriminated union que representa la pantalla activa y
los datos disponibles en cada pantalla. Gestionado con `useReducer`.

```ts
// src/lib/app-state.ts

export type AppState =
  | HomeState
  | DownloadingState
  | PreviewState
  | TrimState;

/** Pantalla: Home — campo de URL vacío */
interface HomeState {
  screen: "home";
}

/** Pantalla: Descargando — barra de progreso animada */
interface DownloadingState {
  screen: "downloading";
  /** URL ingresada por el usuario. */
  url: string;
}

/** Pantalla: Previsualización y descarga del video completo */
interface PreviewState {
  screen: "preview";
  videoData: VideoData;
}

/** Pantalla: Recortar video */
interface TrimState {
  screen: "trim";
  videoData: VideoData;
  /** Selección actual del slider. Inicializa en [0, durationSeconds]. */
  trimSelection: TrimSelection;
  /**
   * Resultado de la última acción "Recortar" o "Crear GIF".
   * Se pone en null cuando el usuario mueve el slider o edita los campos de tiempo.
   */
  trimResult: TrimResult | null;
}
```

---

## Acciones (AppAction)

```ts
export type AppAction =
  /** Usuario hace clic en "Descargar" con URL válida */
  | { type: "START_DOWNLOAD"; url: string }

  /** La pantalla de carga simulada finaliza */
  | { type: "DOWNLOAD_COMPLETE"; videoData: VideoData }

  /** Usuario hace clic en "Recortar" desde la pantalla de previsualización */
  | { type: "OPEN_TRIM" }

  /** Usuario mueve el slider o edita INICIO/FIN — invalida el trimResult */
  | { type: "UPDATE_TRIM_SELECTION"; selection: TrimSelection }

  /** Usuario hace clic en "Recortar" o "Crear GIF" con selección válida */
  | { type: "CONFIRM_TRIM"; mode: TrimMode }

  /** Usuario hace clic en "← Volver" desde la pantalla de recorte */
  | { type: "BACK_TO_PREVIEW" }

  /** Usuario hace clic en "Nueva descarga" — resetea todo el estado */
  | { type: "RESET" };
```

---

## Transiciones de Estado

```
      RESET ←──────────────────────────────────────────┐
                                                         │
[home]  ──START_DOWNLOAD──▶  [downloading]              │
                                    │                    │
                          DOWNLOAD_COMPLETE              │
                                    ▼                    │
                              [preview]  ──OPEN_TRIM──▶ [trim]
                                    │                    │
                              ──RESET──                BACK_TO_PREVIEW
                                    │                    │
                                    └──────────▶ [preview]
```

**Guardia en `OPEN_TRIM`**: solo se ejecuta si `state.screen === "preview"`.  
**Guardia en `BACK_TO_PREVIEW`**: solo se ejecuta si `state.screen === "trim"`.  
**`UPDATE_TRIM_SELECTION`**: pone `trimResult = null` y actualiza `trimSelection`.  
**`CONFIRM_TRIM`**: valida que `trimSelection` sea válida antes de crear `trimResult`.

---

## Helpers de Formato

```ts
/**
 * Formatea segundos en HH:MM:SS para display y aria-valuetext del slider.
 * Ej: 65.5 → "0:01:05"
 */
export function formatHHMMSS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Parsea HH:MM:SS a segundos. Retorna null si el formato es inválido.
 */
export function parseHHMMSS(value: string): number | null {
  const match = value.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, h, m, s] = match.map(Number);
  if (m >= 60 || s >= 60) return null;
  return h * 3600 + m * 60 + s;
}
```
