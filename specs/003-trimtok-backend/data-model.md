# Data Model: TrimTok Backend — Serverless Event-Driven

**Feature**: `003-trimtok-backend` | **Date**: 2026-04-11  
**References**: [research.md](./research.md) — Decision 2 (Single-Table), Decision 3 (TTLs)

---

## DynamoDB — Single-Table Design

**Nombre de tabla**: `TrimtokTable` (SST: `sst.aws.Dynamo("TrimtokTable")`)  
**Capacidad**: On-demand (pago por request)  
**Cifrado**: AES-256 (AWS managed)  
**TTL attribute**: `expiresAt` (número Unix timestamp en segundos)

### Índices

| Índice | Tipo | Hash Key | Range Key | Propósito |
|--------|------|----------|-----------|-----------|
| Primary | — | `pk` (String) | `sk` (String) | Acceso directo a todos los ítems |
| GSI1 | Global | `gsi1pk` (String) | `gsi1sk` (String) | Conexiones WebSocket suscritas a un job |

---

### Tipos de ítems

#### 1. Job

Representa una solicitud de procesamiento de un video de TikTok.

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| `pk` | String | `JOB#{jobId}` |
| `sk` | String | `METADATA` |
| `type` | String | `"JOB"` (discriminador) |
| `jobId` | String | ULID generado en creación |
| `tiktokUrl` | String | URL original enviada por el usuario |
| `videoId` | String? | ID extraído del video TikTok (post-descarga) |
| `status` | String | Ver máquina de estados más abajo |
| `title` | String? | Título del video (post-descarga) |
| `duration` | Number? | Duración en segundos (post-descarga) |
| `thumbnailUrl` | String? | URL de miniatura del video |
| `trimStart` | Number? | Marca de inicio de trim en segundos |
| `trimEnd` | Number? | Marca de fin de trim en segundos |
| `s3OriginalKey` | String? | Clave S3 del video original mp4 |
| `s3TrimKey` | String? | Clave S3 del trim mp4 |
| `s3GifKey` | String? | Clave S3 del GIF |
| `s3Mp3Key` | String? | Clave S3 del audio mp3 original |
| `s3TrimMp3Key` | String? | Clave S3 del audio mp3 del trim |
| `errorMessage` | String? | Mensaje de error descriptivo si status=error |
| `retryCount` | Number | Número de reintentos realizados (máx. 1) |
| `createdAt` | String | ISO 8601 |
| `updatedAt` | String | ISO 8601 |
| `expiresAt` | Number | Unix timestamp, TTL 7 días desde creación |

**Ejemplo de ítem**:
```json
{
  "pk": "JOB#01HXZ4K9P3BQ7WVEM8FDN2RSTX",
  "sk": "METADATA",
  "type": "JOB",
  "jobId": "01HXZ4K9P3BQ7WVEM8FDN2RSTX",
  "tiktokUrl": "https://www.tiktok.com/@user/video/7123456789",
  "videoId": "7123456789",
  "status": "ready",
  "title": "Mi video de TikTok",
  "duration": 45.2,
  "s3OriginalKey": "originals/7123456789/7123456789.mp4",
  "createdAt": "2026-04-11T15:00:00Z",
  "updatedAt": "2026-04-11T15:00:32Z",
  "expiresAt": 1745100000
}
```

**Máquina de estados del Job**:

```
pending
  └─→ downloading
        ├─→ ready          (descarga completada)
        │     ├─→ trimming
        │     │     └─→ trimmed
        │     │           └─→ (terminal o nuevo trim)
        │     └─→ creating_gif
        │           └─→ gif_created
        └─→ error          (desde cualquier estado, con 1 reintento previo)
```

---

#### 2. CacheArtifact

Índice de artefactos almacenados en S3. Permite reutilizar resultados sin reprocesar.

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| `pk` | String | `ARTIFACT#{videoId}` |
| `sk` | String | `#{format}#{artifactType}#{trimStart\|""}#{trimEnd\|""}` |
| `type` | String | `"ARTIFACT"` |
| `artifactId` | String | ULID |
| `videoId` | String | ID del video TikTok |
| `tiktokUrl` | String | URL original |
| `format` | String | `"mp4"` \| `"mp3"` \| `"gif"` |
| `artifactType` | String | `"original"` \| `"trim"` \| `"gif"` |
| `s3Key` | String | Clave S3 del artefacto |
| `fileSizeBytes` | Number? | Tamaño en bytes |
| `duration` | Number? | Duración en segundos |
| `title` | String? | Título del video |
| `thumbnailUrl` | String? | URL de miniatura |
| `trimStart` | Number? | Solo para tipo trim |
| `trimEnd` | Number? | Solo para tipo trim |
| `downloadCount` | Number | Contador de descargas (incremento atómico) |
| `createdAt` | String | ISO 8601 |
| `expiresAt` | Number | Unix timestamp, TTL variable (ver tabla de retención) |

