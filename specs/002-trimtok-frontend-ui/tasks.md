# Tasks: TrimTok — Interfaz Gráfica Frontend

**Input**: Design documents from `specs/002-trimtok-frontend-ui/`
**Prerequisites**: plan.md ✅, spec.md ✅, data-model.md ✅, quickstart.md ✅, research.md ✅

**Tests**: Incluidos — tests unitarios, de integración y E2E fueron explícitamente solicitados en la especificación.

**Organization**: Las tareas están agrupadas por user story para permitir implementación y testing independientes por historia.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias)
- **[Story]**: A qué user story pertenece la tarea (US1, US2, US3, US4)
- Incluir rutas de archivo exactas en las descripciones

---

## Phase 1: Setup (Configuración del Proyecto)

**Purpose**: Configuración inicial, herramientas y estructura del proyecto

- [ ] T001 Añadir `output: "export"` a la configuración de Next.js en `front/next.config.ts` (mantener `reactCompiler: true`)
- [ ] T002 Inicializar shadcn/ui latest con `npx shadcn@latest init` en `front/` (estilo `new-york`, tema dark, base color `neutral`, Tailwind v4, sin `tailwind.config.js`)
- [ ] T003 Añadir componentes shadcn con `npx shadcn@latest add input button progress slider tooltip` en `front/` (generará `front/src/components/ui/`)
- [ ] T004 [P] Instalar `tw-animate-css` y actualizar `front/src/app/globals.css` con `@import "tw-animate-css"` y variables CSS `--trimtok-*` (ver quickstart.md §8: background, surface, border, text, text-muted, accent-green, accent-red, download-green)
- [ ] T005 Instalar dependencias de testing en `front/`: `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom @vitest/coverage-v8 vitest-axe axe-core vite-tsconfig-paths @playwright/test`; luego ejecutar `npx playwright install`
- [ ] T006 [P] Crear `front/vitest.config.ts` con entorno jsdom, plugin `@vitejs/plugin-react`, `vite-tsconfig-paths`, setup file apuntando a `vitest-setup.ts`, cobertura v8 con umbral 80% (lines, functions, branches, statements)
- [ ] T007 [P] Crear `front/vitest-setup.ts` con import de `@testing-library/jest-dom` y `vitest-axe/extend-expect` para registrar matchers
- [ ] T008 [P] Crear `front/playwright.config.ts` con 3 proyectos: `chromium` (desktop 1280×720), `Mobile Chrome` (Galaxy S5 375×667), `Mobile Safari` (iPhone 12 390×844); `baseURL: "http://localhost:3000"`; `webServer` que ejecuta `npm run dev`

**Checkpoint**: Setup completo — `npm run build` pasa, `npm test` ejecuta sin error de configuración, `npx playwright test --list` lista proyectos

---

## Phase 2: Foundational (Módulos de Lógica Pura — Prerrequisitos Bloqueantes)

**Purpose**: Tipos, estado global y helpers de lógica pura que TODAS las pantallas necesitan

**⚠️ CRITICAL**: Ninguna pantalla puede implementarse hasta completar esta fase

- [ ] T009 [P] Crear `front/src/lib/tiktok-url.ts` con: constante `TIKTOK_VIDEO_RE` (regex que acepta `tiktok.com/@user/video/ID`, `vm.tiktok.com/ID`, `vt.tiktok.com/ID`, `/t/` alias y parámetros query); función `isTikTokVideoUrl(url: string): boolean`; función `getUrlError(url: string): string | null` (retorna `"Pega un enlace de TikTok"` si vacío, `"El enlace no apunta a un video de TikTok"` si es TikTok sin video, otro mensaje si no es TikTok)
- [ ] T010 [P] Crear `front/src/lib/time-format.ts` con: `formatHHMMSS(totalSeconds: number): string` (ej. `65.5 → "0:01:05"`); `parseHHMMSS(value: string): number | null` (valida formato `HH:MM:SS`, retorna null si inválido o minutos/segundos ≥60); exportar `GIF_MAX_DURATION_SECONDS = 6`
- [ ] T011 [P] Crear `front/src/lib/mock-data.ts` con `MOCK_VIDEO_DATA: VideoData` (videoUrl: `"/mock/sample-video.mp4"`, title: `"First Gran Turismo editt #edit #granturismomovie..."`, durationSeconds: `25`, sourceUrl: URL de TikTok de prueba); incluir también la función helper `getSegmentDuration(trim: TrimSelection): number`
- [ ] T012 Crear `front/src/lib/app-state.ts` con: interfaces `VideoData`, `TrimSelection`, `TrimResult`, `TrimMode`; types `HomeState`, `DownloadingState`, `PreviewState`, `TrimState`; union `AppState`; union `AppAction` (7 types: `START_DOWNLOAD`, `DOWNLOAD_COMPLETE`, `OPEN_TRIM`, `UPDATE_TRIM_SELECTION`, `CONFIRM_TRIM`, `BACK_TO_PREVIEW`, `RESET`); función `appReducer(state: AppState, action: AppAction): AppState` con todas las transiciones y guardias; exportar estado inicial `{ screen: "home" } satisfies AppState`
- [ ] T013 [P] Crear `front/src/components/footer.tsx` con `"use client"`, texto legal `"TrimTok no tiene afiliación con TikTok o ByteDance Ltd."`, año de copyright dinámico con `new Date().getFullYear()`, `role="contentinfo"` (FR-014)

