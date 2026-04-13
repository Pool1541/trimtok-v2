# Tasks: TrimTok Backend — Serverless Event-Driven

**Input**: Design documents from `/specs/003-trimtok-backend/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅, quickstart.md ✅  
**Organization**: Tasks grouped by user story for independent implementation and testing.  
**Tests**: Included — required by Constitution Principle VIII (coverage ≥ 80% MUST on domain + application layers).

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Parallelizable — different files, no dependency on incomplete sibling tasks
- **[Story]**: User story label (US1–US5) — present only in user story phases

---

## Phase 1: Setup

**Purpose**: Install required dependencies and scaffold the full source directory structure before implementation begins.

- [x] T001 Update back/package.json — add runtime deps: zod, @hono/zod-validator, ulidx, @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, @aws-sdk/client-sqs, @aws-sdk/client-apigatewaymanagementapi; add devDeps: vitest, @vitest/coverage-v8
- [x] T002 [P] Create back/src/ subdirectory scaffolding per plan.md: handlers/api/, handlers/workers/, handlers/websocket/, jobs/domain/, jobs/application/ports/, jobs/infrastructure/dynamo/, jobs/infrastructure/s3/, jobs/infrastructure/sqs/, processing/domain/, processing/application/ports/, processing/infrastructure/, notifications/application/ports/, notifications/infrastructure/dynamo/, notifications/infrastructure/apigw/, shared/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure clients, table key builders, error types, and the complete SST resource declaration. No user story implementation can proceed without this phase.

**⚠️ CRITICAL**: All five tasks in this phase must be complete before any user story work begins.

- [x] T003 [P] Create back/src/shared/dynamo.client.ts — singleton `DynamoDBDocumentClient` factory; export client and `TABLE_NAME` constant sourced from `Resource.TrimtokTable.name` (sst-env)
- [x] T004 [P] Create back/src/shared/s3.client.ts — singleton `S3Client` factory; export client and `BUCKET_NAME` constant sourced from `Resource.ArtifactsBucket.name` (sst-env)
- [x] T005 [P] Create back/src/shared/table-keys.ts — pure functions: `jobPk(jobId)`, `jobSk()`, `artifactPk(videoId)`, `artifactSk(format, type, trimStart?, trimEnd?)`, `lockPk(videoId)`, `lockSk()`, `connPk(connId)`, `connSk()`, `gsi1Pk(jobId)`, `gsi1Sk(connId)`; export key builder types
- [x] T006 [P] Create back/src/shared/errors.ts — `AppError` class (code, message, httpStatus); factory functions: `invalidUrl()`, `videoTooLong()`, `invalidTrimRange()`, `jobNotFound()`, `jobNotReady()`, `rateLimitExceeded()`, `internalError(cause?)`; export `ErrorCode` enum with all codes from contracts/api.md
- [x] T007 Expand back/sst.config.ts with complete infrastructure — **(a)** `TrimtokTable` (fields pk/sk/gsi1pk/gsi1sk string, primaryIndex pk+sk, globalIndex gsi1 on gsi1pk+gsi1sk, ttl: expiresAt, on-demand); **(b)** `ArtifactsBucket` (blockPublicAccess, S3 lifecycle rules: originals/ expire 2d, trims/ expire 1d, gifs/ expire 1d, mp3s/originals/ expire 2d, mp3s/trims/ expire 1d, all prefixes abort incomplete multipart uploads after 1d); **(c)** `DownloadQueue`, `TrimQueue`, `GifQueue`, `Mp3Queue` each with DLQ (maxReceiveCount: 2), visibilityTimeout 900s for Download/Trim, 300s for Gif/Mp3; **(d)** `WsApi` (ApiGatewayWebSocket with $connect → handlers/websocket/connect.ts, $disconnect → handlers/websocket/disconnect.ts, subscribe route → handlers/websocket/subscribe.ts; link table permissions); **(e)** HTTP API routes: POST /v1/jobs → handlers/api/create-job.ts, GET /v1/jobs/:jobId → handlers/api/get-job.ts, POST /v1/jobs/:jobId/trim → handlers/api/request-trim.ts, POST /v1/jobs/:jobId/gif → handlers/api/request-gif.ts, POST /v1/jobs/:jobId/mp3 → handlers/api/request-mp3.ts; **(f)** SQS subscribers: DownloadQueue → handlers/workers/download-worker.ts, TrimQueue → handlers/workers/trim-worker.ts, GifQueue → handlers/workers/gif-worker.ts, Mp3Queue → handlers/workers/mp3-worker.ts; all Lambdas get table.grantReadWriteData + bucket read/write grants, worker Lambdas also get respective queue send/receive grants, Lambda layers for yt-dlp and ffmpeg on worker Lambdas

**Checkpoint**: Foundation is ready — environment clients, key builders, error types, and all SST resources are declared. User story work can begin in parallel.

---

## Phase 3: User Story 1 — Solicitar descarga de video TikTok (Priority: P1) 🎯 MVP

**Goal**: Accept a TikTok URL via POST /v1/jobs, return a job ID immediately (201) or a cached download URL directly (200). Process the download asynchronously via yt-dlp. Push real-time status updates to WebSocket subscribers throughout the job lifecycle.

**Independent Test**: Send `POST /v1/jobs {"tiktokUrl": "...", "format": "mp4"}` → receive `201 {jobId, status: "pending"}` in < 3s. Connect WebSocket and subscribe to jobId → receive `job_update {status: "downloading"}`, then `job_update {status: "ready", downloadUrl}`. Repeat POST for same URL → receive `200 {status: "ready", downloadUrl}` (cache hit, < 1s). Send invalid URL → receive `400 INVALID_URL`.

### Implementation for User Story 1

- [x] T008 [P] [US1] Create back/src/jobs/domain/job-status.ts — `JobStatus` const enum: `pending`, `downloading`, `ready`, `trimming`, `trimmed`, `creating_gif`, `gif_created`, `creating_mp3`, `mp3_ready`, `error`; export `TERMINAL_STATUSES` set (ready, trimmed, gif_created, mp3_ready, error) and `TERMINAL_WITH_ARTIFACT` set (ready, trimmed, gif_created, mp3_ready)
- [x] T009 [P] [US1] Create back/src/jobs/domain/job.entity.ts — `Job` type with all fields from data-model.md: pk, sk, type, jobId, videoId?, tiktokUrl, status: JobStatus, format, s3Key?, title?, duration?, thumbnailUrl?, trimStart?, trimEnd?, errorMessage?, retryCount, createdAt, updatedAt, expiresAt (Unix epoch); export `createJob(params)` factory using ulidx for jobId, current ISO createdAt, TTL +7 days
- [x] T010 [P] [US1] Create back/src/jobs/domain/cache-artifact.entity.ts — `CacheArtifact` type matching data-model.md (pk, sk, type, videoId, tiktokUrl, format, artifactType, s3Key, fileSizeBytes?, duration?, title?, thumbnailUrl?, trimStart?, trimEnd?, downloadCount, createdAt, expiresAt); export `artifactTtlSeconds(format, artifactType)` helper returning TTL per research.md D3 table
- [x] T011 [P] [US1] Create back/src/jobs/application/ports/job.repository.ts — `IJobRepository` interface: `save(job: Job): Promise<void>`, `findById(jobId: string): Promise<Job | null>`, `updateStatus(jobId, status, extra?: Partial<Job>): Promise<void>`, `acquireLock(videoId: string, jobId: string): Promise<boolean>`, `releaseLock(videoId: string): Promise<void>`
- [x] T012 [P] [US1] Create back/src/jobs/application/ports/artifact.repository.ts — `IArtifactRepository` interface: `findByKey(videoId, format, artifactType, trimStart?, trimEnd?): Promise<CacheArtifact | null>`, `save(artifact: CacheArtifact): Promise<void>`, `incrementDownloadCount(videoId, format, artifactType, trimStart?, trimEnd?): Promise<void>`
- [x] T013 [P] [US1] Create back/src/jobs/application/ports/job-queue.port.ts — `IJobQueuePort` interface with typed message payloads: `enqueueDownload(msg: DownloadMessage): Promise<void>`, `enqueueTrim(msg: TrimMessage): Promise<void>`, `enqueueGif(msg: GifMessage): Promise<void>`, `enqueueMp3(msg: Mp3Message): Promise<void>`; export each message type (DownloadMessage: { jobId, tiktokUrl, format }, TrimMessage: { jobId, videoId, trimStart, trimEnd }, GifMessage: { jobId, videoId, trimStart, trimEnd }, Mp3Message: { jobId, videoId, trimStart?, trimEnd? })
- [x] T014 [P] [US1] Create back/src/jobs/application/ports/storage.port.ts — `IStoragePort` interface: `upload(key: string, localPath: string, contentType: string): Promise<number>` (returns fileSizeBytes), `download(key: string, destPath: string): Promise<void>` (streams S3 object to local file path), `generatePresignedUrl(key: string, expiresIn?: number): Promise<string>` (default 3600s), `objectExists(key: string): Promise<boolean>`
- [x] T015 [US1] Implement back/src/jobs/application/create-job.usecase.ts — `CreateJobUseCase(repos, queue, storage)`: **(1)** validate tiktokUrl domain (must include tiktok.com, reject others); **(2)** derive videoId from URL path; **(3)** check `IArtifactRepository.findByKey(videoId, format, "original")` for cache; **(4)** on cache hit: verify `IStoragePort.objectExists(artifact.s3Key)` (graceful miss if false), generate presigned URL, return `{hit: true, downloadUrl, job: null}`; **(5)** on cache miss: create Job via `createJob()` factory, `IJobRepository.save(job)`, `IJobQueuePort.enqueueDownload(...)`, return `{hit: false, job}`
- [x] T016 [P] [US1] Implement back/src/jobs/infrastructure/dynamo/job.dynamo-repo.ts — DynamoDB operations using dynamo.client.ts + table-keys.ts: `save` (PutItem with full Job item), `findById` (GetItem jobPk+jobSk), `updateStatus` (UpdateItem conditional on attribute_exists, sets status + updatedAt + optional extra fields), `acquireLock` (PutItem on `lockPk(videoId)/lockSk()` with `ConditionExpression: "attribute_not_exists(pk)"`, expiresAt +10min; returns `true` on success, `false` on ConditionalCheckFailedException), `releaseLock` (DeleteItem lockPk+lockSk)
- [x] T017 [P] [US1] Implement back/src/jobs/infrastructure/dynamo/artifact.dynamo-repo.ts — DynamoDB operations: `findByKey` (GetItem artifactPk+artifactSk), `save` (PutItem CacheArtifact item with expiresAt from `artifactTtlSeconds()`), `incrementDownloadCount` (UpdateItem ADD downloadCount 1)
- [x] T018 [P] [US1] Implement back/src/jobs/infrastructure/sqs/job-queue.adapter.ts — `IJobQueuePort` implementation: `SQSClient.SendMessage` for each queue using queue URLs sourced from `Resource.DownloadQueue.url`, `Resource.TrimQueue.url`, `Resource.GifQueue.url`, `Resource.Mp3Queue.url` (sst-env); serialize message body as JSON
- [x] T019 [P] [US1] Implement back/src/jobs/infrastructure/s3/artifact-storage.adapter.ts — `IStoragePort` implementation: `upload()` reads local file from localPath, calls `PutObjectCommand` with Body as fs.ReadStream; `download()` calls `GetObjectCommand`, pipes `.Body` (SdkStreamMixin) to `fs.createWriteStream(destPath)` using Node.js stream pipeline, rejects on stream error; `generatePresignedUrl()` uses `GetObjectCommand` + `getSignedUrl` with expiresIn from parameter; `objectExists()` uses `HeadObjectCommand`, returns false on NotFound (404)
- [x] T020 [P] [US1] Create back/src/processing/domain/video-processor.entity.ts — `VideoInfo` type: videoId (string), title (string), duration (number, seconds), thumbnailUrl (string | null); `DownloadResult` type: videoInfo, s3Key, fileSizeBytes; `MAX_VIDEO_DURATION_SECONDS = 300` constant
- [x] T021 [P] [US1] Create back/src/processing/application/ports/downloader.port.ts — `IDownloaderPort` interface: `downloadVideo(url: string, destDir: string): Promise<DownloadResult & { localPath: string }>`; contract: validates duration ≤ MAX_VIDEO_DURATION_SECONDS before returning, throws AppError VIDEO_TOO_LONG if exceeded
- [x] T022 [US1] Implement back/src/processing/application/download-video.usecase.ts — `DownloadVideoUseCase(jobRepo, artifactRepo, downloader, storage, notifier)`: **(1)** call `IJobRepository.acquireLock(videoId, jobId)`; if false (concurrent lock already held) → return immediately without throwing (SQS visibility timeout on DownloadQueue is 900s — the message will reappear and find the artifact via cache hit on retry); **(2)** update job status to `downloading`; **(3)** call `IDownloaderPort.downloadVideo(tiktokUrl, "/tmp")`; **(4)** upload to S3 at `originals/{videoId}/{videoId}.mp4` via `IStoragePort.upload()`; **(5)** write `CacheArtifact` (format: mp4, type: original, expiresAt per D3) via `IArtifactRepository.save()`; **(6)** update job to `ready` with s3Key + videoInfo fields; **(7)** `IJobRepository.releaseLock(videoId)`; **(8)** call `INotifyJobUpdateUseCase.execute(jobId)` — throws on all errors (let caller handle retry); no active polling inside the Lambda invocation
- [x] T023 [P] [US1] Implement back/src/processing/infrastructure/ytdlp.adapter.ts — `IDownloaderPort` implementation: executes `/opt/yt-dlp` binary via child_process.spawn with args `["--no-playlist", "--write-info-json", "-P", destDir, "-o", "%(id)s.%(ext)s", url]`; waits for exit; reads JSON info file to extract id, title, duration, thumbnail; validates `duration ≤ MAX_VIDEO_DURATION_SECONDS`, throws `videoTooLong()` if exceeded; returns `{ localPath, videoInfo, s3Key, fileSizeBytes }` (s3Key set after upload is caller's responsibility — return localPath for caller to upload)
- [x] T024 [P] [US1] Create back/src/notifications/application/ports/connection.repository.ts — `IConnectionRepository` interface: `save(conn: WebSocketConnection): Promise<void>`, `updateSubscription(connId: string, jobId: string): Promise<void>`, `delete(connId: string): Promise<void>`, `findByJobId(jobId: string): Promise<WebSocketConnection[]>`; export `WebSocketConnection` type (pk, sk, type, connectionId, jobId?, connectedAt, expiresAt, gsi1pk?, gsi1sk?)
- [x] T025 [US1] Create back/src/notifications/application/ports/job-reader.port.ts — `IJobReader` interface (read-only subset): `findById(jobId: string): Promise<Job | null>`; then implement `NotifyJobUpdateUseCase(connRepo, wsAdapter, jobReader: IJobReader)`: **(1)** fetch job via `IJobReader.findById(jobId)`; **(2)** query `IConnectionRepository.findByJobId(jobId)` (returns 0..n connections via GSI1); **(3)** for each connection call `IWebSocketAdapter.send(connId, payload)` where payload is `{ type: "job_update", jobId, status, downloadUrl?, errorMessage?, title?, duration?, thumbnailUrl?, updatedAt }`; **(4)** `IWebSocketAdapter.send()` throws `GoneException` for stale connections → call `IConnectionRepository.delete(connId)` and continue
- [x] T026 [P] [US1] Implement back/src/notifications/infrastructure/dynamo/connection.dynamo-repo.ts — DynamoDB ops using dynamo.client.ts: `save` (PutItem CONN# item with expiresAt +24h), `updateSubscription` (UpdateItem set jobId + gsi1pk=`JOB#{jobId}` + gsi1sk=`CONN#{connId}`), `delete` (DeleteItem connPk+connSk), `findByJobId` (Query GSI1 IndexName=gsi1 KeyConditionExpression gsi1pk=`JOB#{jobId}`)
- [x] T027 [P] [US1] Implement back/src/notifications/infrastructure/apigw/websocket.adapter.ts — `IWebSocketAdapter` interface + implementation: `ApiGatewayManagementApiClient` with endpoint from `Resource.WsApi.managementEndpoint`; `send(connId, data)` calls `PostToConnectionCommand`; re-throws non-GoneException errors; export interface with `send(connId: string, data: unknown): Promise<void>`
- [x] T028 [P] [US1] Implement back/src/handlers/websocket/connect.ts — WS `$connect` Lambda handler: instantiate `ConnectionDynamoRepo`; call `IConnectionRepository.save({ connectionId: event.requestContext.connectionId, connectedAt: now, expiresAt: +24h })`; return `{ statusCode: 200 }`
- [x] T029 [P] [US1] Implement back/src/handlers/websocket/disconnect.ts — WS `$disconnect` Lambda handler: instantiate `ConnectionDynamoRepo`; call `IConnectionRepository.delete(event.requestContext.connectionId)`; return `{ statusCode: 200 }`
- [x] T030 [P] [US1] Implement back/src/handlers/websocket/subscribe.ts — WS `subscribe` Lambda handler: parse body `{action: "subscribe", jobId}`; call `IConnectionRepository.updateSubscription(connId, jobId)`; fetch current job status; respond to client via `IWebSocketAdapter.send(connId, { type: "subscribed", jobId, currentStatus })`; return `{ statusCode: 200 }`
- [x] T031 [US1] Implement back/src/handlers/workers/download-worker.ts — SQS event handler: iterate `event.Records`; parse body `{ jobId, tiktokUrl, format }`; instantiate all adapters; call `DownloadVideoUseCase.execute()`; **on success**: write `ProcessingEvent` items (download_started, cache_miss/cache_hit, download_completed) directly to DynamoDB table using dynamo.client.ts + jobPk/`EVENT#{iso}#{ulid}` SK, expiresAt +7d; call `NotifyJobUpdateUseCase.execute(jobId)`; **on failure**: check `job.retryCount < 1` → update retryCount+1 via `IJobRepository.updateStatus()` and re-throw (SQS retries once); on second failure (retryCount ≥ 1): update job to `error` + errorMessage, releaseLock, write `download_failed` ProcessingEvent, call `NotifyJobUpdateUseCase.execute(jobId)` (does not re-throw — avoids DLQ for handled errors); return `{ batchItemFailures: [] }` on success or include failed messageId on unhandled throws
- [x] T032 [US1] Implement back/src/handlers/api/create-job.ts — Hono handler for `POST /v1/jobs`: **(1)** rate limit check — DynamoDB UpdateItem on `RATELIMIT#{clientIp}/RATELIMIT` with ADD count 1, ConditionExpression `count < 10` OR create fresh item with count=1, TTL 60s; if ConditionalCheckFailed return `429 { error: { code: RATE_LIMIT_EXCEEDED } }` with header `Retry-After: 60` (FR-016); **(2)** Zod validate body `{ tiktokUrl: z.string().url(), format: z.enum(["mp4","mp3"]).default("mp4") }`; **(3)** instantiate adapters; **(4)** call `CreateJobUseCase.execute()`; **(5)** return `200` on cache hit or `201` on cache miss per contracts/api.md response shapes