**Valores válidos de SK por combinación**:

| format | artifactType | SK ejemplo | TTL S3 |
|--------|-------------|-----------|--------|
| `mp4` | `original` | `#mp4#original##` | 48h |
| `mp4` | `trim` | `#mp4#trim#10.5#45.0` | 24h |
| `gif` | `gif` | `#gif#gif#10.5#45.0` | 24h |
| `mp3` | `original` | `#mp3#original##` | 48h |
| `mp3` | `trim` | `#mp3#trim#10.5#45.0` | 24h |

**Nota**: GIFs no tienen formato "mp4"/"mp3" — usan `format: "gif"`.

---

#### 3. ProcessingEvent

Registro de auditoría inmutable. Uno por operación significativa.

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| `pk` | String | `JOB#{jobId}` |
| `sk` | String | `EVENT#{ISO-timestamp}#{ulid}` (orderable por tiempo) |
| `type` | String | `"EVENT"` |
| `eventId` | String | ULID |
| `jobId` | String | Job al que pertenece |
| `videoId` | String? | ID del video cuando ya está disponible |
| `operation` | String | Ver valores válidos más abajo |
| `format` | String? | Formato involucrado en la operación |
| `cacheStatus` | String? | `"hit"` \| `"miss"` |
| `durationMs` | Number? | Duración de la operación en ms |
| `fileSizeBytes` | Number? | Bytes procesados |
| `trimStart` | Number? | Solo operaciones de trim |
| `trimEnd` | Number? | Solo operaciones de trim |
| `errorMessage` | String? | Solo si la operación falló |
| `createdAt` | String | ISO 8601 |
| `expiresAt` | Number | Unix timestamp, TTL 7 días |

**Valores válidos de `operation`**:
`download_started`, `download_completed`, `download_failed`,
`trim_started`, `trim_completed`, `trim_failed`,
`gif_started`, `gif_completed`, `gif_failed`,
`mp3_started`, `mp3_completed`, `mp3_failed`,
`cache_hit`, `cache_miss`, `lock_acquired`, `lock_released`

---

#### 4. DistributedLock

Mutex distribuido para deduplicar descargas concurrentes del mismo video.

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| `pk` | String | `LOCK#{videoId}` |
| `sk` | String | `LOCK` |
| `type` | String | `"LOCK"` |
| `videoId` | String | Video que está siendo procesado |
| `jobId` | String | Job que adquirió el lock |
| `acquiredAt` | String | ISO 8601 |
| `expiresAt` | Number | Unix timestamp, TTL 10 minutos |

**Mecanismo**: `PutItem` con condición `attribute_not_exists(pk)`. Si falla → videoId ya en proceso → el solicitante espera y consulta el job existente.

---

#### 5. WebSocketConnection

Estado de conexiones WebSocket activas suscritas a jobs.

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| `pk` | String | `CONN#{connectionId}` |
| `sk` | String | `CONN` |
| `type` | String | `"CONN"` |
| `connectionId` | String | ID de conexión de API Gateway WS |
| `jobId` | String? | Job al que está suscrito (se actualiza en subscribe) |
| `connectedAt` | String | ISO 8601 |
| `expiresAt` | Number | Unix timestamp, TTL 24 horas |
| `gsi1pk` | String? | `JOB#{jobId}` (solo cuando jobId está seteado) |
| `gsi1sk` | String? | `CONN#{connectionId}` (solo cuando jobId está seteado) |

**Flujo**: `$connect` → crear ítem sin jobId. Mensaje `subscribe {jobId}` → actualizar con jobId + GSI1 keys. Worker → Query GSI1 por `gsi1pk=JOB#{jobId}` para obtener connectionIds → push via `ApiGatewayManagementApiClient`.

---

### Access Patterns — Mapa completo