**Checkpoint**: Módulos limpios — `npm run build` sin errores TypeScript; tests de tipos pasan en CI

---

## Phase 3: User Story 1 — Ingresar y validar un enlace de TikTok (Priority: P1) 🎯 MVP

**Goal**: El usuario puede ingresar una URL en el Home, recibir errores de validación descriptivos y avanzar a la pantalla de carga cuando la URL es válida.

**Independent Test**: Renderizar `<HomeScreen>` con un mock de dispatch y probar: campo vacío → error "Pega un enlace de TikTok", URL no-TikTok → error de dominio, URL TikTok válida → dispatch `START_DOWNLOAD`, corrección del error → desaparece.

### Tests para User Story 1

- [ ] T014 [P] [US1] Crear `front/src/lib/tiktok-url.test.ts` con tests unitarios para `getUrlError`: URL vacía retorna mensaje de campo vacío; URL youtube retorna mensaje no-TikTok; `tiktok.com/explore` retorna mensaje no-video; `tiktok.com/@user/video/123` retorna null; `vm.tiktok.com/ABC123` retorna null; `vt.tiktok.com/XYZ` retorna null
- [ ] T015 [P] [US1] Crear `front/src/lib/app-state.test.ts` con tests para `appReducer`: estado inicial es `{ screen: "home" }`; `START_DOWNLOAD` transiciona a `downloading`; `DOWNLOAD_COMPLETE` desde `downloading` transiciona a `preview` con `videoData`; `RESET` desde cualquier estado vuelve a `home`; `OPEN_TRIM` desde `preview` transiciona a `trim` con `trimSelection` inicial `[0, durationSeconds]`; `BACK_TO_PREVIEW` desde `trim` retorna a `preview`; `UPDATE_TRIM_SELECTION` pone `trimResult` en null; `CONFIRM_TRIM` crea `trimResult` con la selección y modo

### Implementación de User Story 1

- [ ] T016 [US1] Crear `front/src/components/home-screen.tsx` con `"use client"`: logo TrimTok (texto o SVG placeholder), título/subtítulo descriptivos; `<Input>` con `aria-label="URL del video de TikTok"`, `aria-invalid` cuando hay error, `aria-describedby` apuntando al id del mensaje de error; mensaje de error con `role="alert"` e `id` referenciado; botón "Descargar" que al hacer clic llama `getUrlError(url)` y si null dispara `dispatch({ type: "START_DOWNLOAD", url })` (FR-001, FR-002, FR-003)
- [ ] T017 [US1] Actualizar `front/src/app/page.tsx` con `"use client"`, `useReducer(appReducer, initialState)` e importar todos los componentes de pantalla; añadir renderizado condicional para `state.screen === "home"` mostrando `<HomeScreen dispatch={dispatch} />`; añadir `<Footer>` siempre visible
- [ ] T018 [US1] Crear `front/src/components/home-screen.test.tsx` con tests RTL para los 4 acceptance scenarios: (1) submit vacío → error visible "Pega un enlace de TikTok"; (2) URL youtube → error visible; (3) URL TikTok válida → dispatch llamado con `START_DOWNLOAD`; (4) corrección de URL tras error → submit exitoso sin error; test de accesibilidad con `axe()` sin violaciones

**Checkpoint**: Home Screen funcional e independientemente testeable — `npm test src/components/home-screen` pasa; validación visual correcta en navegador

---

## Phase 4: User Story 2 — Pantalla de carga tras iniciar descarga (Priority: P2)