**Checkpoint**: US1 is complete when `POST /v1/jobs` creates a job in < 3s, yt-dlp downloads the video, S3 stores the artifact, DynamoDB holds job metadata, and WebSocket subscribers receive `job_update {status: "ready", downloadUrl}`. Cache hits return 200 < 1s. Rate limit enforced at 10 rpm/IP.

---

## Phase 4: User Story 2 — Consultar el estado de un trabajo (Priority: P1)

**Goal**: Expose `GET /v1/jobs/:jobId` to return current job status, metadata, and a fresh 1-hour presigned downloadUrl when an artifact is available. Handle expired S3 objects gracefully.

**Independent Test**: After a job reaches `ready`, call `GET /v1/jobs/:jobId` → receive `200 { status: "ready", downloadUrl: "https://..." }`; the downloadUrl must be accessible for 1 hour. Call with unknown jobId → receive `404 JOB_NOT_FOUND`. Call when job is still `downloading` → receive `200 { status: "downloading", downloadUrl: null }`.

### Implementation for User Story 2

- [x] T033 [P] [US2] Implement back/src/jobs/application/get-job.usecase.ts — `GetJobUseCase(jobRepo, storage)`: **(1)** `IJobRepository.findById(jobId)` → throw `jobNotFound()` if null; **(2)** if `job.s3Key` exists and `job.status` ∈ TERMINAL_WITH_ARTIFACT: call `IStoragePort.objectExists(job.s3Key)` — if true generate `downloadUrl = IStoragePort.generatePresignedUrl(job.s3Key, 3600)`, if false set downloadUrl = null (graceful cache miss — do not re-trigger download); **(3)** return job fields + downloadUrl per contracts/api.md GET response shape
- [x] T034 [US2] Implement back/src/handlers/api/get-job.ts — Hono handler for `GET /v1/jobs/:jobId`: validate `c.req.param("jobId")` is non-empty string; instantiate adapters; call `GetJobUseCase.execute(jobId)`; on `AppError JOB_NOT_FOUND` return `404` error envelope; on success return `200` with full job object per contracts/api.md

