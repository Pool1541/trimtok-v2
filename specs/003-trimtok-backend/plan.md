# Implementation Plan: TrimTok Backend — Serverless Event-Driven

**Branch**: `003-trimtok-backend` | **Date**: 2026-04-11 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/003-trimtok-backend/spec.md`

## Summary

Backend completamente serverless y orientado a eventos para TrimTok. Permite a los usuarios
descargar videos de TikTok, recortarlos, generar GIFs y extraer audio MP3. La arquitectura
utiliza API Gateway v2 (HTTP) como punto de entrada síncrono, SQS para desacoplar cada etapa
de procesamiento, Lambda como workers, DynamoDB (single-table) para estado y caché, y S3 para
almacenamiento de artefactos con reglas de lifecycle automáticas. Las notificaciones en tiempo
real se implementan mediante API Gateway WebSocket (costo marginal), con polling como fallback.
Toda la infraestructura se gestiona con SST (Ion).

## Technical Context

**Language/Version**: TypeScript 5.x — Node.js 20 (Lambda runtime)  
**Primary Dependencies**: Hono 4.x (HTTP API framework + Lambda adapter), AWS SDK v3, Zod (schema validation), SST 4.x (IaC), yt-dlp binary (Lambda layer), ffmpeg binary (Lambda layer)  
**Storage**: DynamoDB (single-table, on-demand) + S3 (artifacts bucket con lifecycle rules)  
**Testing**: Vitest — unit tests para domain/application layers con mocks; integration tests con DynamoDB Local  
**Target Platform**: AWS Lambda (arm64, Node 20) + API Gateway v2 HTTP + API Gateway WebSocket  
**Project Type**: Web service — backend API serverless con workers asíncronos  
**Performance Goals**: p95 < 200ms para endpoints síncronos (GET/POST sin procesamiento); jobs de descarga < 90s p95 para videos ≤ 5 min  
**Constraints**: Lambda timeout 15 min para workers; API Gateway HTTP timeout 29 s (solo endpoints síncronos, no afecta workers); artefactos S3 servidos directamente (sin proxy Lambda); rate limit 10 req/min por IP en creación de jobs  
**Scale/Scope**: Miles de jobs/día en v1; escalado automático a cero en inactividad; single-region AWS (us-east-1)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Serverless-First | ✅ PASS | Todo el cómputo en Lambda; API Gateway único punto de entrada; DynamoDB único almacén persistente; SQS para async |
| II. Frontend Isolation | ✅ PASS | Backend es API pura; frontend consume endpoints `/v1/`; ningún acceso directo a AWS desde el frontend |
| III. Modular Clean Architecture | ✅ PASS | Módulos `jobs`, `processing`, `notifications`; capas `domain` / `application` / `infrastructure` por módulo |
| IV. Dependency Abstraction | ✅ PASS | AWS SDK solo en `infrastructure`; `application` define ports/interfaces; handlers inyectan adapters |
| V. API Design Discipline | ✅ PASS | Todos los endpoints bajo `/v1/`; validación Zod en entrada; envelopes de error consistentes |
| VI. Async Processing & Idempotency | ✅ PASS | SQS por tipo de job (4 queues); idempotencia via DynamoDB conditional write + deduplication key; locking NO es la única garantía |
| VII. Data Modeling for Access Patterns | ✅ PASS | Single-table design; 8 access patterns documentados en data-model.md; 1 GSI definido por patrón real |
| VIII. Testing Discipline | ✅ PASS | Unit tests en `domain`/`application` con mocks; integration tests con DynamoDB Local; cobertura ≥ 80% en esas capas |
| IX. Security by Default | ✅ PASS | Rate limiting por IP (FR-016); validación de input en cada handler; API pública declarada explícitamente; secrets en SSM |
| X. Infrastructure as Code | ✅ PASS | Todo en `sst.config.ts`; ephemeral stacks por branch; sin cambios manuales en console |

**Veredicto pre-Phase 0**: ✅ Sin violaciones — se puede proceder.

## Project Structure

### Documentation (this feature)

```text
specs/003-trimtok-backend/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones de arquitectura y herramientas
├── data-model.md        # Fase 1: schema DynamoDB single-table + estructura S3
├── quickstart.md        # Fase 1: guía de desarrollo local
├── contracts/
│   └── api.md           # Fase 1: contratos HTTP API + protocolo WebSocket
└── tasks.md             # Fase 2 (/speckit.tasks — no generado aquí)
```

### Source Code (repository root)

```text
back/
├── sst.config.ts                   # Infraestructura SST: API GW, WS API, DynamoDB, S3, SQS, Lambdas
├── sst-env.d.ts                    # Tipos generados por SST
├── tsconfig.json
├── package.json
└── src/
    ├── handlers/                   # Puntos de entrada Lambda (thin adapters)
    │   ├── api/
    │   │   ├── create-job.ts       # POST /v1/jobs
    │   │   ├── get-job.ts          # GET /v1/jobs/:jobId
    │   │   ├── request-trim.ts     # POST /v1/jobs/:jobId/trim
    │   │   ├── request-gif.ts      # POST /v1/jobs/:jobId/gif
    │   │   └── request-mp3.ts      # POST /v1/jobs/:jobId/mp3
    │   ├── workers/
    │   │   ├── download-worker.ts  # Consumidor SQS DownloadQueue
    │   │   ├── trim-worker.ts      # Consumidor SQS TrimQueue
    │   │   ├── gif-worker.ts       # Consumidor SQS GifQueue
    │   │   └── mp3-worker.ts       # Consumidor SQS Mp3Queue
    │   └── websocket/
    │       ├── connect.ts          # WS $connect
    │       ├── disconnect.ts       # WS $disconnect
    │       └── subscribe.ts        # WS mensaje "subscribe"
    ├── jobs/                       # Módulo Jobs
    │   ├── domain/
    │   │   ├── job.entity.ts
    │   │   ├── job-status.ts
    │   │   └── cache-artifact.entity.ts
    │   ├── application/
    │   │   ├── ports/
    │   │   │   ├── job.repository.ts
    │   │   │   ├── artifact.repository.ts
    │   │   │   ├── job-queue.port.ts
    │   │   │   └── storage.port.ts
    │   │   ├── create-job.usecase.ts
    │   │   ├── get-job.usecase.ts
    │   │   ├── request-trim.usecase.ts
    │   │   ├── request-gif.usecase.ts
    │   │   └── request-mp3.usecase.ts
    │   └── infrastructure/
    │       ├── dynamo/
    │       │   ├── job.dynamo-repo.ts
    │       │   └── artifact.dynamo-repo.ts
    │       ├── s3/
    │       │   └── artifact-storage.adapter.ts
    │       └── sqs/
    │           └── job-queue.adapter.ts
    ├── processing/                 # Módulo Workers
    │   ├── domain/
    │   │   └── video-processor.entity.ts
    │   ├── application/
    │   │   ├── ports/
    │   │   │   ├── downloader.port.ts
    │   │   │   └── transcoder.port.ts
    │   │   ├── download-video.usecase.ts
    │   │   ├── trim-video.usecase.ts
    │   │   ├── create-gif.usecase.ts
    │   │   └── extract-mp3.usecase.ts
    │   └── infrastructure/
    │       ├── ytdlp.adapter.ts
    │       └── ffmpeg.adapter.ts
    ├── notifications/              # Módulo WebSocket
    │   ├── application/
    │   │   ├── ports/
    │   │   │   └── connection.repository.ts
    │   │   └── notify-job-update.usecase.ts
    │   └── infrastructure/
    │       ├── dynamo/
    │       │   └── connection.dynamo-repo.ts
    │       └── apigw/
    │           └── websocket.adapter.ts
    └── shared/
        ├── dynamo.client.ts
        ├── s3.client.ts
        ├── table-keys.ts           # Builders de PK/SK/GSI keys
        └── errors.ts

tests/
├── unit/
│   ├── jobs/domain/
│   └── processing/domain/
└── integration/
    └── jobs/infrastructure/dynamo/
```

**Structure Decision**: Single project `back/`. El backend expande su lógica en `back/src/` con Clean Architecture por módulos. El frontend (`front/`) no se modifica. `sst.config.ts` es la única fuente de verdad de infraestructura.

## Complexity Tracking

> No hay violaciones constitucionales que justificar.