**Goal**: El usuario ve retroalimentación visual (`Progress` animado + "Descargando...") y la app navega automáticamente a la previsualización tras 2500ms.

**Independent Test**: Renderizar `<DownloadingScreen>` con mock de dispatch; verificar `role="progressbar"` presente, texto "Descargando..." visible; verificar que dispatch `DOWNLOAD_COMPLETE` se llama con `MOCK_VIDEO_DATA` tras avanzar el tiempo con `vi.useFakeTimers()`.

### Tests para User Story 2

- [ ] T019 [P] [US2] Crear `front/src/components/downloading-screen.test.tsx` con tests RTL: `role="progressbar"` presente con `aria-label`; texto "Descargando..." visible; usando `vi.useFakeTimers()` verificar que dispatch es llamado con `{ type: "DOWNLOAD_COMPLETE", videoData: MOCK_VIDEO_DATA }` tras 2500ms; test de accesibilidad con `axe()`

### Implementación de User Story 2

- [ ] T020 [US2] Crear `front/src/components/downloading-screen.tsx` con `"use client"`: componente `<Progress>` de shadcn con valor animado progresando de 0 a 100 durante 2500ms, `role="progressbar"` explícito (override al de shadcn si necesario), `aria-label="Descargando video"`, texto "Descargando..." centrado; `useEffect` con `setTimeout` de 2500ms que dispara `dispatch({ type: "DOWNLOAD_COMPLETE", videoData: MOCK_VIDEO_DATA })` (FR-004, FR-005)
- [ ] T021 [US2] Añadir case `state.screen === "downloading"` al renderizado condicional en `front/src/app/page.tsx` para mostrar `<DownloadingScreen url={state.url} dispatch={dispatch} />`

**Checkpoint**: Flujo Home → Downloading → Preview funciona end-to-end con datos mock en el navegador

---

## Phase 5: User Story 3 — Previsualizar y descargar el video completo (Priority: P3)

**Goal**: El usuario ve reproductor de video funcional, título del video y botones de descarga MP4/MP3 + acceso a Recortar y "Nueva descarga".

**Independent Test**: Renderizar `<PreviewScreen videoData={MOCK_VIDEO_DATA} dispatch={dispatch} />`; verificar reproductor presente, título renderizado (truncado si >120 chars), 4 botones presentes; "Nueva descarga" dispara `RESET`; "Recortar" dispara `OPEN_TRIM`.

### Tests para User Story 3

- [ ] T022 [P] [US3] Crear `front/src/components/video-player.test.tsx` con tests: elemento `<video>` en el DOM con atributo `controls`; `aria-label` presente en el wrapper `role="region"`; test de accesibilidad con `axe()`
- [ ] T023 [P] [US3] Crear `front/src/components/preview-screen.test.tsx` con tests RTL para acceptance scenarios de US3: reproductor visible con `MOCK_VIDEO_DATA.videoUrl`; título visible (truncado a 120 chars si excede); botones "Descargar MP4", "Descargar MP3", "Recortar", "Nueva descarga" presentes; clic "Nueva descarga" dispara dispatch `RESET`; clic "Recortar" dispara dispatch `OPEN_TRIM`; test de accesibilidad con `axe()`

### Implementación de User Story 3

- [ ] T024 [US3] Crear `front/src/components/video-player.tsx` con `"use client"`: wrapper `<div role="region" aria-label="Reproductor de video">`; `<video controls src={src} className="w-full" />`; props: `src: string`, opcional `startTime?: number`, `endTime?: number` (para implementar restricción de segmento en US4); el `onTimeUpdate` para restricción de segmento se implementa en US4 (FR-006, FR-010)
- [ ] T025 [US3] Crear `front/src/components/preview-screen.tsx` con `"use client"`: `<VideoPlayer src={videoData.videoUrl} />`; título truncado a 120 caracteres con `...` si es más largo; botones "↓ Descargar MP4" y "↓ Descargar MP3" (acción simulada: `console.log("download mp4/mp3")`); botón "✂ Recortar" que dispara `dispatch({ type: "OPEN_TRIM" })`; botón/enlace "Nueva descarga" que dispara `dispatch({ type: "RESET" })` (FR-006, FR-007)
- [ ] T026 [US3] Añadir case `state.screen === "preview"` al renderizado condicional en `front/src/app/page.tsx` para mostrar `<PreviewScreen videoData={state.videoData} dispatch={dispatch} />`

**Checkpoint**: Flujo completo Home → Downloading → Preview funcional; botón "✂ Recortar" activa transición a TrimState aunque la pantalla de recorte aún no está implementada