**Checkpoint**: US2 is complete when polling `GET /v1/jobs/:jobId` at any point in the job lifecycle returns accurate status, and returns a valid presigned S3 URL when the artifact is ready.

---

## Phase 5: User Story 3 — Recortar un video ya procesado (Priority: P2)

**Goal**: Accept a trim request on a `ready` job, validate the time range, process the trim asynchronously via ffmpeg stream-copy, cache identical trim requests, and notify WS subscribers upon completion.

**Independent Test**: With a job in `status: "ready"`, send `POST /v1/jobs/:jobId/trim {"trimStart": 5, "trimEnd": 30}` → receive `202 {status: "trimming"}`. After processing, `GET /v1/jobs/:jobId` returns `status: "trimmed"` with `downloadUrl`. Second identical POST returns `200` (cache hit). POST with job not in `ready` state → `409 JOB_NOT_READY`. POST with `trimStart ≥ trimEnd` → `400 INVALID_TRIM_RANGE`.

### Implementation for User Story 3

<!-- T035 reserved — intentionally skipped -->
- [x] T036 [P] [US3] Create back/src/processing/application/ports/transcoder.port.ts — `ITranscoderPort` interface: `trim(inputPath: string, outputPath: string, start: number, end: number): Promise<void>`, `createGif(inputPath: string, outputPath: string, start: number, end: number): Promise<void>`, `extractMp3(inputPath: string, outputPath: string, start?: number, end?: number): Promise<void>`
- [x] T037 [P] [US3] Implement back/src/processing/infrastructure/ffmpeg.adapter.ts — `ITranscoderPort` implementation using `/opt/ffmpeg` binary: `trim()` uses stream-copy (`-ss {start} -to {end} -c copy -avoid_negative_ts make_zero`), `createGif()` uses 2-pass palettegen (`-vf "fps=10,scale=480:-1:flags=lanczos,palettegen"` + `paletteuse`), `extractMp3()` uses `-vn -acodec libmp3lame -q:a 2`; all write to /tmp; throw `internalError(stderr)` on non-zero exit code
- [x] T038 [US3] Implement back/src/processing/application/trim-video.usecase.ts — `TrimVideoUseCase(jobRepo, artifactRepo, transcoder, storage, notifier)`: **(1)** download original from S3 to `/tmp/{videoId}_orig.mp4` via `IStoragePort` (use S3 GetObject); **(2)** call `ITranscoderPort.trim(localIn, localOut, trimStart, trimEnd)`; **(3)** upload to `trims/{videoId}/{jobId}.mp4`; **(4)** write `CacheArtifact` (format:mp4, type:trim, trimStart/trimEnd, expiresAt +1d) via `IArtifactRepository.save()`; **(5)** update job to `trimmed` with s3Key + trimStart + trimEnd via `IJobRepository.updateStatus()`; **(6)** call `NotifyJobUpdateUseCase.execute(jobId)`
- [x] T039 [US3] Implement back/src/jobs/application/request-trim.usecase.ts — `RequestTrimUseCase(jobRepo, artifactRepo, queuePort, storage)`: **(1)** `IJobRepository.findById(jobId)` → throw `jobNotFound()` if null; **(2)** validate `job.status === "ready"`, throw `jobNotReady()` otherwise; **(3)** validate `trimStart < trimEnd && trimEnd ≤ job.duration`, throw `invalidTrimRange()` otherwise; **(4)** check `IArtifactRepository.findByKey(job.videoId, "mp4", "trim", trimStart, trimEnd)` for cache — on hit: verify `IStoragePort.objectExists()`, generate presigned URL, update job to `trimmed`, return `{hit: true, downloadUrl}`; **(5)** on miss: update job to `trimming`, enqueue `TrimMessage`, return `{hit: false}`
- [x] T040 [US3] Implement back/src/handlers/api/request-trim.ts — Hono handler for `POST /v1/jobs/:jobId/trim`: Zod validate body `{ trimStart: z.number().min(0), trimEnd: z.number().positive() }`; instantiate adapters; call `RequestTrimUseCase`; on `AppError` map to appropriate HTTP status per contracts/api.md; return `200` (cache hit) or `202` (processing started)
- [x] T041 [US3] Implement back/src/handlers/workers/trim-worker.ts — SQS TrimQueue consumer: parse `{ jobId, videoId, trimStart, trimEnd }`; instantiate adapters; call `TrimVideoUseCase.execute()`; **on success**: write `ProcessingEvent` items (trim_started, trim_completed) to DynamoDB; **on failure**: same retry/DLQ pattern as download-worker — retryCount < 1 re-throw, else mark `error` + trim_failed event + WS notify; return batchItemFailures

