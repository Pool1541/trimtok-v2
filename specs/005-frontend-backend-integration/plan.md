# Implementation Plan: Frontend–Backend Integration

**Branch**: `005-frontend-backend-integration` | **Date**: 2026-04-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-frontend-backend-integration/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Replace all mock data and stub `console.log` handlers in the TrimTok frontend with real API calls to the AWS backend. The frontend uses **TanStack Query v5** for HTTP mutations/queries and **`react-use-websocket`** for real-time job status notifications via API Gateway WebSocket. A minimal backend change is required to always return `jobId` from `POST /v1/jobs` (including on cache hit).

## Technical Context

**Language/Version**: TypeScript 5.x (frontend) / TypeScript 5.x Node 20 (backend)
**Primary Dependencies**:
- Frontend: Next.js 16.2.3 (`output: "export"`), React 19, Tailwind CSS v4, shadcn/ui (new-york)
- New frontend: `@tanstack/react-query` v5, `react-use-websocket` v4
- Backend: Hono 4.x, AWS SDK v3, Zod, SST 4.x, DynamoDB (single-table), SQS, S3

**Storage**: DynamoDB (single-table) + S3 (artifacts). No new tables or indexes required.
**Testing**: Frontend — Vitest + Testing Library (unit/integration), Playwright (E2E). Backend — N/A (no new use cases, only a localized fix to `create-job.usecase.ts`).
**Target Platform**: Static web app (Next.js static export) + AWS Lambda (backend, unchanged).
**Project Type**: Web application (frontend integration feature)
**Performance Goals**: Job download notification latency ≤ real processing time (WS eliminates polling overhead).
**Constraints**: Frontend must remain a static export (no SSR, no API routes). All business logic stays in the backend.
**Scale/Scope**: Frontend-only integration; backend receives a single localized fix.

## Constitution Check

### Principle II — Frontend Isolation ✅

All data access goes through versioned API Gateway endpoints (`/v1/`). The frontend calls no AWS services directly. TanStack Query and `react-use-websocket` are rendering-layer concerns.

### Principle I — Serverless-First Architecture ✅

No new Lambda functions, queues, or tables. The backend change (`create-job.usecase.ts`) is additive within the existing Lambda handler.

### Principle V — API Design Discipline ✅

`POST /v1/jobs` response shape is extended to always include `jobId`. This is a backwards-compatible addition (new field) for the cache-miss path; a field addition for the cache-hit path. Treated as non-breaking in the context of this feature branch — no existing clients depend on the cache-hit response shape.

### Principle VIII — Testing Discipline ✅

Frontend Vitest integration tests for modified components will be updated to mock `@tanstack/react-query` mutations and `useJobWebSocket` instead of `MOCK_VIDEO_DATA`. All existing unit tests continue to pass.

### All other principles: N/A or ✅

No violations. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/005-frontend-backend-integration/
├── plan.md              ← this file
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
└── checklists/
    ├── requirements.md
    └── integration.md
```

### Source Code Changes

```text
# Backend (minimal change)
back/src/jobs/application/create-job.usecase.ts    ← return job entity on cache hit
back/src/handlers/api/create-job.ts                ← always return { jobId, status, downloadUrl? }

# Frontend — new files
front/src/lib/query-client.ts                      ← QueryClient singleton
front/src/lib/api-client.ts                        ← typed fetch functions
front/src/lib/ws-client.ts                         ← useJobWebSocket hook
front/.env.local.example                           ← committed reference

# Frontend — modified files
front/src/lib/app-state.ts                         ← VideoData + TrimState + new AppActions
front/src/app/layout.tsx                           ← add QueryClientProvider
front/src/components/downloading-screen.tsx        ← real POST /v1/jobs + WS
front/src/components/preview-screen.tsx            ← real download buttons
front/src/components/trim-screen.tsx               ← real trim/gif/mp3 + WS
front/package.json                                 ← new dependencies

# Frontend — deleted
front/src/lib/mock-data.ts                         ← removed once all imports replaced
```

**Structure Decision**: Option 2 (web application). The project is a monorepo with `front/` and `back/` directories. Changes span both, with the frontend being the primary change surface.

## Implementation Phases

### Phase A — Backend Fix: `POST /v1/jobs` always returns `jobId`

**Prerequisite**: None.
**Why first**: All frontend flows require `jobId`. Without this backend change, cache-hit users can never trim, download GIF, or request MP3 from the trim screen.

#### A1 — `back/src/jobs/application/create-job.usecase.ts`

On the cache-hit path (artifact already exists in S3):
- Retrieve or construct a `Job` entity with `status: JobStatus.ready` and the matching `s3Key`.
- Persist it via `jobRepo.save(job)` so the entity exists in DynamoDB.
- Return `{ hit: true, job, downloadUrl }` where `job.jobId` is populated.

#### A2 — `back/src/handlers/api/create-job.ts`

Replace the cache-hit 200 response:
```ts
// Before (approximate)
return c.json({ status: "ready", downloadUrl }, 200)