---

## Phase 6: User Story 4 — Recortar el video seleccionando inicio y fin (Priority: P4)

**Goal**: El usuario selecciona un segmento con el slider bidireccional, edita campos INICIO/FIN en formato HH:MM:SS, previsualiza el segmento, y descarga MP4/MP3/GIF según duración ≤6s.

**Independent Test**: Renderizar `<TrimScreen videoData={MOCK_VIDEO_DATA} trimSelection={{ startSeconds: 0, endSeconds: 25 }} trimResult={null} dispatch={dispatch} />`; verificar slider con dos thumbs, campos INICIO/FIN sincronizados, botón GIF deshabilitado para segmento >6s (aria-disabled), botón GIF habilitado para ≤6s, invalidación de trimResult al mover slider.

### Tests para User Story 4

- [ ] T027 [P] [US4] Crear `front/src/lib/time-format.test.ts` con tests unitarios: `formatHHMMSS(0)` → `"0:00:00"`; `formatHHMMSS(65)` → `"0:01:05"`; `formatHHMMSS(3661)` → `"1:01:01"`; `parseHHMMSS("0:01:05")` → `65`; `parseHHMMSS("invalid")` → `null`; `parseHHMMSS("0:60:00")` → `null`; `parseHHMMSS("0:00:60")` → `null`
- [ ] T028 [P] [US4] Crear `front/src/components/trim-screen.test.tsx` con tests RTL: (1) slider con 2 thumbs visible; campos INICIO y FIN muestran tiempo con `formatHHMMSS`; (2) clic "▶ Previsualizar segmento" no dispara acción de navegación; (3) clic "✂ Recortar" dispara `CONFIRM_TRIM({mode:"video"})`; botones "Descargar MP4 recortado"/"MP3 recortado" aparecen en verde tras confirmar; (4) clic "✂ Crear GIF" con segmento ≤6s dispara `CONFIRM_TRIM({mode:"gif"})`; botón "Descargar GIF" verde aparece; (5) clic "✂ Crear GIF" con segmento >6s tiene `aria-disabled="true"` y tooltip visible al foco; (6) mover slider tras trimResult confirmado dispara `UPDATE_TRIM_SELECTION` poniendo trimResult en null (FR-016); (7) `getUrlError` con INICIO ≥ FIN — campo con error visual (FR-013); test de accesibilidad con `axe()`

### Implementación de User Story 4

- [ ] T029 [US4] Crear `front/src/components/trim-screen.tsx` — estructura base con `"use client"`: botón "← Volver" que dispara `dispatch({ type: "BACK_TO_PREVIEW" })`; `<VideoPlayer src={videoData.videoUrl} startTime={trimSelection.startSeconds} endTime={trimSelection.endSeconds} />`; título del video; sección de controles de recorte con `<Slider>`, campos de tiempo y botones de acción; `<Footer />` al pie (FR-008, FR-014)
- [ ] T030 [US4] Implementar sincronización bidireccional en `front/src/components/trim-screen.tsx`: `<Slider value={[startSeconds, endSeconds]} min={0} max={durationSeconds} step={0.1} onValueChange={([s, e]) => dispatch({ type: "UPDATE_TRIM_SELECTION", selection: { startSeconds: s, endSeconds: e } })} getAriaValueText={(v) => formatHHMMSS(v)} />`; campos INICIO/FIN editables que al blur parsean con `parseHHMMSS`, validan que start < end y 0 ≤ start < end ≤ duration, muestran error visual si inválido (FR-009, FR-013, WCAG `getAriaValueText`)
- [ ] T031 [US4] Implementar lógica de botones de acción en `front/src/components/trim-screen.tsx`: "▶ Previsualizar segmento" llama `videoRef.current.currentTime = startSeconds` y `play()`, con listener `ontimeupdate` que pausa en `endTime` (FR-010); mostrar botones de descarga cuando `trimResult !== null`: MP4/MP3 recortados en verde (`bg-[#00c853]`) si `mode === "video"`, GIF en verde si `mode === "gif"` (FR-011, FR-012); `<Tooltip>` en el botón GIF cuando `aria-disabled="true"` (FR-012); mostrar botones de selección ("▶ Previsualizar", "✂ Recortar", "✂ Crear GIF") cuando `trimResult === null` (FR-016)
- [ ] T032 [US4] Añadir case `state.screen === "trim"` al renderizado condicional en `front/src/app/page.tsx` para mostrar `<TrimScreen videoData={state.videoData} trimSelection={state.trimSelection} trimResult={state.trimResult} dispatch={dispatch} />`; implementar también la restricción en `<VideoPlayer>` usando `useRef` para controlar la reproducción de segmento (FR-010)