**Checkpoint**: US3 is complete when trim requests start a TrimQueue Lambda, ffmpeg produces a stream-copy cut, the artifact is cached, and WS subscribers receive `{status: "trimmed", downloadUrl}`. Duplicate trim ranges are served from cache.

---

## Phase 6: User Story 4 — Generar GIF y extraer MP3 (Priority: P3)

> **Nota**: La extracción de MP3 no tiene User Story numerada propia en spec.md. Esta fase cubre FR-006, FR-010 y las acceptance scenarios de US4 (GIF). Las tareas de MP3 derivan directamente de los endpoints `POST /v1/jobs/:jobId/mp3` documentados en contracts/api.md.

**Goal**: Support asynchronous GIF generation and MP3 audio extraction from ready/trimmed jobs, with caching of identical operations.

**Independent Test**: With a job in `status: "ready"`, `POST /v1/jobs/:jobId/gif {"trimStart": 0, "trimEnd": 10}` returns `202`. After processing, `GET /v1/jobs/:jobId` returns `status: "gif_created"` with a `.gif` download URL. Same flow for MP3: `POST /v1/jobs/:jobId/mp3` → `202` → `status: "mp3_ready"`. Cache hit on identical request returns `200` immediately.

### Implementation for User Story 4

<!-- T042 reserved — intentionally skipped -->
- [x] T043 [P] [US4] Implement back/src/processing/application/create-gif.usecase.ts — `CreateGifUseCase(jobRepo, artifactRepo, transcoder, storage, notifier)`: download original to `/tmp`, call `ITranscoderPort.createGif()`, upload to `gifs/{videoId}/{jobId}.gif`, write `CacheArtifact` (format:gif, type:gif, expiresAt +1d), update job to `gif_created`, call `NotifyJobUpdateUseCase`
- [x] T044 [P] [US4] Implement back/src/processing/application/extract-mp3.usecase.ts — `ExtractMp3UseCase(jobRepo, artifactRepo, transcoder, storage, notifier)`: download original to `/tmp`, call `ITranscoderPort.extractMp3(localIn, localOut, trimStart?, trimEnd?)`; if no trimStart/trimEnd upload to `mp3s/originals/{videoId}/{videoId}.mp3` (expiresAt +2d); else upload to `mp3s/trims/{videoId}/{jobId}.mp3` (expiresAt +1d); write `CacheArtifact`, update job to `mp3_ready`, call `NotifyJobUpdateUseCase`
- [x] T045 [P] [US4] Implement back/src/jobs/application/request-gif.usecase.ts — validate job status ∈ `{ready, trimmed}` (throw `jobNotReady()` otherwise); normalize defaults (trimStart = 0, trimEnd = min(10, job.duration)); check `IArtifactRepository.findByKey(videoId, "gif", "gif", trimStart, trimEnd)` for cache — on hit verify objectExists + presigned URL + `gif_created` update; on miss update job to `creating_gif`, enqueue GifMessage, return `{hit: false}`
- [x] T046 [P] [US4] Implement back/src/jobs/application/request-mp3.usecase.ts — validate job status ∈ `{ready, trimmed}`; normalize trimStart/trimEnd (full range default); check `IArtifactRepository.findByKey(videoId, "mp3", trimStart || trimEnd ? "trim" : "original", trimStart, trimEnd)` for cache; on hit verify + presigned URL + `mp3_ready` update; on miss update job to `creating_mp3`, enqueue Mp3Message, return `{hit: false}`
- [x] T047 [P] [US4] Implement back/src/handlers/api/request-gif.ts — Hono handler for `POST /v1/jobs/:jobId/gif`: Zod validate optional `{ trimStart?: z.number().min(0), trimEnd?: z.number().positive() }`; call `RequestGifUseCase`; return `200` (cache hit) or `202` per contracts/api.md
- [x] T048 [P] [US4] Implement back/src/handlers/api/request-mp3.ts — Hono handler for `POST /v1/jobs/:jobId/mp3`: Zod validate optional `{ trimStart?: z.number().min(0), trimEnd?: z.number().positive() }`; call `RequestMp3UseCase`; return `200` (cache hit) or `202` per contracts/api.md
- [x] T049 [P] [US4] Implement back/src/handlers/workers/gif-worker.ts — SQS GifQueue consumer: parse `{ jobId, videoId, trimStart, trimEnd }`; call `CreateGifUseCase.execute()`; on success write gif_started/gif_completed ProcessingEvents; on failure: retry pattern (retryCount < 1 re-throw, else mark error + gif_failed + WS notify); return batchItemFailures
- [x] T050 [P] [US4] Implement back/src/handlers/workers/mp3-worker.ts — SQS Mp3Queue consumer: parse `{ jobId, videoId, trimStart?, trimEnd? }`; call `ExtractMp3UseCase.execute()`; on success write mp3_started/mp3_completed ProcessingEvents; on failure: retry pattern (retryCount < 1 re-throw, else mark error + mp3_failed + WS notify); return batchItemFailures
- [x] T051 [US4] Verify back/sst.config.ts wiring for US4 — confirm GifQueue subscriber → gif-worker.ts and Mp3Queue subscriber → mp3-worker.ts with correct Lambda timeouts (300s), memory (1024 MB), layers (ffmpeg only — no yt-dlp needed); confirm POST /v1/jobs/:jobId/gif and POST /v1/jobs/:jobId/mp3 routes reference correct handler files; add any missing table/bucket permissions

