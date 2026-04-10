# Research: TrimTok Frontend UI

**Feature**: `002-trimtok-frontend-ui`
**Date**: 2026-04-09
**Stack**: Next.js 16.2.3 · React 19.2.4 · TypeScript 5 · Tailwind CSS v4 · Biome 2.2.0

---

## 0. Resumen de Decisiones

| Pregunta / NEEDS CLARIFICATION | Decisión | Sección |
|---|---|---|
| Librería de componentes UI | shadcn/ui `latest` (estilo `new-york`, colores OKLCH) | §1 |
| Animaciones CSS | `tw-animate-css` (reemplaza `tailwindcss-animate`) | §1 |
| Slider de rango (dos thumbs) | Slider nativo shadcn `value={[start, end]}` | §1 |
| Video player | `<video>` HTML nativo con wrapper custom | §1 |
| State management | `useReducer` + Context (discriminated union 4 pantallas) | §3 |
| Navegación entre pantallas | Estado discriminado; **no** `router.push` ni `<Link>` | §3 |
| Static export Next.js | `output: "export"` en `next.config.ts` | §3 |
| Test runner unit/integration | Vitest 3.x + React Testing Library | §4 |
| Test runner e2e | Playwright | §4 |
| Coverage umbral | 80% líneas/funciones/ramas/sentencias | §4 |
| A11y testing | `vitest-axe` + `axe-core` | §4 |
| Validación URL TikTok | Dominio + estructura de video (regex completo) | §2 |

Todos los NEEDS CLARIFICATION del plan han sido resueltos. No quedan ítems pendientes.

---

## 1. shadcn/ui — Compatibilidad y Configuración

### Compatibilidad

`shadcn@latest` (CLI v4, 2026) tiene soporte completo para React 19 y Tailwind CSS v4.
La documentación oficial referencia Next.js 15; Next.js 16 es compatible sin cambios de
ruptura en App Router.

**Cambios de ruptura en `latest` relevantes para este proyecto:**

| Cambio | Impacto |
|---|---|
| `forwardRef` eliminado → `React.ComponentProps<>` directo | Los wrappers custom deben usar `ComponentProps` |
| Estilo `default` deprecado → default es `new-york` | Inicializar con `new-york` |
| Colores HSL → **OKLCH** | Las clases de color son las mismas; solo cambia el valor CSS |
| `tailwindcss-animate` → `tw-animate-css` | Instalar `tw-animate-css`, no `tailwindcss-animate` |
| `toast` → **`sonner`** | Si se usan notificaciones, `npx shadcn@latest add sonner` |

### Inicialización en el directorio `front/`

```bash
cd front
npx shadcn@latest init
# Opciones: estilo new-york, base color neutral, CSS variables sí
```

Con npm + React 19 usar `--legacy-peer-deps`. Con pnpm/bun no se necesita flag.

### Componentes a instalar

```bash
npx shadcn@latest add input button progress slider tooltip
```

| Componente shadcn | Uso en TrimTok |
|---|---|
| `input` | Campo de URL con estado de error (`aria-invalid`) |
| `button` | Descargar, Recortar, Crear GIF, Nueva descarga, Volver |
| `progress` | Barra animada pantalla de carga |
| `slider` | Range dos thumbs para trim start/end |
| `tooltip` | Sobre botón "Crear GIF" deshabilitado (segmento >6s) |

**No disponibles en shadcn → custom:**

- `VideoPlayer`: wrapper sobre `<video>` HTML nativo. Incluye controles accesibles.
- Mensaje de error bajo input: `<p className="text-destructive text-sm">` inline.

### Slider de rango (dos thumbs)

El Slider shadcn `latest` soporta múltiples thumbs nativamente:

```tsx
import { Slider } from "@/components/ui/slider"

const [range, setRange] = React.useState([0, videoDurationSeconds])

<Slider
  value={range}
  onValueChange={setRange}
  min={0}
  max={videoDurationSeconds}
  step={0.1}
  minStepsBetweenThumbs={0.1}
/>
// range[0] → trim start (segundos), range[1] → trim end (segundos)
```

