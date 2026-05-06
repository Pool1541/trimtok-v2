"use client";

// Umbral de duración máxima para habilitar la opción GIF (FR-012)
export const GIF_MAX_DURATION_SECONDS = 6;

/**
 * Formatea segundos en formato H:MM:SS[.x] para display y aria-valuetext del slider.
 * Muestra 1 decimal sólo cuando hay fracción de segundo.
 * Ej: 65   → "0:01:05"
 *     65.5 → "0:01:05.5"
 */
export function formatHHMMSS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const sFull = totalSeconds % 60;
  const sInt = Math.floor(sFull);
  const dec = Math.round((sFull - sInt) * 10);
  const base = `${h}:${String(m).padStart(2, "0")}:${String(sInt).padStart(2, "0")}`;
  return dec > 0 ? `${base}.${dec}` : base;
}

/**
 * Parsea una cadena H:MM:SS[.x] a segundos.
 * Acepta un dígito decimal opcional (0.1 s de precisión).
 * Retorna null si el formato es inválido o si minutos/segundos son ≥ 60.
 */
export function parseHHMMSS(value: string): number | null {
  const match = value.match(/^(\d+):(\d{2}):(\d{2})(?:\.(\d))?$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  const s = Number(match[3]);
  const dec = match[4] !== undefined ? Number(match[4]) : 0;
  if (m >= 60 || s >= 60) return null;
  return Math.round((h * 3600 + m * 60 + s + dec / 10) * 10) / 10;
}