**Checkpoint**: US4 is complete when GIF and MP3 requests are processed asynchronously by separate Lambda workers, identical operations are cached, and WS subscribers receive the correct terminal status with download URLs.

---

## Phase 7: User Story 5 — Limpieza automática de artefactos (Priority: P3)

**Goal**: Confirm that native AWS mechanisms (S3 lifecycle rules + DynamoDB TTL) satisfy FR-009 without any Lambda cleaner. Verify all item writers assign correct `expiresAt` values. Ensure graceful handling in `GetJobUseCase` when S3 objects are already expired.

**Independent Test**: Confirm in AWS Console (or `aws dynamodb describe-table`) that TrimtokTable has TTL enabled on `expiresAt`. Confirm ArtifactsBucket lifecycle rules are active for all 5 prefixes. Verify `GetJobUseCase` returns job without `downloadUrl` (no error) when the S3 object no longer exists. Check CloudWatch for S3 lifecycle expiration events on older test artifacts.

### Implementation for User Story 5

- [x] T052 [US5] Audit back/sst.config.ts ArtifactsBucket lifecycle configuration — verify all 5 prefix expiration rules (originals/ 2d, trims/ 1d, gifs/ 1d, mp3s/originals/ 2d, mp3s/trims/ 1d) and the AbortIncompleteMultipartUpload rule (1d for all prefixes) are declared; add any missing rules; note: DynamoDB TTL has up to 48h delete lag — per research.md D3 note, CacheArtifact records may outlive S3 objects; `GetJobUseCase` (T033) already handles this gracefully
- [x] T053 [P] [US5] Audit `expiresAt` TTL assignments across all DynamoDB item writers — verify: `job.entity.ts` factory sets Job TTL +7d, `artifact.dynamo-repo.ts` sets TTL per `artifactTtlSeconds()` from data-model.md D3 table (mp4 original 48h, trim 24h, gif 24h, mp3 original 48h, mp3 trim 24h), `connection.dynamo-repo.ts` sets CONN TTL +24h, `download-worker.ts` LOCK items set TTL +10min (600s), all ProcessingEvent writers set TTL +7d; fix any incorrect calculation (use `Math.floor(Date.now() / 1000) + seconds`)

