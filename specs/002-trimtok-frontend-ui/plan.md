# Implementation Plan: TrimTok — Interfaz Gráfica Frontend

**Branch**: `002-trimtok-frontend-ui` | **Date**: 2026-04-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/002-trimtok-frontend-ui/spec.md`

---

## Summary

Implementar la interfaz gráfica completa de TrimTok en el directorio `front/` usando
Next.js 16 (App Router, static export), React 19, Tailwind CSS v4 y shadcn/ui latest.
La interfaz cubre 4 pantallas (Home, Downloading, Preview, Trim) sin integración con
backend; todos los datos del video son simulados con mocks. El diseño sigue la paleta
negro/blanco de TikTok con acentos verdes para acciones de descarga. La app es
mobile-first con paridad completa desktop/mobile. Se incluyen tests unitarios,
de integración y E2E para los flujos más importantes.

---

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: Next.js 16.2.3, React 19.2.4, Tailwind CSS v4, shadcn/ui latest (new-york), tw-animate-css  
**Storage**: N/A — sin persistencia; todo en memoria  
**Testing**: Vitest 3.x + React Testing Library + Playwright + vitest-axe  
**Target Platform**: Web — navegadores modernos desktop (Chrome, Firefox, Edge) + mobile (Chrome Android, Safari iOS 375px+)  
**Project Type**: Web application — frontend SPA estático (Next.js `output: "export"`)  
**Performance Goals**: Transiciones de pantalla sin retardo perceptible; slider responde a input en <16ms  
**Constraints**: 100% código cliente (`"use client"`); sin API Routes; sin Server Components con data fetching; sin `localStorage`  
**Scale/Scope**: 4 pantallas, ~8 componentes, ~3 módulos de lógica pura, cobertura 80%

---

## Constitution Check

*Evaluación contra los principios de la Constitución Trimtok v1.0.0*

| Principio | Relevante | Evaluación |
|---|---|---|
| I. Serverless-First | No — esta feature es solo frontend | ✅ N/A |
| II. Frontend Isolation | **Sí** | ✅ CUMPLE — datos mock, ninguna llamada a AWS/DynamoDB/API |
| III. Modular Clean Architecture | No — backend only | ✅ N/A |
| IV. Dependency Abstraction | No — backend only | ✅ N/A |
| V. API Design Discipline | No — sin API Routes | ✅ N/A |
| VI. Async Processing / Idempotency | No — backend only | ✅ N/A |
| VII. Data Modeling (DynamoDB) | No — sin DynamoDB | ✅ N/A |
| VIII. Testing Discipline | **Sí** | ✅ CUMPLE — Vitest unit/integration ≥80% coverage + Playwright E2E; tests no dependen de AWS |
| IX. Security by Default | **Sí** | ✅ CUMPLE — validación de URL en el cliente antes de procesar; sin secretos hardcodeados |
| X. Infrastructure as Code | No — sin infra nueva | ✅ N/A |

**Resultado**: Sin violaciones. No se requiere tabla de Complexity Tracking.

**Nota Constitution II — Frontend Isolation**: La Constitución establece que el frontend
MUST NOT contener lógica de negocio. En esta feature, la validación de URL de TikTok y
el cálculo de duración del segmento residen en el cliente. Esto es aceptable porque:
(a) son reglas de presentación/UX, no reglas de negocio del dominio; y
(b) el backend validará las URLs nuevamente cuando se integre en fases futuras.

---

## Project Structure

### Documentation (esta feature)

```text
specs/002-trimtok-frontend-ui/
├── plan.md              ← este archivo
├── research.md          ← shadcn, testing, URL regex, WCAG, patrones React
├── data-model.md        ← VideoData, TrimSelection, TrimResult, AppState
├── quickstart.md        ← setup, comandos, estructura de archivos
└── checklists/
    └── requirements.md
```

### Source Code (directorio `front/`)

```text
front/
├── next.config.ts           # output: "export", reactCompiler: true
├── vitest.config.ts         # Vitest + jsdom + coverage v8 (80%)
├── vitest-setup.ts          # jest-dom + vitest-axe matchers
├── playwright.config.ts     # E2E: chromium + Mobile Chrome + Mobile Safari
├── src/
│   ├── app/
│   │   ├── layout.tsx       # Metadatos TrimTok, fuentes, footer global, lang="es"
│   │   ├── page.tsx         # "use client" — useReducer + renderizado condicional
│   │   └── globals.css      # @import tailwindcss + tw-animate-css + variables shadcn/trimtok
│   ├── components/
│   │   ├── ui/              # shadcn generados (input, button, progress, slider, tooltip)
│   │   ├── home-screen.tsx
│   │   ├── downloading-screen.tsx
│   │   ├── preview-screen.tsx
│   │   ├── trim-screen.tsx
│   │   ├── video-player.tsx
│   │   └── footer.tsx
│   └── lib/
│       ├── app-state.ts     # AppState union, AppAction, appReducer
│       ├── tiktok-url.ts    # TIKTOK_VIDEO_RE, isTikTokVideoUrl, getUrlError
│       ├── time-format.ts   # formatHHMMSS, parseHHMMSS
│       └── mock-data.ts     # MOCK_VIDEO_DATA
└── e2e/
    ├── download-flow.spec.ts
    └── trim-flow.spec.ts