| # | Operación | Query type | Key(s) |
|---|-----------|-----------|--------|
| 1 | Obtener job por ID | `GetItem` | PK=`JOB#{jobId}`, SK=`METADATA` |
| 2 | Obtener artefacto exacto (cache lookup) | `GetItem` | PK=`ARTIFACT#{videoId}`, SK=`#{format}#{type}#{start}#{end}` |
| 3 | Listar artefactos de un video | `Query` | PK=`ARTIFACT#{videoId}` |
| 4 | Obtener eventos de un job | `Query` | PK=`JOB#{jobId}`, SK `begins_with` `EVENT#` |
| 5 | Adquirir lock para un videoId | `PutItem conditional` | PK=`LOCK#{videoId}`, SK=`LOCK`, condition=`attribute_not_exists(pk)` |
| 6 | Liberar lock | `DeleteItem` | PK=`LOCK#{videoId}`, SK=`LOCK` |
| 7 | Obtener conexión WS por connectionId | `GetItem` | PK=`CONN#{connectionId}`, SK=`CONN` |
| 8 | Obtener conexiones WS por jobId | `Query GSI1` | GSI1PK=`JOB#{jobId}` |

---

## S3 — Estructura del bucket de artefactos

**Nombre del bucket**: `trimtok-artifacts-{stage}` (SST: `sst.aws.Bucket("ArtifactsBucket")`)  
**Acceso público**: Bloqueado (`blockPublicAccess: true`)  
**Cifrado**: S3 managed (SSE-S3)  
**Versionado**: No (innecesario, TTL corto)

### Estructura de prefijos

```text
trimtok-artifacts-{stage}/
├── originals/
│   └── {videoId}/
│       └── {videoId}.mp4              # Video original descargado
├── trims/
│   └── {videoId}/
│       └── {jobId}.mp4                # Video recortado
├── gifs/
│   └── {videoId}/
│       └── {jobId}.gif                # GIF generado
└── mp3s/
    ├── originals/
    │   └── {videoId}/
    │       └── {videoId}.mp3          # Audio extraído del original
    └── trims/
        └── {videoId}/
            └── {jobId}.mp3            # Audio extraído del trim
```

### Reglas de lifecycle por prefijo

| Prefijo | Acción | Días |
|---------|--------|------|
| `originals/` | Expirar objeto | 2 días |
| `trims/` | Expirar objeto | 1 día |
| `gifs/` | Expirar objeto | 1 día |
| `mp3s/originals/` | Expirar objeto | 2 días |
| `mp3s/trims/` | Expirar objeto | 1 día |

**Nota adicional**: Habilitar regla de abortar multipart uploads incompletos después de 1 día (todos los prefijos) para evitar costos ocultos de uploads fallidos.

### Presigned URLs

- Generadas bajo demanda por `artifact-storage.adapter.ts` con `GetObjectCommand` + `getSignedUrl`.
- Validez: **1 hora** desde generación (FR-007, Decision clarificación Q4).
- Las URLs no se almacenan en DynamoDB — se generan en cada llamada a `GET /v1/jobs/:jobId`.
- Si el objeto S3 ya expiró, la URL falla con 403. El sistema responde con cache miss → nuevo job.

---

## SST Infrastructure Sketch

> Referencia para implementación en `sst.config.ts`. No es código final.

```typescript
// Tabla DynamoDB single-table
const table = new sst.aws.Dynamo("TrimtokTable", {
  fields: {
    pk: "string",
    sk: "string",
    gsi1pk: "string",
    gsi1sk: "string",
  },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
  globalIndexes: {
    gsi1: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
  },
  ttl: "expiresAt",
});

// Bucket S3 con lifecycle rules
const artifactsBucket = new sst.aws.Bucket("ArtifactsBucket", {
  // lifecycle rules configuradas via transform en implementación
});

// Cuatro colas SQS con DLQ (1 reintento, luego DLQ)
const downloadQueue = new sst.aws.Queue("DownloadQueue", {
  // visibilityTimeout: 900s (15 min, = Lambda timeout worker)
  // maxReceiveCount: 2 (1 intento + 1 reintento)
});
const trimQueue = new sst.aws.Queue("TrimQueue");
const gifQueue  = new sst.aws.Queue("GifQueue");
const mp3Queue  = new sst.aws.Queue("Mp3Queue");

// API Gateway HTTP (v2)
const api = new sst.aws.ApiGatewayV2("Api");

// API Gateway WebSocket
const wsApi = new sst.aws.ApiGatewayWebSocket("WsApi");
```