**Checkpoint**: Flujo completo de recorte funcional — selección con slider, previsualización del segmento, descarga MP4/MP3 y GIF según duración ≤6s; todos los tests US4 pasan

---

## Phase 7: Polish & Concerns Transversales

**Purpose**: Layout global, estilos finales, scripts npm y tests E2E de extremo a extremo

- [ ] T033 [P] Actualizar `front/src/app/layout.tsx` con `lang="es"`, metadatos TrimTok (`title: "TrimTok"`, `description: "Descarga y recorta videos de TikTok"`), mantener fuentes Geist, envolver `{children}` con el `<Footer>` renderizado en todas las pantallas (FR-014); nota: dado que footer ya está en cada screen, asegurar que no se duplique — elegir estrategia en layout ó en screens
- [ ] T034 [P] Revisar y finalizar `front/src/app/globals.css`: confirmar que variables `--trimtok-*` están declaradas bajo `:root`; añadir `body { background: var(--trimtok-bg); color: var(--trimtok-text); }` para aplicar el tema TrimTok globalmente; asegurar que override del tema shadcn dark (`neutral`) sea compatible con Tailwind v4 sin `tailwind.config.js`
- [ ] T035 Actualizar `front/package.json` añadiendo scripts: `"test": "vitest"`, `"test:run": "vitest run"`, `"coverage": "vitest run --coverage"`, `"lint": "biome check ."`, `"format": "biome format --write ."` (no modificar scripts existentes, solo agregar los faltantes; ver quickstart.md §7)
- [ ] T036 [P] Crear `front/e2e/download-flow.spec.ts` con tests Playwright: navegar a `/`; rellenar campo URL con URL TikTok válida; hacer clic "Descargar"; verificar que aparece texto "Descargando..."; esperar transición automática; verificar que aparece reproductor de video y botones de descarga MP4/MP3; clic "Nueva descarga" regresa al Home (en 3 proyectos: chromium, Mobile Chrome, Mobile Safari)
- [ ] T037 [P] Crear `front/e2e/trim-flow.spec.ts` con tests Playwright: desde PreviewScreen hacer clic "✂ Recortar"; verificar que aparece TrimScreen con slider y campos INICIO/FIN; interactuar con slider; hacer clic "✂ Recortar" (acción de confirmación); verificar botones "Descargar MP4 recortado" y "Descargar MP3 recortado" en verde; hacer clic "← Volver" regresa a PreviewScreen (en chromium y Mobile Chrome)
- [ ] T038 Ejecutar `axe()` en cada componente de pantalla en sus respectivos test files (si no está ya incluido en T018, T019, T022, T023, T028) y corregir cualquier violación WCAG 2.1 AA detectada; verificar especialmente: contraste de color en botones verdes sobre negro, foco visible en todos los elementos interactivos, `aria-label` en el slider Radix, anuncio correcto del tooltip de GIF con `aria-disabled`

**Checkpoint**: Build estático limpio (`npm run build` genera `/out` sin warnings); cobertura ≥80% (`npm run coverage`); todos los E2E pasan en 3 proyectos Playwright; sin violaciones axe en ninguna pantalla

---

## Dependencias y Orden de Ejecución

### Dependencias por Fase

- **Setup (Phase 1)**: Sin dependencias — puede iniciar de inmediato
- **Foundational (Phase 2)**: Depende de Setup — **BLOQUEA todas las user stories**
- **User Stories (Phase 3–6)**: Todas dependen de Foundational; pueden paralelizarse con equipo o ejecutarse secuencialmente P1 → P4
- **Polish (Phase 7)**: Depende de que todas las user stories estén completas

### Dependencias entre User Stories

| Story | Depende de | Razón |
|---|---|---|
| US1 (P1) | Solo Foundational | `HomeScreen` es independiente |
| US2 (P2) | US1 | `page.tsx` con useReducer se configura en T017 (US1) |
| US3 (P3) | US2 | `PreviewState` solo es alcanzable tras `DOWNLOAD_COMPLETE` |
| US4 (P4) | US3 | `TrimState` solo es alcanzable desde `PreviewScreen` (botón "Recortar") |

### Dentro de Cada User Story