// After
return c.json({ jobId: result.job.jobId, status: "ready" as const, downloadUrl: result.downloadUrl }, 200)
```

Both paths (cache-hit and cache-miss) now return `{ jobId, status, downloadUrl? }`.

**Verification**: `POST /v1/jobs` with a URL whose artifact is already in S3 returns `{ jobId, status: "ready", downloadUrl }`.

---

### Phase B — Infrastructure: Dependencies + Env + QueryClient

**Prerequisite**: None (can run in parallel with Phase A).

#### B1 — Install dependencies

```bash
cd front
npm install @tanstack/react-query react-use-websocket
npm install -D @tanstack/react-query-devtools
```

#### B2 — `front/.env.local.example`

```env
NEXT_PUBLIC_API_URL=https://rxidfoa8o1.execute-api.us-east-1.amazonaws.com
NEXT_PUBLIC_WS_URL=wss://x532bxsc3h.execute-api.us-east-1.amazonaws.com/$default
```

> Copy to `.env.local` and fill real values from `back/.sst/outputs.json`.

#### B3 — `front/src/lib/query-client.ts`

```ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, retry: 1 },
    mutations: { retry: 0 },
  },
});
```

#### B4 — `front/src/app/layout.tsx`

Wrap children with `<QueryClientProvider client={queryClient}>`. In dev, append `<ReactQueryDevtools initialIsOpen={false} />`.

---

### Phase C — App State Extension

**Prerequisite**: Phase B.
**File**: `front/src/lib/app-state.ts`

Changes:
1. `VideoData` — add `jobId: string` (required), `thumbnailUrl?: string`.
2. `TrimState` — add `trimDownloadUrl: string | null`.
3. `AppAction` union — add:
   - `{ type: "DOWNLOAD_ERROR" }` → resets to `HomeState`.
   - `{ type: "TRIM_COMPLETE"; payload: { downloadUrl: string } }` → sets `trimDownloadUrl` on `TrimState`.
   - `{ type: "TRIM_ERROR" }` → clears `trimDownloadUrl: null` (component surfaces error).
4. `appReducer` — implement new cases.

---

### Phase D — New Client Modules

**Prerequisite**: Phase B (for package availability).

#### D1 — `front/src/lib/api-client.ts`

Typed `fetch` wrappers. Each function:
- Reads `process.env.NEXT_PUBLIC_API_URL` as base URL.
- Throws `ApiError` (subclass of `Error`) on non-2xx.

Exported functions and types:

```ts
createJob(sourceUrl: string): Promise<CreateJobResponse>      // POST /v1/jobs
getJob(jobId: string): Promise<GetJobResponse>                  // GET /v1/jobs/:jobId
requestTrim(jobId: string, start: number, end: number):
  Promise<TrimResponse>                                         // POST /v1/jobs/:jobId/trim
requestGif(jobId: string, start: number, end: number):
  Promise<GifResponse>                                          // POST /v1/jobs/:jobId/gif
requestMp3(jobId: string, start: number, end: number):
  Promise<Mp3Response>                                          // POST /v1/jobs/:jobId/mp3

