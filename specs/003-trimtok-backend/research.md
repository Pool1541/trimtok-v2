# Research: TrimTok Backend — Serverless Event-Driven

**Feature**: `003-trimtok-backend` | **Date**: 2026-04-11  
**Purpose**: Resolver decisiones técnicas necesarias antes del diseño detallado

---

## Decision 1: Notificaciones en tiempo real — WebSocket vs SSE vs Polling

**Contexto**: La spec requiere que el frontend reciba actualizaciones de estado de jobs (30-90s de procesamiento). Se pidió evaluar SSE o WebSockets sin incrementar costos significativamente; polling como fallback aceptado.

**Opciones evaluadas**:

| Opción | Viable | Costo estimado (1k users/día, 60s/sesión) | Notas |
|--------|--------|-------------------------------------------|-------|
| SSE via Lambda Function URL + streaming | ❌ | N/A | Viola Principio X de Constitución: Lambda Function URLs no son API Gateway — API GW es el único entry point mandatado |
| SSE via API Gateway HTTP API | ❌ | N/A | API Gateway HTTP tiene timeout de integración de 29s; jobs duran hasta 90s — inviable |
| WebSocket API Gateway | ✅ | ~$0.008/mes | $0.25/millón connection-minutes + $1/millón mensajes; a 30k conn-min/mes = $0.0075 |
| Polling (GET /v1/jobs/:id) | ✅ | ~$0.01/mes extra Lambda | 180 req/job @ 500ms intervalo × 1k jobs/día; Lambda costo marginal negligible |

**Decisión**: **API Gateway WebSocket** para notificaciones en tiempo real.  
**Rationale**: Costo marginal (`< $0.01/mes` a escala inicial), cumple Principios I y X de Constitución, soporte nativo en SST, y el protocolo WebSocket es estándar en browsers. El polling se documenta como fallback si la conexión WebSocket falla (fallback graceful en el cliente).  
**Alternativa rechazada**: Polling-only — funcional pero con mayor carga perceptible en la UX y más invocaciones Lambda durante jobs activos.

---

## Decision 2: DynamoDB — Single-Table Design

**Contexto**: La Constitución (Principio VII) prefiere single-table design cuando los access patterns lo permiten. La spec tiene 3 entidades (Job, CacheArtifact, ProcessingEvent) más 2 entidades de infraestructura (Lock, WebSocket Connection).

**Access patterns identificados**:

1. `GetJob` — obtener job por ID → PK única, O(1)
2. `GetArtifact` — obtener artefacto por (videoId, format, type, trimStart, trimEnd) → PK/SK compuesto, O(1)
3. `GetArtifactsByVideo` — listar todos los artefactos de un video → Query por PK, O(artifacts)
4. `GetJobEvents` — obtener eventos de auditoría de un job → Query PK=JOB, SK begins_with EVENT#
5. `AcquireLock` — intentar adquirir lock para un videoId (conditional write) → PutItem con condition
6. `ReleaseLock` — liberar lock → DeleteItem
7. `GetConnection` — obtener conexión WebSocket por connectionId → GetItem, O(1)
8. `GetConnectionsByJob` — encontrar conexiones suscritas a un job (para notificación push) → GSI1 Query

**Veredicto**: Single-table design es viable con 1 GSI.  
**Decisión**: Single-table design con tabla `TrimtokTable`, 1 GSI (GSI1 para connections-by-job).  
**Rationale**: 8 access patterns encajan limpiamente en el esquema PK/SK. No hay full-table scans. La única consulta cross-entity (connections por jobId) requiere un GSI pero es el único. Esto minimiza la superficie operativa y el costo.

---

## Decision 3: TTLs de artefactos — Valores revisados

**Contexto**: Los valores anteriores (originals 30d, trims 7d, job artifacts 1d) fueron diseñados para un servicio de almacenamiento de largo plazo. Este sistema genera presigned URLs válidas 1 hora; el usuario descarga inmediatamente o puede volver a solicitar.

**Análisis**:
- Una vez que el usuario tiene la URL de descarga, el artefacto en S3 solo necesita existir lo suficiente para completar la descarga y permitir re-solicitudes ocasionales.
- Retener originals 30 días implica costos S3 innecesarios para videos que ya fueron descargados.
- Un job fallido que se reintenta recrea el artefacto; no es necesario retenerlo indefinidamente.

**Valores nuevos**:

| Tipo de artefacto | S3 Lifecycle | DynamoDB TTL (metadata) | Rationale |
|-------------------|-------------|------------------------|-----------|
| Original video (mp4) | 48 horas | 7 días | Descarga inmediata; re-solicitud rara |
| MP3 original | 48 horas | 7 días | Mismo patrón que video original |
| Trim (mp4) | 24 horas | 7 días | Resultado de operación efímera |
| MP3 trim | 24 horas | 7 días | Igual que trim de video |
| GIF | 24 horas | 7 días | Igual que trim |
| Job (metadata) | N/A | 7 días | Para debugging/soporte |
| ProcessingEvent | N/A | 7 días | Analytics básico |
| WebSocket Connection | N/A | 24 horas TTL (stale cleanup) | Auto-cleanup de conexiones huérfanas |

**Nota**: DynamoDB TTL tiene latencia de hasta 48h. Los registros de CacheArtifact pueden apuntar a objetos S3 ya eliminados; cuando esto ocurre el sistema intenta descarga nueva (cache miss graceful). Los registros de Job/Event persisten 7 días para trazabilidad aunque el artefacto S3 ya no exista.  
**Nota 2**: La limpieza de S3 (lifecycle rules) y de DynamoDB (TTL) son mecanismos nativos de AWS. No se requiere Lambda de limpieza explícita — esto satisface FR-009 de forma más eficiente.