**Checkpoint**: US5 is complete when S3 lifecycle rules and DynamoDB TTL cover all artifact types with correct retention periods per research.md Decision 3. No Lambda cleaner is present (FR-009 satisfied natively).

---

## Phase 8: Testing (Constitution Principle VIII)

**Purpose**: Verify all critical business flows at unit level (domain + application layers, injected mocks, no AWS) and at integration level (DynamoDB Local). Coverage on `src/{jobs,processing,notifications}/**/{domain,application}/` MUST NOT fall below 80% per Constitution Principle VIII.

**Prerequisite**: Unit test tasks can be written in parallel with their corresponding implementation tasks. Integration test tasks require the infrastructure adapters and DynamoDB Local to be available.

### Testing Setup

- [x] T058 [P] Create back/vitest.config.ts — set testMatch `["tests/**/*.test.ts"]`, coverage provider `v8`, include `["src/{jobs,processing,notifications}/**/{domain,application}/**/*.ts"]`, thresholds `{ statements: 80, branches: 80, functions: 80, lines: 80 }`; add scripts to back/package.json: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`, `"test:integration": "vitest run tests/integration --reporter verbose"`

### Unit Tests — Domain Layer

- [x] T059 [P] [US1] Create back/tests/unit/jobs/domain/job-status.test.ts — verify all 10 JobStatus values exist as string literals; TERMINAL_STATUSES contains `{ready, trimmed, gif_created, mp3_ready, error}` and excludes `{pending, downloading, trimming, creating_gif, creating_mp3}`; TERMINAL_WITH_ARTIFACT excludes `error`
- [x] T060 [P] [US1] Create back/tests/unit/jobs/domain/job.entity.test.ts — test `createJob()` factory: jobId is 26-char ULID string, createdAt matches ISO 8601 regex, status defaults to `"pending"`, retryCount is `0`, expiresAt ≥ `Math.floor(Date.now()/1000) + 7*24*3600`
- [x] T061 [P] [US1] Create back/tests/unit/jobs/domain/cache-artifact.entity.test.ts — test `artifactTtlSeconds()`: mp4/original → 172800, mp4/trim → 86400, gif/gif → 86400, mp3/original → 172800, mp3/trim → 86400
- [x] T062 [P] [US1] Create back/tests/unit/processing/domain/video-processor.entity.test.ts — verify `MAX_VIDEO_DURATION_SECONDS === 300`; verify VideoInfo and DownloadResult types can be constructed with all expected fields without TypeScript errors

### Unit Tests — Application Layer (injected mock adapters, zero AWS)

- [x] T063 [P] [US1] Create back/tests/unit/jobs/application/create-job.usecase.test.ts — mock IJobRepository, IArtifactRepository, IJobQueuePort, IStoragePort; test: (a) non-tiktok URL → `INVALID_URL`; (b) cache miss → saves job, enqueues download, returns `{hit:false}`; (c) cache hit + objectExists=true → returns `{hit:true, downloadUrl}`; (d) cache hit + objectExists=false → falls through to cache-miss path
- [x] T064 [P] [US2] Create back/tests/unit/jobs/application/get-job.usecase.test.ts — mock IJobRepository, IStoragePort; test: (a) findById=null → throws `JOB_NOT_FOUND`; (b) status=ready + s3Key + objectExists=true → returns downloadUrl; (c) status=ready + s3Key + objectExists=false → returns downloadUrl=null without throwing; (d) status=downloading (non-terminal) → returns downloadUrl=null
- [x] T065 [P] [US3] Create back/tests/unit/jobs/application/request-trim.usecase.test.ts — mock ports; test: (a) job not found → `JOB_NOT_FOUND`; (b) job.status≠ready → `JOB_NOT_READY`; (c) trimStart≥trimEnd → `INVALID_TRIM_RANGE`; (d) trimEnd>duration → `INVALID_TRIM_RANGE`; (e) cache miss → updates to trimming, enqueues TrimMessage; (f) cache hit + objectExists=true → updates to trimmed, returns downloadUrl
- [x] T066 [P] [US4] Create back/tests/unit/jobs/application/request-gif.usecase.test.ts — mock ports; test: (a) job.status not in `{ready,trimmed}` → `JOB_NOT_READY`; (b) trimEnd omitted → defaults to `min(10, job.duration)`; (c) cache miss → updates to creating_gif, enqueues GifMessage; (d) cache hit + objectExists=true → returns downloadUrl, updates to gif_created
- [x] T067 [P] [US4] Create back/tests/unit/jobs/application/request-mp3.usecase.test.ts — mock ports; test: (a) job not in `{ready,trimmed}` → `JOB_NOT_READY`; (b) no trimStart/trimEnd → artifactType=`"original"`, uses mp3s/originals/ path; (c) with trimStart+trimEnd → artifactType=`"trim"`, uses mp3s/trims/ path; (d) cache hit → `{hit:true, downloadUrl}`
- [x] T068 [P] [US1] Create back/tests/unit/processing/application/download-video.usecase.test.ts — mock IJobRepository, IArtifactRepository, IDownloaderPort, IStoragePort, NotifyJobUpdateUseCase; test: (a) lock acquired → full success path: downloading → upload → save artifact → ready → release lock → notify; (b) downloader throws `VIDEO_TOO_LONG` → error propagates, lock released in finally; (c) S3 upload throws → error propagates, lock released
- [x] T069 [P] [US3] Create back/tests/unit/processing/application/trim-video.usecase.test.ts — mock ports; verify: **(a)** storage.download() called with job.s3Key (original) before transcoder call; **(b)** transcoder.trim called with correct start/end and /tmp paths; **(c)** S3 upload key is `trims/{videoId}/{jobId}.mp4`; **(d)** CacheArtifact saved with format=mp4, artifactType=trim, expiresAt≈now+86400; **(e)** job updated to `trimmed`; **(f)** notifier called
- [x] T070 [P] [US4] Create back/tests/unit/processing/application/create-gif.usecase.test.ts — mock ports; verify: **(a)** storage.download() called with job.s3Key (original) before transcoder call; **(b)** transcoder.createGif called with correct /tmp paths; **(c)** S3 key `gifs/{videoId}/{jobId}.gif`; **(d)** CacheArtifact format=gif, type=gif, expiresAt≈now+86400; **(e)** job status → gif_created; **(f)** notifier called
- [x] T071 [P] [US4] Create back/tests/unit/processing/application/extract-mp3.usecase.test.ts — mock ports; test: **(a)** storage.download() called with job.s3Key (original) before transcoder call; **(b)** no range → S3 key `mp3s/originals/{videoId}/{videoId}.mp3`, artifactType=original, TTL 172800s; **(c)** with range → S3 key `mp3s/trims/{videoId}/{jobId}.mp3`, artifactType=trim, TTL 86400s; **(d)** job status → mp3_ready; **(e)** notifier called
- [x] T072 [P] [US1] Create back/tests/unit/notifications/application/notify-job-update.usecase.test.ts — mock IConnectionRepository, IWebSocketAdapter, IJobRepository; test: (a) no connections → send never called; (b) 2 connections → send called twice with `{type:"job_update", jobId, status}`; (c) one GoneException → deletes that connection, continues sending to others; (d) terminal status job with s3Key → payload includes downloadUrl

### Integration Tests — DynamoDB Local

- [x] T073 Create back/tests/integration/setup.ts — export `createTestDocClient()` (endpoint `http://localhost:8000`, dummy credentials), `createTestTable(client, tableName)` (creates TrimtokTable with gsi1 GSI + TTL attribute expiresAt), `deleteTestTable(client, tableName)`; document in back/README.md that `docker run -p 8000:8000 amazon/dynamodb-local` is prerequisite for integration tests
- [x] T074 [P] Create back/tests/integration/jobs/infrastructure/dynamo/job.dynamo-repo.integration.test.ts — against DynamoDB Local via setup.ts: (a) save + findById roundtrip preserves all fields; (b) updateStatus sets status + updatedAt; (c) acquireLock: first call true, concurrent second call false; (d) releaseLock → subsequent acquireLock returns true; (e) expiresAt is Unix epoch number
- [x] T075 [P] Create back/tests/integration/jobs/infrastructure/dynamo/artifact.dynamo-repo.integration.test.ts — against DynamoDB Local: (a) save + findByKey roundtrip for all 5 SK combinations (mp4/original, mp4/trim, gif/gif, mp3/original, mp3/trim); (b) findByKey returns null for unknown key; (c) incrementDownloadCount increments from 0→1→2 atomically
- [x] T076 [P] Create back/tests/integration/notifications/infrastructure/dynamo/connection.dynamo-repo.integration.test.ts — against DynamoDB Local: (a) save → findByJobId returns `[]` (no subscription); (b) updateSubscription → findByJobId via GSI1 returns connection; (c) delete → findByJobId returns `[]`; (d) two connections subscribe to same jobId → findByJobId returns both

