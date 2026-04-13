# Tasks: Frontend–Backend Integration

**Input**: Design documents from `specs/005-frontend-backend-integration/`
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/api.md ✅

**Organization**: Tasks grouped by user story enabling independent implementation per story.
**Tests**: No TDD explicitly requested — test-update tasks included in Polish phase to keep existing suite green.

## Format: `[ID] [P?] [Story?] Description — file path`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[US#]**: Which user story this task belongs to
- All paths are relative to the monorepo root

---

## Phase 1: Setup

**Purpose**: Install new dependencies and create shared infrastructure files. No source code changes that affect runtime behaviour yet.

- [ ] T001 Install `@tanstack/react-query`, `react-use-websocket`, and `@tanstack/react-query-devtools` in `front/package.json`
- [ ] T002 [P] Create `front/.env.local.example` with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` placeholder values
- [ ] T003 [P] Create `front/src/lib/query-client.ts` — singleton `QueryClient` with `staleTime: Infinity`, `retry: 1` for queries, `retry: 0` for mutations

**Checkpoint**: Dependencies installed, env reference committed, QueryClient ready.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend contract fix + all client infrastructure modules. Must be complete before any user story can be integrated.

**⚠️ CRITICAL**: All user story implementation (Phases 3–6) depends on this phase.

- [ ] T004 Fix cache-hit path in `back/src/jobs/application/create-job.usecase.ts` — on S3 artifact cache hit, construct a `Job` entity with `status: JobStatus.ready` and the matching `s3Key`, persist it via `jobRepo.save(job)`, return `{ hit: true, job, downloadUrl }` (job is no longer null)
- [ ] T005 Update `back/src/handlers/api/create-job.ts` — replace cache-hit response branch to always return `{ jobId: result.job.jobId, status: "ready", downloadUrl: result.downloadUrl }` so both HTTP 200 and HTTP 201 paths return `jobId`
- [ ] T006 [P] Extend `front/src/lib/app-state.ts` — add `jobId: string` and `thumbnailUrl?: string` to `VideoData`; add `trimDownloadUrl: string | null` to `TrimState`; add `DOWNLOAD_ERROR`, `TRIM_COMPLETE`, and `TRIM_ERROR` to the `AppAction` union; implement new reducer cases
- [ ] T007 [P] Create `front/src/lib/api-client.ts` — typed `fetch` wrappers: `createJob`, `getJob`, `requestTrim`, `requestGif`, `requestMp3`; `triggerDownload` helper for programmatic `<a>` click; `ApiError` class with `httpStatus`, `code`, `message`; export all response types (`CreateJobResponse`, `GetJobResponse`, `TrimResponse`, `GifResponse`, `Mp3Response`)
- [ ] T008 [P] Create `front/src/lib/ws-client.ts` — `useJobWebSocket(jobId, onMessage, timeoutMs?)` hook using `react-use-websocket`; sends `{ action: "subscribe", jobId }` on `onOpen`; on `type: "subscribed"` checks `currentStatus` and fires synthetic `job_update` if terminal; 120s timeout; returns `{ isConnected, isConnecting, connectionError }`; export `WsJobMessage` union, `JobStatus` type, `TERMINAL_STATUSES` set
- [ ] T009 Update `front/src/app/layout.tsx` — import `queryClient` from `lib/query-client.ts`, wrap children with `<QueryClientProvider client={queryClient}>`; add `<ReactQueryDevtools initialIsOpen={false} />` guarded by `process.env.NODE_ENV === "development"`

**Checkpoint**: Backend always returns `jobId`. All client infrastructure modules exist and are typed. Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — Descargar video de TikTok (Priority: P1) 🎯 MVP

**Goal**: Replace the 2500ms mock in `DownloadingScreen` with a real `POST /v1/jobs` call and a WebSocket subscription that drives the transition to `PreviewScreen` with real video data.

**Independent Test**: Paste a valid TikTok URL → `DownloadingScreen` spins → receives WS `status: "ready"` → `PreviewScreen` loads with real title, duration, and streamable video URL from S3.

- [ ] T010 [US1] Rewrite `front/src/components/downloading-screen.tsx` — replace `setTimeout(2500)` mock with: `useMutation({ mutationFn: createJob })` fired on mount; on `status: "ready"` (cache hit) call `queryClient.fetchQuery(getJob)` then `dispatch(DOWNLOAD_COMPLETE)`; on `status: "pending"` activate `useJobWebSocket` and handle `job_update` `status: "ready"` → `getJob` → `dispatch(DOWNLOAD_COMPLETE)`, `status: "error"` / timeout → `dispatch(DOWNLOAD_ERROR)`; remove `MOCK_VIDEO_DATA` import

**Checkpoint**: User Story 1 fully functional — real video download flow works end-to-end.

---

## Phase 4: User Story 2 — Descargar MP4 y MP3 del video completo (Priority: P2)

**Goal**: Wire the two download buttons on `PreviewScreen` to real behaviour: MP4 uses the presigned URL already in state; MP3 creates a new backend job and waits for WS notification.

**Independent Test**: On `PreviewScreen`, clicking "Descargar MP4" triggers an immediate browser file download using `videoData.videoUrl`. Clicking "Descargar MP3" shows a processing state and downloads the file when `mp3_ready` arrives via WS.

- [ ] T011 [US2] Implement "Descargar MP4" button in `front/src/components/preview-screen.tsx` — replace `console.log` stub with `triggerDownload(videoData.videoUrl)`; no API call needed (presigned URL already in state)
- [ ] T012 [US2] Implement "Descargar MP3" button in `front/src/components/preview-screen.tsx` — use `useMutation({ mutationFn: () => requestMp3(videoData.jobId, 0, videoData.durationSeconds) })`; on HTTP 200 (`mp3_ready`) call `getJob` then `triggerDownload`; on HTTP 202 activate `useJobWebSocket`, listen for `status: "mp3_ready"` → `getJob` → `triggerDownload`; show inline loading state while waiting

**Checkpoint**: User Stories 1 AND 2 fully functional — download and preview flows work independently.

---

## Phase 5: User Story 3 — Recortar video y descargar segmento (Priority: P3)

**Goal**: Wire the "Descargar MP4 recortado" and "Descargar MP3 recortado" buttons in `TrimScreen` to the real trim/mp3 endpoints with WS-awaited downloads.

**Independent Test**: After selecting a trim range, clicking "Descargar MP4 recortado" calls `POST /v1/jobs/:jobId/trim`, waits for `status: "trimmed"` over WS (or uses cache-hit URL immediately), and downloads the trimmed file.

- [ ] T013 [US3] Implement "Descargar MP4 recortado" in `front/src/components/trim-screen.tsx` — replace `console.log` stub with `useMutation({ mutationFn: () => requestTrim(jobId, trimStart, trimEnd) })`; on HTTP 200 (`status: "trimmed"`) call `getJob(jobId)` then `triggerDownload`; on HTTP 202 activate `useJobWebSocket`, await `status: "trimmed"` → `getJob` → `dispatch(TRIM_COMPLETE, downloadUrl)` → `triggerDownload`; disable button and show spinner while pending
- [ ] T014 [US3] Implement "Descargar MP3 recortado" in `front/src/components/trim-screen.tsx` — replace `console.log` stub with `useMutation({ mutationFn: () => requestMp3(jobId, trimStart, trimEnd) })`; on HTTP 200 (`status: "mp3_ready"`) call `getJob(jobId)` then `triggerDownload`; on HTTP 202 activate `useJobWebSocket`, await `status: "mp3_ready"` → `getJob` → `triggerDownload`; disable button and show spinner while pending

**Checkpoint**: User Stories 1, 2, AND 3 all independently functional.

---

## Phase 6: User Story 4 — Crear y descargar GIF (Priority: P4)

**Goal**: Wire the "Crear GIF" button in `TrimScreen` to `POST /v1/jobs/:jobId/gif` and download the resulting silent H.264 MP4 on `gif_created`.

**Independent Test**: After selecting a trim range ≤ 6 s, clicking "Crear GIF" eventually downloads a valid silent MP4 file.

- [ ] T015 [US4] Implement "Crear GIF" button in `front/src/components/trim-screen.tsx` — replace `console.log` stub with `useMutation({ mutationFn: () => requestGif(jobId, trimStart, trimEnd) })`; on HTTP 200 (`status: "gif_created"`) call `getJob(jobId)` then `triggerDownload`; on HTTP 202 activate `useJobWebSocket`, await `status: "gif_created"` → `getJob` → `triggerDownload`; disable button and show spinner while pending

**Checkpoint**: All four user stories fully functional — complete feature is end-to-end integrated.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup mock artifacts, update existing tests to match new type shapes, verify tooling.

- [ ] T016 Delete `front/src/lib/mock-data.ts` and remove all `MOCK_VIDEO_DATA` imports from any remaining files in `front/src/`
- [ ] T017 [P] Update `front/tests/integration/downloading-screen.test.tsx` — replace `MOCK_VIDEO_DATA` fixtures with a real `VideoData` test object that includes `jobId: "test-job-id"`; mock `api-client` and `ws-client` modules instead of the removed mock
- [ ] T018 [P] Update `front/tests/integration/preview-screen.test.tsx` — replace `MOCK_VIDEO_DATA` fixtures with updated `VideoData` shape including `jobId`; assert that MP4 button calls `triggerDownload` not `console.log`
- [ ] T019 [P] Update `front/tests/integration/trim-screen.test.tsx` — replace `MOCK_VIDEO_DATA` fixtures with updated `VideoData` shape including `jobId`
- [ ] T020 [P] Update `front/tests/unit/app-state.test.ts` — add test cases for new reducer actions: `DOWNLOAD_ERROR`, `TRIM_COMPLETE`, `TRIM_ERROR`; update `VideoData` fixtures to include `jobId`
- [ ] T021 Run `npm run typecheck` and `npx biome check front/src` and `npm run test` in `front/` — all checks must pass with zero errors

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)       ─→  Phase 2 (Foundational)  ─→  Phase 3 (US1)
                                                    ─→  Phase 4 (US2)
                                                    ─→  Phase 5 (US3)
                                                    ─→  Phase 6 (US4)
                       All phases complete          ─→  Phase 7 (Polish)
```

