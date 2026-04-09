# Tasks: TrimTok Monorepo Scaffolding

**Input**: Design documents from `specs/001-monorepo-scaffold/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅, quickstart.md ✅  
**Tests**: Not requested — no test tasks generated  
**Branch**: `001-monorepo-scaffold`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in every task description

---

## Phase 1: Setup (Root Infrastructure)

**Purpose**: Initialize the repository root with workspace orchestration, Node.js pinning, and ignore rules.
All subsequent phases depend on the root `package.json` npm workspaces declaration.

- [ ] T001 Create root `package.json` with `"private": true`, `"workspaces": ["front","back"]`, `"engines": {"node":">=24.0.0","npm":">=10.8.0"}`, `"scripts": {"dev":"concurrently -n front,back -c cyan,yellow \"npm run dev --workspace=front\" \"npm run dev --workspace=back\"","build":"npm run build --workspace=front && npm run build --workspace=back"}`, `"devDependencies": {"concurrently":"^9.0.0"}` in `package.json`
- [ ] T002 [P] Create `.nvmrc` at repo root with single line content `24` in `.nvmrc`
- [ ] T003 [P] Create root `.gitignore` excluding `node_modules/`, `.next/`, `out/`, `dist/`, `.sst/`, `.env`, `.env.*`, `*.env.local` in `.gitignore`

**Checkpoint**: Root workspace configuration complete — `npm install` will install all sub-project dependencies in one step

---

## Phase 2: Foundational (Sub-Project Configuration)

**Purpose**: Create per-project `package.json` and `tsconfig.json` for both `/front` and `/back`.
These files are blocking prerequisites for ALL user stories — no story can be verified until this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [P] Create `front/package.json` with `"name":"front"`, `"private":true`, `"scripts":{"dev":"next dev","build":"next build","lint":"next lint"}`, `"dependencies":{"next":"^16.0.0","react":"^19.0.0","react-dom":"^19.0.0"}`, `"devDependencies":{"typescript":"^5.0.0","@types/node":"^24.0.0","@types/react":"^19.0.0","@types/react-dom":"^19.0.0"}` in `front/package.json`
- [ ] T005 [P] Create `back/package.json` with `"name":"back"`, `"private":true`, `"scripts":{"dev":"sst dev","build":"sst build","deploy":"sst deploy"}`, `"devDependencies":{"sst":"^4.0.0","@types/aws-lambda":"^8.10.0","typescript":"^5.0.0","@types/node":"^24.0.0"}` in `back/package.json`
- [ ] T006 [P] Create `front/tsconfig.json` with TypeScript strict mode, `"target":"ES2020"`, `"moduleResolution":"bundler"`, `"jsx":"preserve"`, `"noEmit":true`, `"strict":true`, `"plugins":[{"name":"next"}]`, includes `["next-env.d.ts",".next/types/**/*.ts","**/*.ts","**/*.tsx"]` in `front/tsconfig.json`
- [ ] T007 [P] Create `back/tsconfig.json` with TypeScript strict mode, `"target":"ES2024"`, `"module":"NodeNext"`, `"moduleResolution":"NodeNext"`, `"strict":true`, `"outDir":"./dist"`, `"rootDir":"./src"`, excludes `["node_modules","dist",".sst"]` in `back/tsconfig.json`

**Checkpoint**: Foundation ready — both sub-projects have valid package configurations and TypeScript settings. User story implementation can begin.

---

## Phase 3: User Story 1 — Start Full Dev Environment from Root (Priority: P1) 🎯 MVP

**Goal**: A developer can go from `npm install` at the repo root to both `[front]` (Next.js dev server on :3000) and `[back]` (SST Live Lambda) running concurrently with a single `npm run dev` command.

**Independent Test**: On a freshly cloned repo — run `npm install` then `npm run dev` from the root. Confirm `[front]` and `[back]` labeled output appears and `http://localhost:3000` is accessible. Both MUST be reachable within 60 seconds (AWS credentials required for `[back]`).

