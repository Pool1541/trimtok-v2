"use client";

// FR-002, FR-003: Validación de URL de TikTok en cliente
// Acepta: tiktok.com/@user/video/ID, vm.tiktok.com/ID, vt.tiktok.com/ID, /t/ alias, query params
export const TIKTOK_VIDEO_RE =
  /^https?:\/\/(?:(?:www\.|m\.)?tiktok\.com\/@[\w.]+\/video\/\d{10,20}|(?:vm|vt)\.tiktok\.com\/[\w]+\/?|(?:www\.)?tiktok\.com\/t\/[\w]+\/?)(?:[?#].*)?$/i;

export function isTikTokVideoUrl(url: string): boolean {
  return TIKTOK_VIDEO_RE.test(url.trim());
}

/**
 * Retorna un mensaje de error si la URL es inválida, o null si es válida.
 * - Vacío → "Pega un enlace de TikTok"
 * - Dominio TikTok sin path de video → "El enlace no apunta a un video de TikTok"
 * - Otro dominio → "El enlace no apunta a un video de TikTok"
 */
export function getUrlError(url: string): string | null {
  if (!url.trim()) return "Pega un enlace de TikTok";
  if (!isTikTokVideoUrl(url)) return "El enlace no apunta a un video de TikTok";
  return null;
}