- **Phase 1**: No dependencies — start immediately
- **Phase 2**: Depends on Phase 1 completion — **blocks all user story phases**
- **Phases 3–6**: All depend on Phase 2 completion; can proceed in priority order or in parallel if staffed
- **Phase 7**: Depends on all desired user story phases complete

### Task Dependencies Within Phase 2

```
T004  ─→  T005
T006 [P]  (no intra-phase dependency)
T007 [P]  (no intra-phase dependency)
T008 [P]  (no intra-phase dependency)
T006 + T007 + T008 + T009 can all run in parallel with each other
T009 depends on T003 (Phase 1)
```

### User Story Dependencies

- **US1 (P1)**: No cross-story dependencies. Implements the core WS + download flow used as reference by US2–US4.
- **US2 (P2)**: Independent; `videoData.jobId` in state (from US1 flow) enables the MP3 call. Can implement independently if `JobId` stub used in tests.
- **US3 (P3)**: T013 → T014 sequential (same file). Independent from US1/US2 at implementation level.
- **US4 (P4)**: T015 sequential after T013, T014 (same file). Independent from US2.

---

## Parallel Execution Examples

### Phase 2: Parallel foundation work

```
Developer A: T004 → T005  (backend fix)
Developer B: T006         (app-state)
Developer C: T007         (api-client)
Developer D: T008         (ws-client)
Developer A: T009         (layout.tsx, after T003 done)
```

### Phases 3–6: After Phase 2 complete

```
Developer A: T010 (US1 — downloading-screen)
Developer B: T011 → T012 (US2 — preview-screen)
Developer C: T013 → T014 → T015 (US3 + US4 — trim-screen)
```

### Phase 7: Parallel test updates

```
All T017, T018, T019, T020 can run in parallel (different test files)
T021 runs last to verify everything passes
```

---

## Implementation Strategy

### MVP Scope (Minimum for US1 proof-of-concept)

Phases 1 + 2 + Phase 3 (T001–T010): Gives you the full TikTok URL → download → preview screen flow with real data. Once US1 works, the rest of US2–US4 are incremental additions.

### Incremental Delivery Order

1. **Phase 1 + 2** — Infrastructure (no user-visible change yet; mocks still in place for components)
2. **Phase 3** — US1: working download flow (biggest risk item resolved)
3. **Phase 4** — US2: MP4 + MP3 download from preview (trivial + medium complexity)
4. **Phase 5** — US3: Trim + MP3 trim download
5. **Phase 6** — US4: GIF creation
6. **Phase 7** — Polish: cleanup mocks, green tests