// Helper
triggerDownload(url: string, filename?: string): void           // programmatic <a> click
```

Exported types: `CreateJobResponse`, `GetJobResponse`, `TrimResponse`, `GifResponse`, `Mp3Response`, `ApiError`.

#### D2 — `front/src/lib/ws-client.ts`

```ts
useJobWebSocket(
  jobId: string | null,
  onMessage: (msg: WsJobMessage) => void,
  timeoutMs?: number   // default 120_000
): { isConnected: boolean; isConnecting: boolean; connectionError: string | null }
```

Implementation using `react-use-websocket`:
- Reads `process.env.NEXT_PUBLIC_WS_URL` as endpoint.
- `shouldReconnect: () => false` (do not reconnect on terminal status).
- `onOpen`: immediately sends `JSON.stringify({ action: "subscribe", jobId })`.
- `onMessage` → `JSON.parse` → dispatch `WsJobMessage` union to caller's `onMessage`.
  - On `type: "subscribed"`: if `currentStatus` is terminal, calls `onMessage` with a synthetic `job_update` payload `{ type: "job_update", jobId, status: currentStatus }`.
- `setTimeout(timeoutMs)`: if no terminal message within timeout, calls `onMessage({ type: "timeout" })`.
- Clears timeout on unmount or on any terminal status received.

Exported types: `WsJobMessage`, `JobStatus`, `TERMINAL_STATUSES`.

---

### Phase E — Component Integration

**Prerequisite**: Phases A, C, D.

#### E1 — `front/src/components/downloading-screen.tsx`

Replace the `setTimeout(2500)` mock with:

1. `useMutation({ mutationFn: createJob })` (TanStack Query).
2. On component mount → `mutate(sourceUrl)`.
3. On `onSuccess(data)`:
   - If `data.status === "ready"` (cache hit) and `data.downloadUrl` is present:
     - Call `queryClient.fetchQuery({ queryKey: ["job", data.jobId], queryFn: () => getJob(data.jobId) })`.
     - `dispatch({ type: "DOWNLOAD_COMPLETE", payload: { videoData: mapToVideoData(jobResult, data.jobId) } })`.
   - Else (status: `"pending"`): set `activeJobId` → `useJobWebSocket` activates.
4. `handleWsMessage(msg)`:
   - `status === "ready"` → `getJob(jobId)` → `dispatch(DOWNLOAD_COMPLETE)`.
   - `status === "error"` → `dispatch({ type: "DOWNLOAD_ERROR" })`.
   - type `"timeout"` → `dispatch({ type: "DOWNLOAD_ERROR" })`.
5. Remove all `MOCK_VIDEO_DATA` usage.

#### E2 — `front/src/components/preview-screen.tsx`

Replace `console.log` stubs:
1. **"Descargar MP4"** button — call `triggerDownload(videoData.videoUrl)` directly (presigned URL already in state).
2. **"Descargar MP3"** button — `useMutation({ mutationFn: () => requestMp3(jobId, 0, duration) })`. Show "procesando..." state. On response or WS `mp3_ready` → `getJob(jobId)` → `triggerDownload(url)`.

#### E3 — `front/src/components/trim-screen.tsx`

Replace `console.log("download …")` calls:

| Button | API Call | Terminal WS status | Action |
|--------|----------|--------------------|--------|
| Descargar MP4 recortado | `requestTrim(jobId, start, end)` | `trimmed` | `getJob` → `triggerDownload` |
| Descargar GIF | `requestGif(jobId, start, end)` | `gif_created` | `getJob` → `triggerDownload` |
| Descargar MP3 recortado | `requestMp3(jobId, start, end)` | `mp3_ready` | `getJob` → `triggerDownload` |

On `onSuccess` with `status === "trimmed" / "gif_created" / "mp3_ready"` (cache hit): skip WS, call `getJob` immediately.
On `onSuccess` with async status: open `useJobWebSocket(jobId, handleWsMessage)`.
While waiting: disable active button, show inline spinner. On terminal: re-enable, trigger download.

---

### Phase F — Cleanup

**Prerequisite**: All of Phases A–E passing tests.

1. Delete `front/src/lib/mock-data.ts`.
2. Search for remaining `MOCK_VIDEO_DATA` references and replace with realistic test fixtures in test files.
3. Update Vitest integration test fixtures to match new `VideoData` shape (`jobId` required).
4. Run `biome check front/src --apply`.
5. Run `npm run test` in `front/` — all tests green.
6. Run `npx playwright test` — smoke-test the full flow against a real (or local) backend.

---

## Complexity Tracking

No Constitution Check violations. No entries required.

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| WS message arrives before `subscribe` is sent (race) | Low | `subscribe.ts` returns `currentStatus`; hook handles it as an immediate `job_update`. |
| Presigned URL expires between WS notification and user click | Low | 3600s validity; typical processing is <60s. Not mitigated further. |
| `POST /v1/jobs` cache-hit DynamoDB write fails | Low | Treat as non-blocking; log error; return existing artifact URL without persisting entity. |
| `react-use-websocket` reconnect creates duplicate subscriptions | Low | WS only active on one screen at a time; hook unmounts on navigation. |
| Backend change breaks existing non-cache-hit path | Low | Only the cache-hit branch is touched; existing unit tests for cache-miss path remain. |