- Tests DEBEN escribirse **antes** de implementar (verificar que fallan)
- Módulos lib antes que componentes
- Componentes leaf antes que el componente raíz (`page.tsx`)
- Hacer commit tras cada tarea o grupo lógico de una story

### Oportunidades de Paralelización

- **Phase 1**: T006, T007, T008 pueden ejecutarse en paralelo con T004 (archivos diferentes)
- **Phase 2**: T009, T010, T011, T013 se pueden ejecutar en paralelo; T012 depende de T009 y T011
- **Phase 3**: T014 y T015 pueden ejecutarse en paralelo
- **Phase 5**: T022 y T023 pueden ejecutarse en paralelo; T024 y T025 en paralelo
- **Phase 6**: T027 y T028 pueden ejecutarse en paralelo; T029, T030, T031 secuenciales (mismo archivo)
- **Phase 7**: T033, T034, T036, T037 pueden ejecutarse en paralelo

---

## Ejemplo Paralelo: Foundational (Phase 2)

```bash
# Ejecutar en paralelo (archivos distintos, sin dependencias entre sí):
Task T009: front/src/lib/tiktok-url.ts
Task T010: front/src/lib/time-format.ts
Task T011: front/src/lib/mock-data.ts
Task T013: front/src/components/footer.tsx

# Luego (depende de T009 y T011 para los tipos VideoData y AppState):
Task T012: front/src/lib/app-state.ts
```

---

## Estrategia de Implementación

### MVP First (Solo User Story 1)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (**CRÍTICO** — bloquea todo)
3. Completar Phase 3: User Story 1
4. **DETENER Y VALIDAR**: `HomeScreen` funciona independientemente con validación de URL
5. Demo o deploy si está listo

### Entrega Incremental

1. Setup + Foundational → Base lista
2. + US1 → Validación de URL funcional → **Demo (MVP!)**
3. + US2 → Flujo de descarga con feedback visual → Demo
4. + US3 → Previsualización y descarga completa → Demo
5. + US4 → Recorte + GIF → Demo completa
6. + Polish → Release

### Estrategia de Equipo Paralelo

Con múltiples desarrolladores, después de completar Setup + Foundational:

- **Dev A**: US1 → US2 (flujo lineal, mismos archivos: `page.tsx`, `home-screen`, `downloading-screen`)
- **Dev B**: `video-player.tsx` (independiente), tests de lib (T014, T015, T027), `preview-screen.tsx`

---

## Resumen

| Fase | Tasks | User Story | Archivos clave |
|---|---|---|---|
| Phase 1: Setup | T001–T008 | — | `next.config.ts`, `vitest.config.ts`, `vitest-setup.ts`, `playwright.config.ts`, `globals.css` |
| Phase 2: Foundational | T009–T013 | — | `tiktok-url.ts`, `time-format.ts`, `mock-data.ts`, `app-state.ts`, `footer.tsx` |
| Phase 3: US1 | T014–T018 | US1 (P1) 🎯 | `tiktok-url.test.ts`, `app-state.test.ts`, `home-screen.tsx`, `home-screen.test.tsx`, `page.tsx` |
| Phase 4: US2 | T019–T021 | US2 (P2) | `downloading-screen.test.tsx`, `downloading-screen.tsx`, `page.tsx` |
| Phase 5: US3 | T022–T026 | US3 (P3) | `video-player.test.tsx`, `preview-screen.test.tsx`, `video-player.tsx`, `preview-screen.tsx`, `page.tsx` |
| Phase 6: US4 | T027–T032 | US4 (P4) | `time-format.test.ts`, `trim-screen.test.tsx`, `trim-screen.tsx`, `page.tsx` |
| Phase 7: Polish | T033–T038 | — | `layout.tsx`, `globals.css`, `package.json`, `e2e/download-flow.spec.ts`, `e2e/trim-flow.spec.ts` |

**Total**: 38 tareas | **MVP**: 21 tareas (phases 1–3) | **Full**: 38 tareas

---

## Notes

- `[P]` = archivos distintos, sin dependencias entre sí — pueden ejecutarse en paralelo
- `[Story]` relaciona la tarea con su user story para trazabilidad
- Cada user story es completable y testeable de forma independiente
- Verificar que los tests **fallan** antes de implementar (TDD light)
- Hacer commit después de cada tarea o grupo lógico
- Detenerse en cada Checkpoint para validar la story independientemente
- Evitar: tareas vagas, conflictos en el mismo archivo entre devs, dependencias cross-story que rompan la independencia
