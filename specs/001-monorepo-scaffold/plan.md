# Implementation Plan: TrimTok Monorepo Scaffolding

**Branch**: `001-monorepo-scaffold` | **Date**: 2026-04-08 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/001-monorepo-scaffold/spec.md`

## Summary

Scaffold a TrimTok monorepo with two sub-projects: `/front` (Next.js 16 + TypeScript strict,
static export) and `/back` (SST Ion v4 + TypeScript strict, AWS Lambda + API Gateway). The
root `package.json` uses npm workspaces and `concurrently` to orchestrate install, dev, and
build commands across both projects from a single entry point. Node.js v24 LTS is enforced
via `.nvmrc` and the `engines` field. No business logic exists at scaffold stage.

## Technical Context

**Language/Version**: TypeScript (strict mode), Node.js ≥ 24 LTS  
**Primary Dependencies**: Next.js 16.x (front), SST Ion v4.x (back), concurrently 9.x (root)  
**Storage**: N/A — scaffold only; no data stores in scope  
**Testing**: N/A — no test framework at scaffold stage; deferred to first business feature  
**Target Platform**: Static CDN / Browser (front), AWS Lambda via API Gateway V2 (back)  
**Project Type**: Monorepo scaffold — static-site frontend + serverless backend  
**Performance Goals**: N/A — no runtime performance targets at scaffold stage  
**Constraints**: Node.js ≥ 24.0.0; TypeScript strict mode in all source files; static export only (no SSR); all IaC via SST Ion; `sst dev` requires active AWS credentials  
**Scale/Scope**: Developer tooling — two sub-projects, zero business logic, minimal surface area

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-evaluated after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Serverless-First | ✅ PASS | `/back` uses SST Ion + AWS Lambda + API Gateway V2 |
| II. Frontend Isolation | ✅ PASS | `/front` is static-export Next.js with no business logic |
| III. Modular Clean Architecture | ✅ PASS | Scaffold only — no business layers yet; `/back/src/` will be pre-structured for future module layout |
| IV. Dependency Abstraction | ✅ N/A | No business logic or AWS SDK usage in scaffold |
| V. API Design Discipline | ✅ PASS | Single `/health` route (infra-level, explicitly not versioned); future routes MUST be under `/v1/` |
| VI. Async Processing & Idempotency | ✅ N/A | No async processing in scaffold |
| VII. Data Modeling for Access Patterns | ✅ N/A | No DynamoDB tables in scaffold |
| VIII. Testing Discipline | ✅ ACCEPTABLE | Scaffold has no business logic to test; 80% coverage gate applies to first business feature |
| IX. Security by Default | ✅ PASS | `/health` is explicitly declared unauthenticated (infra probe only); no user data exposed |
| X. Infrastructure as Code | ✅ PASS | All infra defined in `sst.config.ts`; no manual console changes |

**Gate result**: PASS — no violations. Complexity Tracking table not required.

**Post-Phase 1 re-evaluation**: No new violations introduced by design. Static health-check
contract and minimal file structure remain fully compliant.

## Project Structure

### Documentation (this feature)

```text
specs/001-monorepo-scaffold/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/
│   └── api.md           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
/                              ← repo root
├── front/                     ← Next.js 16 static frontend
│   ├── src/
│   │   └── app/
│   │       ├── layout.tsx     ← root layout (html + body shell)
│   │       └── page.tsx       ← blank index page
│   ├── public/
│   ├── next.config.ts         ← output: 'export'
│   ├── tsconfig.json          ← strict mode, moduleResolution: bundler
│   └── package.json           ← scripts: dev, build, lint
│
├── back/                      ← SST Ion v4 backend (AWS Lambda)
│   ├── src/
│   │   └── health.ts          ← GET /health Lambda handler
│   ├── sst.config.ts          ← ApiGatewayV2 + health route
│   ├── tsconfig.json          ← strict mode, target: ES2024, moduleResolution: NodeNext
│   └── package.json           ← scripts: dev (sst dev), build, deploy
│
├── package.json               ← root workspace orchestrator (private, no business logic)
├── .gitignore                 ← node_modules, build outputs, .env, .sst
└── .nvmrc                     ← "24"
```

**Structure Decision**: Option 2 variant (static-site frontend + serverless backend) adapted
to the TrimTok constitution. Folders are named `front` and `back` per spec clarifications.
No `/packages` shared module folder (YAGNI — deferred to a future feature).