### Tailwind v4 + shadcn — `globals.css` mínimo

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  /* shadcn genera el resto en init */
}
```

---

## 2. Validación de URL de TikTok

### Formatos conocidos de URL de video

| Tipo | Ejemplo |
|---|---|
| Desktop estándar | `https://www.tiktok.com/@username/video/7123456789012345678` |
| Sin `www` | `https://tiktok.com/@username/video/7123456789012345678` |
| Short link app (vm) | `https://vm.tiktok.com/ZMxxxxxxx/` |
| Short link app (vt) | `https://vt.tiktok.com/ZMxxxxxxx/` |
| Mobile regional | `https://m.tiktok.com/v/7123456789012345678.html` |
| Alias `/t/` | `https://www.tiktok.com/t/ZMxxxxxxx/` |
| Con query params | `https://www.tiktok.com/@user/video/123?is_from_webapp=1` |

Los IDs de video son enteros de 10–20 dígitos. El handle `@username` puede contener
letras, números, guión bajo (`_`) y punto (`.`).

### Regex JavaScript

```ts
// src/lib/tiktok-url.ts
export const TIKTOK_VIDEO_RE =
  /^https?:\/\/(?:(?:www\.|m\.)?tiktok\.com\/@[\w.]+\/video\/\d{10,20}|(?:vm|vt)\.tiktok\.com\/[\w]+\/?|(?:www\.)?tiktok\.com\/t\/[\w]+\/?)(?:[?#].*)?$/i;

export function isTikTokVideoUrl(url: string): boolean {
  return TIKTOK_VIDEO_RE.test(url.trim());
}

export function getUrlError(url: string): string | null {
  if (!url.trim()) return "Pega un enlace de TikTok";
  if (!isTikTokVideoUrl(url)) return "El enlace no apunta a un video de TikTok";
  return null;
}
```

**Rechaza:** `tiktok.com`, `tiktok.com/explore`, `tiktok.com/foryou`,
`tiktok.com/@user` (perfil), `youtube.com`, etc.

### Casos de prueba

```ts
// válidos  ✅
"https://www.tiktok.com/@user/video/7123456789012345678"
"https://tiktok.com/@user.name/video/1234567890"
"https://vm.tiktok.com/ZMeXXXXX/"
"https://vt.tiktok.com/ZMeXXXXX/"
"https://www.tiktok.com/t/ZMeXXXXX/"
"https://www.tiktok.com/@user/video/123?is_from_webapp=1"

// inválidos  ❌
""                                          // vacío
"https://youtube.com/watch?v=abc"          // otro dominio
"https://www.tiktok.com/explore"           // no es video
"https://www.tiktok.com/@user"             // perfil, sin /video/
"https://www.tiktok.com"                   // homepage
```

---

## 3. Patrones React/Next.js — Client-only Static Export

### `next.config.ts` para static export

```ts
// front/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",      // genera /out con HTML estático
  reactCompiler: true,   // ya configurado en el proyecto
  // trailingSlash: true, // activar si el host no reescribe rutas
};

export default nextConfig;
```

**Restricciones con `output: "export"`:**
- No Server Components con data fetching en build time
- No API Routes (`/app/api/`)
- No `<Image>` con optimización remota (usar `<img>` nativo)

### State Management — `useReducer` + Context

Para 4 estados lineales sin persistencia cross-session, `useReducer` es suficiente.
Zustand sería la siguiente opción si el estado crece o se necesita `localStorage`.

```ts
// src/lib/app-state.ts
export type AppScreen =
  | { screen: "home" }
  | { screen: "downloading"; url: string }
  | { screen: "preview"; videoData: VideoData }
  | { screen: "trim"; videoData: VideoData; trimResult?: TrimResult };

export type AppAction =
  | { type: "START_DOWNLOAD"; url: string }
  | { type: "DOWNLOAD_COMPLETE"; videoData: VideoData }
  | { type: "OPEN_TRIM" }
  | { type: "CONFIRM_TRIM"; result: TrimResult }
  | { type: "RESET" };

export function appReducer(state: AppScreen, action: AppAction): AppScreen {
  switch (action.type) {
    case "START_DOWNLOAD":    return { screen: "downloading", url: action.url };
    case "DOWNLOAD_COMPLETE": return { screen: "preview", videoData: action.videoData };
    case "OPEN_TRIM":
      if (state.screen !== "preview") return state;
      return { screen: "trim", videoData: state.videoData };
    case "CONFIRM_TRIM":
      if (state.screen !== "trim") return state;
      return { ...state, trimResult: action.result };
    case "RESET":             return { screen: "home" };
    default:                  return state;
  }
}
```