**Checkpoint**: Phase 8 is complete when `pnpm test:coverage` reports ≥ 80% coverage on all domain and application source files and all integration tests pass against DynamoDB Local.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Observability, CloudWatch alarms for DLQs, audit log completeness, and a final route registry check.

- [x] T054 [P] Add CloudWatch log retention (7 days) to all Lambda log groups in back/sst.config.ts — use SST Function `transform` or `logging: { retention: "7 days" }` option on every Lambda definition; applies to all 5 API handlers, 4 worker handlers, and 3 WS handlers
- [x] T055 [P] Add CloudWatch Metric Alarms for all DLQs in back/sst.config.ts — one alarm per DLQ (DownloadDLQ, TrimDLQ, GifDLQ, Mp3DLQ): namespace `AWS/SQS`, metric `ApproximateNumberOfMessagesVisible`, threshold > 0, evaluation period 1; use `aws.cloudwatch.MetricAlarm` via SST pulumi escape hatch
- [x] T056 [P] Final route and permission audit — verify all 5 HTTP routes and 3 WS routes in back/sst.config.ts point to the correct handler files; verify each Lambda has minimum required permissions (API handlers: table read/write + bucket read + queue send; worker handlers: table read/write + bucket read/write + queue receive/delete; WS handlers: table read/write + WS management API; WsApi Lambdas: additional `execute-api:ManageConnections` policy)
- [x] T057 [P] Audit ProcessingEvent writes for completeness (FR-003, FR-008) — verify download-worker.ts writes `download_started`, `download_completed`/`download_failed`, `cache_hit`/`cache_miss`, `lock_acquired`, `lock_released`; trim-worker.ts writes `trim_started`, `trim_completed`/`trim_failed`; gif-worker.ts writes `gif_started`, `gif_completed`/`gif_failed`; mp3-worker.ts writes `mp3_started`, `mp3_completed`/`mp3_failed`; all entries use ULID for SK uniqueness and set expiresAt +7d
- [x] T077 [P] Validate SC-003 — create back/tests/load/post-jobs.k6.js: 500 VUs each sending `POST /v1/jobs` with a pre-downloaded mock URL; assert `http_req_duration{p95} < 3000ms` and `http_req_failed < 1%`; document `k6 run --env BASE_URL=<deployed-dev-api> post-jobs.k6.js` command in back/quickstart.md under "Load Testing" section
- [x] T078 [P] Document SC-004 validation procedure in back/quickstart.md — add "E2E Timing Validation" section with curl timing commands: `time curl -X POST .../v1/jobs -d '...'`, then poll `GET /v1/jobs/:jobId` with `--max-time 90` until status=ready; expected wall-clock < 90s for a 5-min TikTok video against the deployed dev stack

