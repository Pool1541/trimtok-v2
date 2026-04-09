# Data Model: TrimTok Monorepo Scaffold

**Phase**: 1 — Design  
**Branch**: `001-monorepo-scaffold`  
**Date**: 2026-04-08  
**Status**: Complete

---

## Overview

This feature is a **scaffolding deliverable**, not a business-domain feature. There are no user
entities, no persistent data stores, and no DynamoDB tables in scope. The only runtime
"data" is the health-check response emitted by the single Lambda function.

This document records:
1. The project configuration schema (the "shape" of each config file).
2. The health-check Lambda response shape (the only runtime payload).
3. State transitions of the monorepo lifecycle (install → dev / build).

---

## 1. Configuration Schemas

### 1.1 Root `package.json`

```typescript
interface RootPackageJson {
  name: string                      // "trimtok"
  private: true
  engines: { node: string; npm: string }  // ">=24.0.0", ">=10.8.0"
  workspaces: string[]              // ["front", "back"]
  scripts: {
    dev: string                     // concurrently command
    build: string                   // sequential workspace build
    install: never                  // NOT defined — handled by npm automatically
  }
  devDependencies: {
    concurrently: string            // "^9.0.0"
  }
}
```

**Validation rules**:
- `workspaces` MUST list `"front"` and `"back"` and nothing else (YAGNI).
- `scripts.dev` MUST use `concurrently` with `-n front,back` labels.
- `scripts` MUST NOT include application configuration, routing, or business logic.
- `engines.node` MUST be `">=24.0.0"`.

### 1.2 `/front/package.json`

```typescript
interface FrontPackageJson {
  name: string           // "front"
  version: string        // "0.1.0"
  private: true
  scripts: {
    dev: string          // "next dev"
    build: string        // "next build"
    start: string        // "next start" (optional — no SSR but useful for testing export)
    lint: string         // "next lint"
  }
  dependencies: {
    next: string         // "^16.0.0"
    react: string        // "^19.0.0"
    'react-dom': string  // "^19.0.0"
  }
  devDependencies: {
    typescript: string            // "^5.0.0"
    '@types/node': string         // "^24.0.0"
    '@types/react': string        // "^19.0.0"
    '@types/react-dom': string    // "^19.0.0"
  }
}
```

**Validation rules**:
- `scripts.dev` MUST be `"next dev"`.
- `scripts.build` MUST be `"next build"` (static export triggered by `next.config.ts`).
- `devDependencies` MUST NOT include `sst`, AWS SDK, or any backend-specific package.

### 1.3 `/back/package.json`

```typescript
interface BackPackageJson {
  name: string           // "back"
  version: string        // "0.1.0"
  private: true
  scripts: {
    dev: string          // "sst dev"
    build: string        // "sst build"
    deploy: string       // "sst deploy"
  }
  devDependencies: {
    sst: string                  // "^4.0.0"
    '@types/aws-lambda': string  // "^8.10.0"
    typescript: string           // "^5.0.0"
    '@types/node': string        // "^24.0.0"
  }
}
```

**Validation rules**:
- `scripts.dev` MUST be `"sst dev"` — requires active AWS credentials.
- MUST NOT include `react`, `react-dom`, or any frontend framework.
- MUST NOT include DynamoDB, SQS, or Cognito packages at scaffold stage.

---

## 2. Health-Check Lambda Response

### Response Shape

```typescript
interface HealthCheckResponse {
  status: 'ok'
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `'ok'` (literal) | Static string confirming Lambda is alive |

**HTTP wrapper** (API Gateway V2 format):

```typescript
interface APIGatewayV2Response {
  statusCode: 200
  headers: { 'Content-Type': 'application/json' }
  body: string   // JSON.stringify({ status: 'ok' })
}
```

**Validation rules**:
- Response MUST always return `statusCode: 200` for a healthy invocation.
- `body` MUST be valid JSON.
- This endpoint is intentionally unauthenticated (infra health probe); this is an explicit
  exception per Constitution Principle IX and MUST be reviewed before adding any sensitive data.

---

## 3. Monorepo Lifecycle State Transitions

```
                 ┌─────────────┐
                 │   CLONED    │  ← git clone
                 └──────┬──────┘
                        │ npm install (root)
                 ┌──────▼──────┐
                 │  INSTALLED  │  ← all workspace deps present
                 └──────┬──────┘
              ┌─────────┴──────────┐
              │                    │
     npm run dev             npm run build
              │                    │
    ┌─────────▼──────┐   ┌─────────▼──────┐
    │   DEV RUNNING  │   │     BUILT       │
    │  front: :3000  │   │  front: /out/   │
    │  back: sst dev │   │  back: .sst/    │
    └────────────────┘   └────────────────┘
```

**Transition rules**:
- INSTALLED → DEV RUNNING requires valid AWS credentials for the back project.
- INSTALLED → BUILT does NOT require AWS credentials (static analysis only).
- A failure in either sub-project during transition MUST exit with non-zero code (SC-004).
- CLONED → DEV RUNNING without INSTALLED MUST fail with a clear dependency-missing error.
