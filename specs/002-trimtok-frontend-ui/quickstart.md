# Quickstart: TrimTok Frontend UI

**Feature**: `002-trimtok-frontend-ui`
**Directorio**: `front/`

---

## Prerrequisitos

- Node.js 20+
- pnpm (recomendado) o npm

---

## 1. Instalar dependencias base

```bash
cd front
npm install
```

---

## 2. Instalar shadcn/ui

```bash
# Inicializar shadcn en el proyecto (estilo new-york, Tailwind v4)
npx shadcn@latest init

# Añadir componentes necesarios
npx shadcn@latest add input button progress slider tooltip
```

> Con npm + React 19: añadir `--legacy-peer-deps` si hay conflictos de peer deps.

---

## 3. Instalar dependencias de animación

```bash
npm install tw-animate-css
```

Actualizar `src/app/globals.css` para importar `tw-animate-css`:

```css
@import "tailwindcss";
@import "tw-animate-css";
```

---

## 4. Instalar dependencias de testing

```bash
npm install -D \
  vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/dom @testing-library/user-event \
  @testing-library/jest-dom \
  @vitest/coverage-v8 \
  vitest-axe axe-core \
  vite-tsconfig-paths \
  @playwright/test

npx playwright install
```

---

## 5. Configurar static export

Editar `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  reactCompiler: true,
};

export default nextConfig;
```

---

## 6. Estructura de archivos de esta feature

```text
front/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Metadatos TrimTok, fuentes, footer global
│   │   ├── page.tsx            # Raíz "use client" con useReducer y renderizado condicional
│   │   └── globals.css         # Tailwind v4 + tw-animate-css + variables shadcn
│   ├── components/
│   │   ├── ui/                 # Componentes shadcn (generados, no editar)
│   │   ├── home-screen.tsx     # Pantalla Home con campo URL + validación
│   │   ├── downloading-screen.tsx  # Pantalla de carga animada
│   │   ├── preview-screen.tsx  # Pantalla previsualización + botones descarga
│   │   ├── trim-screen.tsx     # Pantalla de recorte con slider de rango
│   │   ├── video-player.tsx    # Wrapper custom sobre <video> con a11y
│   │   └── footer.tsx          # Pie de página con aviso legal
│   └── lib/
│       ├── app-state.ts        # Types AppState, AppAction, reducer
│       ├── tiktok-url.ts       # TIKTOK_VIDEO_RE, isTikTokVideoUrl, getUrlError
│       ├── time-format.ts      # formatHHMMSS, parseHHMMSS
│       └── mock-data.ts        # MOCK_VIDEO_DATA para desarrollo
├── src/**/*.test.ts(x)         # Tests unitarios e integración (Vitest + RTL)
├── e2e/
│   ├── download-flow.spec.ts   # E2E: URL → carga → preview
│   └── trim-flow.spec.ts       # E2E: preview → trim → descarga
├── vitest.config.ts
├── vitest-setup.ts
└── playwright.config.ts
```

---

## 7. Comandos de desarrollo

```bash
# Servidor de desarrollo
npm run dev          # http://localhost:3000

# Build estático
npm run build        # genera /out

# Tests unitarios e integración
npm test             # vitest watch mode
npm run test:run     # vitest run (CI)
npm run coverage     # vitest run + reporte coverage

# Tests E2E
npx playwright test              # todos los proyectos (chromium, mobile)
npx playwright test --ui          # modo interactivo con UI

# Lint y formato
npm run lint         # biome check
npm run format       # biome format --write
```

---

## 8. Paleta de colores TrimTok

El diseño sigue los colores primarios de TikTok (blanco y negro). Todas las pantallas usan fondo negro (`bg-black`) con texto blanco (`text-white`). Los botones de descarga de resultado usan verde TikTok:

```css
/* Variables a añadir en globals.css después de shadcn init */
:root {
  --trimtok-bg: #000000;
  --trimtok-surface: #1a1a1a;
  --trimtok-border: #2a2a2a;
  --trimtok-text: #ffffff;
  --trimtok-text-muted: #8a8a8a;
  --trimtok-accent-green: #25f4ee;  /* cyan TikTok */
  --trimtok-accent-red: #fe2c55;    /* rojo TikTok */
  --trimtok-download-green: #00c853; /* verde botones de descarga */
}
```

> **shadcn base color**: seleccionar `neutral` con tema oscuro (`dark`) para alinearse
> con el fondo negro de los diseños de referencia.

---

## 9. Notas de implementación

- Todo el código de componentes DEBE incluir la directiva `"use client"` ya que Next.js
  App Router usa Server Components por defecto. Con `output: "export"` esto es obligatorio.
- Los botones de descarga (MP4, MP3, GIF) en esta fase simulan la descarga o disparan
  un `console.log`. La integración real se hará en la siguiente fase.
- La pantalla de carga simula un delay de **2500ms** antes de navegar a preview,
  usando `MOCK_VIDEO_DATA` como datos del video.
- El slider de recorte usa segundos (float) como unidad interna; la conversión a
  `HH:MM:SS` se hace exclusivamente en la capa de presentación con `formatHHMMSS`.