---

## Dependency Graph

```
Phase 1:  T001, T002   (parallel)
Phase 2:  T001 → T003, T004, T005, T006   (parallel after T001)
          T003, T004, T005, T006 → T007

US1 domain + ports (parallel after T007):
  T007 → T008, T009, T010, T020, T021, T024
  T008, T009, T010 → T011, T012, T013, T014

US1 use cases (after ports):
  T011, T012, T013, T014 → T015
  T020, T021 → T022

US1 infrastructure (parallel after T007):
  T007 → T016, T017, T018, T019, T023, T026, T027

US1 handlers (after use cases + infra):
  T015, T016, T017, T018, T019 → T032
  T022, T023, T016, T017, T019 → T031
  T024, T025 → T026, T027
  T026, T027 → T028, T029, T030, T031
  T025 → T031

US2 (after US1 ports):
  T011, T014 → T033
  T033 → T034

US3 (after T007 + T011-T014):
  T036 → T037 → T038
  T011, T012, T013 → T039 → T040
  T037, T038 → T041

US4 (parallel, after T036, T011-T014):
  T036 → T043, T044
  T011, T012, T013 → T045, T046
  T045 → T047
  T046 → T048
  T043 → T049
  T044 → T050
  T047, T048, T049, T050 → T051

US5 (after surrounding phases):
  T007 → T052
  T016, T017, T018, T019, T026, T031 → T053

Phase 8 Testing setup:
  T001 → T058

Unit tests (can run in parallel with their corresponding impl task):
  T008 → T059, T060, T061;  T020 → T062
  T015 → T063;  T033 → T064;  T039 → T065
  T045 → T066;  T046 → T067
  T022 → T068;  T038 → T069;  T043 → T070;  T044 → T071
  T025 → T072

Integration tests:
  T003, T058 → T073
  T073, T016 → T074;  T073, T017 → T075;  T073, T026 → T076

Final phase (after Phase 8 complete):
  T007 → T054, T055
  T031, T032, T034, T040, T047, T048, T049, T050 → T056, T057
  T058 → T077, T078
```

---

## Parallel Execution Examples

### US1 — maximum parallelism after T007

```
Group A (all parallel): T008, T009, T010, T016, T017, T018, T019, T020, T021, T023, T024
Group B (after Group A): T011, T012, T013, T014, T022, T025, T026, T027
Group C (after Group B): T015, T028, T029, T030
Group D (needs all Group C): T031, T032
```

### US3 — trim story internal parallel

```
Group A (parallel): T036, T039
Group B (after T036): T037;  (after T039): T040
Group C (after T037): T038;  after T038: T041
```

### US4 — almost entirely parallel

```
All T043–T050 can run in parallel (different files, independent use cases)
T051 is the integration checkpoint (verify SST wiring) — run after all
```

### Phase 8 — unit tests all parallel

```
Group A (all parallel after impl tasks complete): T059, T060, T061, T062, T063, T064,
                                                  T065, T066, T067, T068, T069, T070,
                                                  T071, T072
Group B (sequential setup): T073
Group C (parallel after T073): T074, T075, T076
```

---

## Implementation Strategy

**MVP Scope** (recommended first delivery): Phase 1 + Phase 2 + Phase 3 (US1) + Phase 4 (US2)

This covers the full download-and-status-check lifecycle: accept request → async download via yt-dlp → S3 storage → DynamoDB state → WebSocket push → presigned download URL. Sufficient to validate the entire serverless event-driven pipeline end-to-end.

**Incremental Delivery**:

| Increment | Phases | Delivers |
|-----------|--------|---------|
| MVP | 1, 2, 3, 4 | Job creation, async download, WS notifications, status polling, cache hits, rate limiting (US1 + US2) |
| Increment 2 | 5 | Video trim via ffmpeg stream-copy, trim caching (US3) |
| Increment 3 | 6 | GIF generation, MP3 extraction, GIF/MP3 caching (US4) |
| Increment 4 | 7, Final | Lifecycle audit, CloudWatch alarms, observability (US5 + polish) |
| Increment 5 | 8, Final | Unit + integration tests, coverage ≥ 80% on domain/application layers (Constitution VIII); load test + E2E timing validation (SC-003, SC-004) |

**Total tasks**: 78 (T001–T078, T035/T042 intentionally reserved)  
**Parallelizable tasks**: 54 marked `[P]`  
**Story-labeled tasks**: 61 (US1: 32, US2: 3, US3: 8, US4: 15, US5: 2, unlabeled: setup/foundational/polish/testing-setup/load)