### Implementation for User Story 1

- [ ] T008 [P] [US1] Create `front/next.config.ts` with `output: 'export'` static export configuration using `NextConfig` TypeScript type in `front/next.config.ts`
- [ ] T009 [P] [US1] Create Next.js App Router root layout with `<html>` and `<body>` shell, `metadata` export with title `"TrimTok"`, no business logic in `front/src/app/layout.tsx`
- [ ] T010 [P] [US1] Create blank Next.js App Router index page exporting a default functional component with placeholder `<main>` element — no business logic, no styling in `front/src/app/page.tsx`
- [ ] T011 [P] [US1] Create `back/sst.config.ts` with `$config` declaring app name `"trimtok-back"`, `home: "aws"`, `removal: "remove"` for non-production stages, and `sst.aws.ApiGatewayV2` with `routes: { "GET /health": { handler: "src/health.handler" } }` outputting `ApiUrl` in `back/sst.config.ts`
- [ ] T012 [US1] Create health-check Lambda handler typed as `APIGatewayProxyHandlerV2` returning `statusCode: 200`, `Content-Type: application/json` header, and body `JSON.stringify({ status: "ok" })` in `back/src/health.ts`

**Checkpoint**: User Story 1 complete — `npm run dev` from root starts both projects. Front serves a blank page; back exposes `GET /health` via SST Live Lambda.

---

## Phase 4: User Story 2 — Build Both Projects for Production from Root (Priority: P2)

**Goal**: A single `npm run build` from the root produces a fully self-contained static bundle in `front/out/` and Lambda deployment artifacts in `back/.sst/` without errors.

**Independent Test**: Run `npm run build` on a clean working tree (all dependencies installed, no prior build). Confirm `front/out/` contains `index.html` and no source files. Confirm `back/.sst/` contains deployment artifacts. A TypeScript error in either project MUST cause the command to exit non-zero.

**Note**: The `build` script is implemented in T001 (root `package.json`) and static export is configured in T008 (`front/next.config.ts`). This phase validates that those configurations satisfy the production build story and adds the one remaining artifact: the `front/public/` directory placeholder.

### Implementation for User Story 2

- [ ] T013 [P] [US2] Create `front/public/.gitkeep` to preserve the `public/` static assets directory in version control — required by Next.js static export conventions in `front/public/.gitkeep`
- [ ] T014 [US2] Confirm root `package.json` `build` script matches the sequential pattern `npm run build --workspace=front && npm run build --workspace=back` (front must succeed before back is attempted per FR-004); update if divergent in `package.json`

**Checkpoint**: User Story 2 complete — `npm run build` produces static export artifacts for front and Lambda artifacts for back; any sub-project failure halts the pipeline.

---

## Phase 5: User Story 3 — Work on Each Project Independently (Priority: P3)

**Goal**: A developer can navigate into `/front` or `/back` and run `npm install` + `npm run dev` (or `npm run build`) independently, without the sibling project being installed or running.

**Independent Test**: From within `front/` only — run `npm install && npm run dev`. Next.js dev server MUST start without errors. From within `back/` only — run `npm install && npm run dev`. SST Live Lambda MUST start without errors. Neither project should import from or depend on the other.

**Note**: Per-project isolation is inherently provided by the package structure created in Phase 2 (T004, T005) and the npm workspaces declaration in T001. This phase confirms the isolation is correct and adds the workspace-scoped command validation.

### Implementation for User Story 3

- [ ] T015 [P] [US3] Confirm `front/package.json` `dev` and `build` scripts are self-contained (no cross-workspace references) and that `front` has no dependency on `back` in its `dependencies` or `devDependencies` in `front/package.json`
- [ ] T016 [US3] Confirm `back/package.json` `dev` and `build` scripts are self-contained (no cross-workspace references) and that `back` has no frontend dependency (`next`, `react`) in its `devDependencies` in `back/package.json`

