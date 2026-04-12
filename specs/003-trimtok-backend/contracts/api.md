# API Contracts: TrimTok Backend

**Feature**: `003-trimtok-backend` | **Date**: 2026-04-11  
**Base URL**: `https://{api-id}.execute-api.{region}.amazonaws.com/v1`  
**WebSocket URL**: `wss://{ws-api-id}.execute-api.{region}.amazonaws.com/{stage}`

---

## Convenciones globales

### Autenticación
- Sin autenticación en v1. API pública anónima.

### Rate limiting
- `POST /v1/jobs`: máximo **10 solicitudes/minuto por IP**.
- Respuesta al superar el límite: `429 Too Many Requests` con cabecera `Retry-After: 60`.

### Versionado
- Todas las rutas bajo prefijo `/v1/`. Breaking changes incrementan la versión.

### Envelope de error
Todos los errores retornan el mismo formato:
```json
{
  "error": {
    "code": "SNAKE_CASE_ERROR_CODE",
    "message": "Descripción legible del error"
  }
}
```

### Códigos de error comunes

| Código | HTTP | Descripción |
|--------|------|-------------|
| `INVALID_URL` | 400 | La URL no es una URL válida de TikTok |
| `VIDEO_TOO_LONG` | 400 | El video supera los 5 minutos de duración |
| `INVALID_TRIM_RANGE` | 400 | trimStart ≥ trimEnd, o rango fuera de la duración del video |
| `JOB_NOT_FOUND` | 404 | El jobId no existe |
| `JOB_NOT_READY` | 409 | Se intentó operar sobre un job que no está en estado requerido |
| `RATE_LIMIT_EXCEEDED` | 429 | Se superó el límite de solicitudes por IP |
| `INTERNAL_ERROR` | 500 | Error interno del servidor |

---

## HTTP API

### POST /v1/jobs — Crear un trabajo de descarga

Inicia la descarga de un video de TikTok. Si el video ya fue procesado previamente (cache hit), retorna directamente la URL de descarga.