---

## Decision 4: Herramienta de descarga de video — yt-dlp

**Contexto**: Se necesita descargar videos de TikTok desde Lambda. TikTok tiene protecciones anti-scraping y redirects dinámicos.

**Opciones evaluadas**:

| Opción | Mantenimiento | Compatibilidad TikTok | Distribución en Lambda |
|--------|---------------|----------------------|------------------------|
| yt-dlp | Muy activo (miles de contribuidores) | Excelente, actualizado frecuentemente | Binary Linux ARM64 en Lambda Layer |
| youtube-dl | Inactivo (fork abandonado) | Degradada | No recomendado |
| Librería npm TikTok unofficial | Variable, frecuentemente roto | Frágil | Como dependencia npm |

**Decisión**: **yt-dlp binary** empaquetado como Lambda Layer (ARM64, Linux).  
**Rationale**: Es el estándar de facto para descarga de video en herramientas de procesamiento. Se puede actualizar el layer independientemente del código de la función. Ejecutable directo sin overhead de interpretación.  
**Alternativa rechazada**: Librerías npm no ofrecidas por el ecosistema yt-dlp — menor confiabilidad y más frecuentemente rotas por cambios en TikTok.

---

## Decision 5: Procesamiento de video — ffmpeg

**Contexto**: Las operaciones de trim, generación de GIF y extracción de MP3 requieren un procesador de video capaz.

**Decisión**: **ffmpeg binary** empaquetado como Lambda Layer (ARM64, Linux).  
**Rationale**: No existe alternativa comparable en el ecosistema de Node.js para procesamiento de video de alta calidad en serverless. ffmpeg es el estándar de la industria.

**Configuraciones clave**:
- **Trim**: `ffmpeg -ss {start} -to {end} -i {input} -c copy {output}` — stream copy sin re-encoding (rápido, sin pérdida de calidad)
- **GIF**: Dos pasadas — paleta (`palettegen`) + conversión (`paletteuse`) para GIFs de alta calidad con colores optimizados
- **MP3**: `ffmpeg -i {input} -vn -acodec libmp3lame -q:a 2 {output}` — extrae audio con calidad VBR alta

**Nota de sizing Lambda**: Workers de descarga y trim necesitan almacenamiento temporal (`/tmp`, máximo 10GB en Lambda). Para videos de 5 min a ~720p, el tamaño típico es 50-150MB. El `/tmp` predeterminado de 512MB puede ser insuficiente; configurar `/tmp` en 1GB para workers de descarga.

---

## Decision 6: Framework HTTP — Hono

**Contexto**: El codebase actual ya usa Hono con `hono/aws-lambda`. La Constitución no restringe el framework HTTP siempre y cuando API Gateway sea el entry point.

**Decisión**: **Mantener Hono** para los handlers HTTP.  
**Rationale**: Ya presente en el stack, TypeScript-first, adapter nativo para Lambda, soporte para middleware de validación Zod (`@hono/zod-validator`), compatible con API Gateway v2 HTTP API.

---

## Decision 7: SQS — Una cola por tipo de worker

**Contexto**: Se necesita desacoplar los workers (download, trim, gif, mp3). Evaluar una cola compartida vs colas separadas.

**Decisión**: **4 colas SQS separadas** (DownloadQueue, TrimQueue, GifQueue, Mp3Queue), cada una con su Dead Letter Queue (DLQ).  
**Rationale**:
- Tiempos de procesamiento muy diferentes (descarga: 10-90s, trim: 2-30s, GIF: 5-20s, MP3: 1-10s) — requieren diferentes timeouts de Lambda.
- Errores en descarga no deben contaminar la cola de trims.
- Escalado independiente por tipo (volume de trims ≠ volume de descargas).
- DLQs separadas facilitan el diagnóstico de fallos por tipo de operación.
- CloudWatch Alarms individuales por DLQ para monitoreo de fallos por tipo.

---

## Decision 8: Mecanismo de deduplicación — DynamoDB Conditional Write + Lock con TTL

**Contexto**: FR-005 requiere que no se ejecuten dos descargas simultáneas del mismo video. La Constitución (Principio VI) establece que el locking distribudo MAY usarse pero la idempotency key de DynamoDB es la garantía autoritativa.

**Decisión**: **Dos capas de garantía**:

1. **Lock distribuido**: `PutItem` condicional (`attribute_not_exists(pk)`) en `LOCK#{videoId}` con TTL de 10 minutos. Si el condition falla, el segundo job espera al primero (consulta su estado via polling) o se adjunta al job existente.
2. **Idempotency key**: Al completar la descarga, se escribe `ARTIFACT#{videoId}` con `attribute_not_exists(pk)`. Si la condición falla en la escritura del artefacto, significa que otro worker completó primero — se usa ese artefacto (idempotencia).

**Rationale**: El lock previene trabajo duplicado. La idempotency key en el artefacto garantiza que incluso si el lock falla (crash, timeout), el resultado final es correcto: solo un artefacto canónico por videoId/format/type/trimRange.

---

## Decision 9: Retención de logs CloudWatch

**Contexto**: El usuario especificó CloudWatch como herramienta de monitoreo con retención básica de 7 días.

**Decisión**: **Retención de 7 días** en todos los log groups de Lambda.  
**Configuración en SST**: `transform.logGroup.retentionInDays: 7` en cada función Lambda.  
**Alarmas base**: DLQ MessageCount > 0 para cada cola → SNS notify (configurable). Alarm en Lambda error rate > 1% por window de 5 minutos.