```

---

## Design Decisions

### 1. Componentes UI — shadcn/ui latest (new-york)

- **Decisión**: shadcn/ui `latest`, estilo `new-york`, colores OKLCH, Tailwind v4.
- **Rationale**: Evita escribir componentes desde cero; el estilo new-york es más moderno
  y alineado con el diseño de los mocks. OKLCH es el estándar de colores de shadcn v4.
- **Alternativa rechazada**: Radix UI directo — más bajo nivel, requeriría más código boilerplate.

### 2. State management — `useReducer` + renderizado condicional

- **Decisión**: `useReducer` en el componente raíz (`page.tsx`) con un
  discriminated union de 4 pantallas. Sin Context provider adicional (el `dispatch`
  se pasa como prop explícita a cada pantalla).
- **Rationale**: 4 estados lineales, sin bifurcaciones complejas, sin necesidad de
  acceso global al estado desde componentes profundamente anidados. El patrón es
  simple, testeable y explícito. Se evita HOC y container/presentation (deprecated).
- **Alternativa rechazada**: Zustand — es excelente pero es sobre-ingeniería para
  4 estados sin persistencia.

### 3. Navegación — Estado discriminado (sin `router.push`)

- **Decisión**: Renderizado condicional `{state.screen === "X" && <ScreenX />}`.
  La URL no cambia entre pantallas (SPA sin deep links en esta fase).
- **Rationale**: Next.js App Router con `output: "export"` complica el routing
  dinámico. Las 4 pantallas son un flujo lineal; el estado es suficiente.
- **Alternativa rechazada**: `useRouter().push()` con segmentos dinámicos — introduce
  complejidad de routing y requiere manejar navegación directa a sub-rutas.

### 4. Slider de rango — Slider nativo shadcn

- **Decisión**: `<Slider value={[start, end]} />` con dos thumbs.
- **Rationale**: shadcn `latest` soporta múltiples thumbs nativamente vía Radix UI
  `@radix-ui/react-slider`. No se necesita librería adicional.

### 5. Paleta de colores — Negro/Blanco TikTok

- **Decisión**: `bg-black` como fondo base, `text-white` para texto principal,
  clase custom `bg-[#00c853]` para botones de descarga activos (verde), borde rojo
  `border-red-500` para el estado de error del input.
- **Rationale**: Los diseños de referencia usan negro puro con texto blanco y verde
  para CTAs de descarga. El estilo es fiel a la identidad visual de TikTok.

### 6. Botón "Crear GIF" deshabilitado

- **Decisión**: `aria-disabled="true"` en lugar de atributo `disabled` nativo,
  con handler que previene la acción cuando está en estado deshabilitado.
- **Rationale**: El atributo `disabled` nativo elimina el foco del elemento, haciendo
  que el tooltip nunca sea anunciado por lectores de pantalla (viola WCAG SC 2.1.1).
  `aria-disabled` mantiene la focusabilidad.

### 7. Testing — Vitest + Playwright

- **Decisión**: Vitest para unit/integration, Playwright para E2E. Coverage ≥80%.
- **Rationale**: Vitest es oficialmente recomendado por Next.js para App Router
  client-side. Playwright tiene mejor soporte multi-browser y mobile que Cypress.
  `vitest-axe` permite test de accesibilidad en jsdom sin navegador.

---

## Re-evaluación Constitution Post-Diseño

Tras revisar las decisiones de diseño:

- **Principio II (Frontend Isolation)**: Validación de URL y cálculo de duración del
  segmento son reglas de presentación (UX). El backend validará URLs en fases futuras.
  ✅ Sin degradación.
- **Principio VIII (Testing)**: Cobertura ≥80% en `src/lib/` y `src/components/`;
  tests unitarios sin AWS; E2E sin shared infra. ✅ Compliant.
- **Principio IX (Security)**: La URL es validada client-side antes de iniciar cualquier
  proceso. Sin secretos en código. ✅ Compliant.

**Resultado final**: ✅ Sin violaciones constitucionales.

---

## Contracts

`N/A` — Esta feature es frontend puro sin endpoints expuestos ni contratos externos.
La interfaz de comunicación con el backend se definirá en la feature de integración.