### Navegación entre pantallas — Renderizado condicional

```tsx
// src/app/page.tsx  ("use client" en raíz)
"use client";

export default function TrimTokApp() {
  const [state, dispatch] = useReducer(appReducer, { screen: "home" });

  return (
    <>
      {state.screen === "home"        && <HomeScreen dispatch={dispatch} />}
      {state.screen === "downloading" && <DownloadingScreen state={state} dispatch={dispatch} />}
      {state.screen === "preview"     && <PreviewScreen state={state} dispatch={dispatch} />}
      {state.screen === "trim"        && <TrimScreen state={state} dispatch={dispatch} />}
    </>
  );
}
```

---

## 4. Testing — Configuración Completa

### 4.1 Unit / Integration — Vitest + RTL

**Decisión:** Vitest (recomendado por Next.js para proyectos App Router client-side).

#### Paquetes

```bash
npm install -D \
  vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/dom @testing-library/user-event \
  @testing-library/jest-dom \
  @vitest/coverage-v8 \
  vitest-axe axe-core \
  vite-tsconfig-paths
```

#### `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/app/layout.tsx'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})
```

#### `vitest-setup.ts`

```ts
import '@testing-library/jest-dom'
import 'vitest-axe/extend-expect'
import * as axeMatchers from 'vitest-axe/matchers'
import { expect } from 'vitest'
expect.extend(axeMatchers)
```

### 4.2 E2E — Playwright

```bash
npm install -D @playwright/test && npx playwright install
```

#### `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [
    { name: 'chromium',      use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

### 4.3 Qué testear por capa

| Flujo | Archivo | Capa |
|---|---|---|
| Regex TikTok (tabla exhaustiva) | `src/lib/tiktok-url.test.ts` | Unit |
| `getUrlError()` vacío / dominio erróneo / válido | `src/lib/tiktok-url.test.ts` | Unit |
| Slider: valores start/end en tiempo real | `src/components/trim-screen.test.tsx` | Integration |
| Slider: "Crear GIF" deshabilitado >6s + tooltip | `src/components/trim-screen.test.tsx` | Integration |
| Slider: mover slider invalida botones de descarga | `src/components/trim-screen.test.tsx` | Integration |
| HomeScreen: a11y sin violaciones (vitest-axe) | `src/components/home-screen.test.tsx` | Integration |
| Flujo URL → carga → preview | `e2e/download-flow.spec.ts` | E2E |
| Flujo preview → trim → descarga MP4/MP3 | `e2e/trim-flow.spec.ts` | E2E |

---

## 5. WCAG 2.1 AA — Requisitos por Componente

### Input URL + error inline

```tsx
<input
  aria-invalid={!!error}
  aria-describedby={error ? "url-error" : undefined}
  aria-required="true"
  aria-label="Enlace de TikTok"
/>
{error && (
  <p id="url-error" role="alert" className="text-destructive text-sm">
    {error}
  </p>
)}
```

### Slider de rango

```tsx
<Slider
  getAriaLabel={(i) => i === 0 ? "Inicio de recorte" : "Fin de recorte"}
  getAriaValueText={(v) => formatHHMMSS(v)}  // "0:00:06" en lugar de "6"
/>
```

### Botón deshabilitado con tooltip (Crear GIF)

Usar `aria-disabled="true"` en lugar de `disabled` nativo para conservar el foco
(con `disabled` nativo el elemento no recibe foco y el tooltip nunca se anuncia):

```tsx
<Button
  aria-disabled={isDisabled}
  aria-describedby={isDisabled ? "gif-tooltip" : undefined}
  onClick={(e) => { if (isDisabled) { e.preventDefault(); return; } onCreateGif(); }}
>
  Crear GIF
</Button>
{isDisabled && (
  <span id="gif-tooltip" role="tooltip">
    Máximo 6 segundos para crear un GIF
  </span>
)}
```

### Barra de progreso

```tsx
<div
  role="progressbar"
  aria-label="Descargando video"
  aria-valuemin={0}
  aria-valuemax={100}
  // omitir aria-valuenow si es indeterminado
/>
```

### Video player

```tsx
<video aria-label="Vista previa del video" controls>
  {/* track de subtítulos vacío por cumplimiento SC 1.2.2 */}
</video>
```
