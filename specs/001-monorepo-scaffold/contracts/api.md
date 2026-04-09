# API Contract: TrimTok Backend — Scaffold Endpoints

**Phase**: 1 — Design  
**Branch**: `001-monorepo-scaffold`  
**Date**: 2026-04-08  
**Version**: v1  
**Status**: Complete

---

## Overview

This document defines the external API contracts exposed by the `/back` project at the
scaffold stage. The backend exposes a single API Gateway V2 (HTTP API) entry point. All
routes are prefixed with the API Gateway base URL resolved at deploy time via SST.

At scaffold stage there is **one route**: the health-check endpoint. All future business
routes MUST be added under `/v1/` in subsequent specs.

---

## Base URL

```
https://{api-gateway-id}.execute-api.{region}.amazonaws.com
```

Resolved at runtime via `sst deploy` output `ApiUrl`. The URL is stage-scoped
(e.g., `dev`, `staging`, `production`).

---

## Routes

### `GET /health`

**Purpose**: Infrastructure liveness probe. Confirms the Lambda runtime and API Gateway
integration are operational. Used by developers and CI pipelines after `sst deploy` to
verify a successful deployment.

**Authentication**: None (explicitly unauthenticated — infra-level probe only).  
> ⚠️ This exception MUST be reviewed before any sensitive business data is added to this
> endpoint. See Constitution Principle IX.

**Request**:

```http
GET /health HTTP/1.1
Host: {api-gateway-id}.execute-api.{region}.amazonaws.com
```

No request body, no query parameters, no headers required.

**Response — Success (`200 OK`)**:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "ok"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `string` ("ok") | Static confirmation string |

**Response — Lambda Error (`500 Internal Server Error`)**:

Returned by API Gateway when the Lambda throws an unhandled exception.

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "message": "Internal Server Error"
}
```

**Notes**:
- This route MUST NOT be versioned under `/v1/` — it is infra-level, not a business API.
- This route MUST NOT be removed or replaced before a monitoring/observability solution
  is in place.
- Latency SLA: no defined p95 target at scaffold stage. Future performance specs apply
  only after business routes are added.

---

## Versioning Policy

Per Constitution Principle V:
- All **business** API endpoints MUST be versioned under `/v1/` (or higher).
- The `/health` route is an infrastructure exception and is excluded from versioning.
- A version bump to `/v2/` is required only for breaking changes. Non-breaking additions
  MUST NOT trigger a version bump.

---

## Error Envelope (future business routes)

All future business endpoints MUST return errors in this standard envelope:

```json
{
  "error": {
    "code": "SNAKE_CASE_ERROR_CODE",
    "message": "Human-readable description",
    "details": {}
  }
}
```

This envelope is documented here for reference but is NOT implemented at scaffold stage.