**Checkpoint**: User Story 3 complete — each sub-project runs independently; per-workspace root commands (`npm run dev --workspace=front`) work correctly.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation of monorepo-wide rules, Node.js version enforcement, and spec compliance.

- [ ] T017 [P] Verify root `package.json` contains NO application configuration, routing rules, or business logic per FR-009 — only `workspaces`, `engines`, `scripts`, and `devDependencies` fields are permitted in `package.json`
- [ ] T018 [P] Verify `.gitignore` covers all required exclusions per FR-010: `node_modules/`, `.next/`, `out/`, `.sst/`, `dist/`, and environment files (`.env`, `.env.*`) in `.gitignore`
- [ ] T019 Verify `front/tsconfig.json` and `back/tsconfig.json` both have `"strict": true` — no plain JavaScript source files exist in either project per spec Assumptions in `front/tsconfig.json` and `back/tsconfig.json`

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    └─→ Phase 2 (Foundational)  [BLOCKS all user stories]
            ├─→ Phase 3 (US1 P1)  [MVP — can start independently after Phase 2]
            │       └─→ Phase 4 (US2 P2)  [builds on Phase 3 artifacts]
            │               └─→ Phase 5 (US3 P3)  [builds on Phase 2 + 3 artifacts]
            └─→ Phase 6 (Polish)  [after all user stories complete]
```

### User Story Dependencies

| Story | Depends On | Independent? |
|-------|-----------|-------------|
| US1 (P1) | Phase 1 + Phase 2 complete | Yes — no dependency on US2 or US3 |
| US2 (P2) | Phase 1 + Phase 2 + Phase 3 complete | Yes — builds on same files as US1, no extra story dependencies |
| US3 (P3) | Phase 2 complete | Yes — per-project scripts set up in Phase 2; does not depend on US1 or US2 |

### Within Each User Story

- App source files (T008, T009, T010, T011) can be created in parallel before handler integration (T012)
- T012 (`back/src/health.ts`) should be created after T011 (`sst.config.ts`) to confirm the handler path matches the SST route
- T014 (US2 build script audit) should run after T001 to confirm no drift since creation
- T015 / T016 (US3 isolation check) should run after T004 / T005

---

## Parallel Execution Examples

### Phase 2 (All parallel — different files)

```bash
# All can run simultaneously:
T004  →  create front/package.json
T005  →  create back/package.json
T006  →  create front/tsconfig.json
T007  →  create back/tsconfig.json
```

### Phase 3 (US1) — Parallel group then sequential

```bash
# Parallel group (independent files):
T008  →  create front/next.config.ts
T009  →  create front/src/app/layout.tsx
T010  →  create front/src/app/page.tsx
T011  →  create back/sst.config.ts

# Sequential (depends on T011 handler path):
T012  →  create back/src/health.ts
```

### Phase 6 (All parallel — independent audits)

```bash
T017  →  audit root package.json fields
T018  →  audit .gitignore coverage
# T019 runs after T017/T018 resolve
```

---

## Implementation Strategy

### MVP Scope (deliver US1 first)

Complete **Phase 1 → Phase 2 → Phase 3** in order. This is the minimum viable scaffold:
- Root workspace orchestration
- Sub-project config files
- Next.js blank app + SST health Lambda

At this point, any developer can clone and run `npm install && npm run dev`.

### Incremental Delivery

1. **Phase 1–3** (MVP): Dev environment working end-to-end → deliver US1
2. **Phase 4** (fast follow): Confirm build script + static export → deliver US2  
3. **Phase 5** (fast follow): Confirm per-project isolation → deliver US3
4. **Phase 6**: Polish pass — validate FR-009, FR-010, TypeScript strict enforcement

### Risk Notes

- `sst dev` (T012) requires **valid AWS credentials** in the developer environment.
  Developers without AWS access can verify US1 with frontend-only: `npm run dev --workspace=front`.
- `npm run build --workspace=back` (`sst build`) also requires AWS config for CDK synthesis.
  US2 backend build may need to be deferred for developers without credentials.
- Both are noted in `quickstart.md` under Common Issues.
