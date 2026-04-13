"use client";

// FR-014: Footer legal en todas las pantallas
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto py-4 text-center text-xs text-(--trimtok-text-muted)">
      <p>TrimTok no tiene afiliación con TikTok o ByteDance Ltd.</p>
      <p>© {year} TrimTok</p>
    </footer>
  );
}