**Request body**:
```json
{
  "tiktokUrl": "https://www.tiktok.com/@user/video/7123456789",
  "format": "mp4"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `tiktokUrl` | string | ✅ | URL válida de TikTok (dominio `tiktok.com`) |
| `format` | `"mp4"` \| `"mp3"` | ❌ | Formato de salida deseado. Default: `"mp4"` |

**Response 201 — Job creado (cache miss)**:
```json
{
  "jobId": "01HXZ4K9P3BQ7WVEM8FDN2RSTX",
  "status": "pending",
  "createdAt": "2026-04-11T15:00:00Z"
}
```

**Response 200 — Cache hit (video ya procesado)**:
```json
{
  "jobId": "01HXZ4K9P3BQ7WVEM8FDN2RSTX",
  "status": "ready",
  "downloadUrl": "https://s3.amazonaws.com/bucket/originals/7123456789/...",
  "title": "Mi video de TikTok",
  "duration": 45.2,
  "thumbnailUrl": "https://...",
  "createdAt": "2026-04-11T15:00:00Z"
}
```

**Response 400**:
```json
{
  "error": {
    "code": "INVALID_URL",
    "message": "La URL proporcionada no corresponde a un video de TikTok válido"
  }
}
```

---

### GET /v1/jobs/:jobId — Consultar estado de un trabajo

Retorna el estado actual del job y, cuando está disponible, la URL de descarga.

**Path params**:
- `jobId` (string) — ULID del job

**Response 200**:
```json
{
  "jobId": "01HXZ4K9P3BQ7WVEM8FDN2RSTX",
  "status": "ready",
  "tiktokUrl": "https://www.tiktok.com/@user/video/7123456789",
  "videoId": "7123456789",
  "title": "Mi video de TikTok",
  "duration": 45.2,
  "thumbnailUrl": "https://...",
  "format": "mp4",
  "downloadUrl": "https://s3.amazonaws.com/...",
  "trimStart": null,
  "trimEnd": null,
  "errorMessage": null,
  "createdAt": "2026-04-11T15:00:00Z",
  "updatedAt": "2026-04-11T15:00:32Z"
}
```

**Notas**:
- `downloadUrl` está presente solo cuando `status` es `ready`, `trimmed`, `gif_created` o `mp3_ready`.
- `downloadUrl` es una presigned URL de S3 válida por **1 hora**.
- Campos no disponibles aún se retornan como `null`.

**Response 404**:
```json
{
  "error": {
    "code": "JOB_NOT_FOUND",
    "message": "El trabajo no existe o ha expirado"
  }
}
```

---

### POST /v1/jobs/:jobId/trim — Solicitar recorte de video

Solicita el recorte de un video entre dos marcas de tiempo. Requiere que el job esté en estado `ready`.

**Path params**:
- `jobId` (string)

**Request body**:
```json
{
  "trimStart": 10.5,
  "trimEnd": 45.0
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `trimStart` | number | ✅ | Segundos desde el inicio (≥ 0) |
| `trimEnd` | number | ✅ | Segundos desde el inicio (> trimStart, ≤ duration) |

**Response 202 — Trim iniciado**:
```json
{
  "jobId": "01HXZ4K9P3BQ7WVEM8FDN2RSTX",
  "status": "trimming",
  "trimStart": 10.5,
  "trimEnd": 45.0
}
```

**Response 200 — Cache hit (trim idéntico ya existe)**:
```json
{
  "jobId": "01HXZ4K9P3BQ7WVEM8FDN2RSTX",
  "status": "trimmed",
  "trimStart": 10.5,
  "trimEnd": 45.0,
  "downloadUrl": "https://s3.amazonaws.com/..."
}
```

**Response 409** — Job no está en estado `ready`:
```json
{
  "error": {
    "code": "JOB_NOT_READY",
    "message": "El trabajo debe estar en estado 'ready' para solicitar un recorte"
  }
}
```

---

### POST /v1/jobs/:jobId/gif — Solicitar generación de GIF

Genera un GIF animado del video o de un rango de tiempo. El job debe estar en estado `ready` o `trimmed`.

**Request body**:
```json
{
  "trimStart": 10.5,
  "trimEnd": 20.0
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `trimStart` | number | ❌ | Inicio del rango para el GIF (default: 0) |
| `trimEnd` | number | ❌ | Fin del rango para el GIF (default: min(10, duration)) |

**Response 202 — GIF iniciado**:
```json
{
  "jobId": "01HXZ4K9P3BQ7WVEM8FDN2RSTX",
  "status": "creating_gif"
}
```

**Response 200 — Cache hit**:
```json
{
  "jobId": "01HXZ4K9P3BQ7WVEM8FDN2RSTX",
  "status": "gif_created",
  "downloadUrl": "https://s3.amazonaws.com/..."
}
```

---

### POST /v1/jobs/:jobId/mp3 — Solicitar extracción de audio MP3

Extrae el audio del video original o de un rango de tiempo. El job debe estar en estado `ready` o `trimmed`.

**Request body**:
```json
{
  "trimStart": 10.5,
  "trimEnd": 45.0
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `trimStart` | number | ❌ | Inicio del rango de audio (default: 0) |
| `trimEnd` | number | ❌ | Fin del rango de audio (default: duration) |

**Response 202 — MP3 iniciado**:
```json
{
  "jobId": "01HXZ4K9P3BQ7WVEM8FDN2RSTX",
  "status": "creating_mp3"
}
```

**Response 200 — Cache hit**:
```json
{
  "jobId": "01HXZ4K9P3BQ7WVEM8FDN2RSTX",
  "status": "mp3_ready",
  "downloadUrl": "https://s3.amazonaws.com/..."
}
```

> **Nota**: `creating_mp3` y `mp3_ready` se añaden al enum `JobStatus` como extensión de la spec original.

---

## WebSocket API

**Protocolo**: API Gateway WebSocket (subprotocol: ninguno)  
**Autenticación**: Ninguna en v1  
**Formato de mensajes**: JSON

### Conexión

El cliente se conecta a `wss://{ws-api-id}.execute-api.{region}.amazonaws.com/{stage}`. No se requieren parámetros de query adicionales.

### Mensaje del cliente → servidor: subscribe

Suscribe la conexión actual a las actualizaciones de un job específico.

```json
{
  "action": "subscribe",
  "jobId": "01HXZ4K9P3BQ7WVEM8FDN2RSTX"
}
```

**Respuesta** (servidor → cliente, inmediata tras suscripción):
```json
{
  "type": "subscribed",
  "jobId": "01HXZ4K9P3BQ7WVEM8FDN2RSTX",
  "currentStatus": "downloading"
}
```

### Mensaje servidor → cliente: job_update

Enviado por el servidor cada vez que el status de un job cambia. El cliente recibe esto while tiene una conexión activa y está suscrito al job.

```json
{
  "type": "job_update",
  "jobId": "01HXZ4K9P3BQ7WVEM8FDN2RSTX",
  "status": "ready",
  "downloadUrl": "https://s3.amazonaws.com/...",
  "title": "Mi video de TikTok",
  "duration": 45.2,
  "thumbnailUrl": "https://...",
  "updatedAt": "2026-04-11T15:00:32Z"
}
```

**El campo `downloadUrl` aparece solo cuando `status` es terminal con artefacto disponible**: `ready`, `trimmed`, `gif_created`, `mp3_ready`.  
**El campo `errorMessage` aparece solo cuando `status` es `error`**.

### Desconexión

El cliente puede desconectarse en cualquier momento. El servidor limpia el registro de conexión en DynamoDB. Las conexiones huérfanas (proceso crasheado) se eliminan automáticamente por TTL de 24 horas.

### Fallback: Polling

Si el cliente no puede establecer o mantener la conexión WebSocket, puede hacer polling a `GET /v1/jobs/:jobId` con intervalo recomendado de 1-2 segundos mientras el job esté en estado no terminal.

---

## Flujos de integración

### Flujo 1: Descarga nueva (cache miss)

```
Cliente                  HTTP API              SQS               Worker
  │                         │                    │                  │
  ├─POST /v1/jobs──────────>│                    │                  │
  │                         ├─ValidarURL         │                  │
  │                         ├─CheckCache(miss)   │                  │
  │                         ├─CreateJob(pending) │                  │
  │                         ├─SendMsg───────────>│                  │
  │<──201 {jobId, pending}──│                    │                  │
  │                         │                    ├─Trigger Lambda──>│
  │─WS connect──────────────────────────────────────────────────────│
  │─WS subscribe {jobId}────────────────────────────────────────────│
  │                         │                    │                  ├─AcquireLock
  │                         │                    │                  ├─UpdateJob(downloading)
  │<──WS: job_update(downloading)──────────────────────────────────>│
  │                         │                    │                  ├─DownloadVideo(yt-dlp)
  │                         │                    │                  ├─UploadS3
  │                         │                    │                  ├─WriteArtifact
  │                         │                    │                  ├─UpdateJob(ready)
  │                         │                    │                  ├─ReleaseLock
  │<──WS: job_update(ready, downloadUrl)───────────────────────────>│
  │                         │                    │                  │
  ├─GET /v1/jobs/:jobId(op)─>│                   │                  │
  │<──200 {status:ready, downloadUrl}───────────│                  │
```

### Flujo 2: Cache hit

```
Cliente               HTTP API
  │                      │
  ├─POST /v1/jobs────────>│
  │                       ├─ValidarURL
  │                       ├─CheckCache(hit)
  │<──200 {status:ready, downloadUrl}
```

### Flujo 3: Deduplicación concurrente

```
Cliente A             Cliente B           Worker A
  │                      │                   │
  ├─POST /v1/jobs────────>│                  │
  │<──201 {jobId:A}───────│                  │
  │                       ├─POST /v1/jobs──> │
  │                       │<──201 {jobId:B}──│  (job B encolado, lock falla en worker B)
  │                       │                  │
  │                       │              Worker A adquiere lock → procesa
  │                       │              Worker B intenta lock → falla → espera
  │                       │              Worker A completa → escribe artifact
  │                       │              Worker B detecta artifact → usa cache → completa job B
  │<──WS: ready(A)────────────────────────────
                          │<──WS: ready(B)─────
```
