"use client";

// Umbral de duración máxima para habilitar la opción GIF (FR-012)
export const GIF_MAX_DURATION_SECONDS = 6;

/**
 * Formatea segundos en formato HH:MM:SS para display y aria-valuetext del slider.
 * Ej: 65.5 → "0:01:05"
 */
export function formatHHMMSS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Parsea una cadena HH:MM:SS a segundos.
 * Retorna null si el formato es inválido o si minutos/segundos son ≥ 60.
 */
export function parseHHMMSS(value: string): number | null {
  const match = value.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, h, m, s] = match.map(Number);
  if ((m as number) >= 60 || (s as number) >= 60) return null;
  return (h as number) * 3600 + (m as number) * 60 + (s as number);
}
