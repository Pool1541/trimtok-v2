# Quickstart: TrimTok Backend — Desarrollo Local

**Feature**: `003-trimtok-backend` | **Date**: 2026-04-11

---

## Prerequisitos

| Herramienta | Versión mínima | Instalación |
|-------------|---------------|-------------|
| Node.js | 20.x | https://nodejs.org |
| pnpm | 9.x | `npm i -g pnpm` |
| AWS CLI | 2.x | https://aws.amazon.com/cli/ |
| SST CLI | incluido en deps | `pnpm dlx sst` |
| Credenciales AWS | — | Ver sección de configuración |

---

## Configuración inicial

### 1. Instalar dependencias

```bash
cd back
pnpm install
```

### 2. Configurar credenciales AWS

SST Dev despliega en una cuenta AWS real (entorno de desarrollo). Configura credenciales con permisos suficientes:

```bash
aws configure --profile trimtok-dev
# AWS Access Key ID: <tu key>
# AWS Secret Access Key: <tu secret>
# Default region name: us-east-1
# Default output format: json
```

Exportar el perfil para SST:
```bash
export AWS_PROFILE=trimtok-dev
```

O usando variables de entorno (como en el `sst.config.ts` actual):
```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1
```

### 3. Iniciar SST Dev (modo desarrollo)

```bash
cd back
pnpm dev
# equivale a: npx sst dev
```

SST Dev:
- Despliega la infraestructura en AWS (tabla DynamoDB, bucket S3, colas SQS, API Gateway, WS API) en un stage personal (`dev-{tuNombre}`).
- Mantiene las Lambdas en modo "live" — el código se ejecuta localmente pero se invoca vía AWS. Los cambios en código se reflejan sin redeploy.
- Imprime las URLs de la API al arrancar.

**Output esperado**:
```
✓  Complete
   Api: https://abc123.execute-api.us-east-1.amazonaws.com
   WsApi: wss://xyz789.execute-api.us-east-1.amazonaws.com/dev
```

---

## Variables de entorno

SST inyecta automáticamente los recursos como variables de entorno en las Lambdas (via `sst-env.d.ts`). Para desarrollo local fuera de SST (tests de integración), crear un archivo `.env.test` en `back/`:

```bash
# back/.env.test — NO commitear, ya en .gitignore
TRIMTOK_TABLE_NAME=TrimtokTable-test
ARTIFACTS_BUCKET_NAME=trimtok-artifacts-test
DOWNLOAD_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/...
TRIM_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/...
GIF_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/...
MP3_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/...
WS_API_ENDPOINT=https://xyz789.execute-api.us-east-1.amazonaws.com/dev
AWS_REGION=us-east-1
```

---

## Tests

### Tests unitarios (sin AWS)

```bash
cd back
pnpm test:unit
# Ejecuta: vitest run tests/unit/
```

Los tests unitarios:
- Solo prueban `domain/` y `application/` layers.
- Usan mocks/stubs para todos los puertos de infraestructura.
- No requieren credenciales AWS ni red.
- Cobertura objetivo: ≥ 80%.

### Tests de integración (con DynamoDB Local)

Requieren DynamoDB Local corriendo:

```bash
# Terminal 1: DynamoDB Local
docker run -p 8000:8000 amazon/dynamodb-local

# Terminal 2: tests de integración
cd back
DYNAMODB_ENDPOINT=http://localhost:8000 pnpm test:integration
```

Los tests de integración:
- Prueban los adaptadores de `infrastructure/dynamo/` contra DynamoDB Local.
- Crean y limpian la tabla en cada test suite (`beforeAll` / `afterAll`).
- No requieren S3 ni SQS reales.

### Ejecutar todos los tests

```bash
cd back
pnpm test
```

---

## Estructura de comandos npm

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Inicia SST Dev (deploy + live Lambda) |
| `pnpm test` | Todos los tests (unit + integration) |
| `pnpm test:unit` | Solo tests unitarios |
| `pnpm test:integration` | Solo tests de integración |
| `pnpm build` | Compila TypeScript con esbuild |
| `pnpm deploy --stage prod` | Despliega a producción |
| `pnpm sst remove --stage dev` | Elimina el stack de desarrollo |

---

## Probar la API manualmente

Con SST Dev corriendo, usa la URL de la API impresa en consola:

```bash
API_URL="https://abc123.execute-api.us-east-1.amazonaws.com"

# 1. Crear un job de descarga
curl -X POST "$API_URL/v1/jobs" \
  -H "Content-Type: application/json" \
  -d '{"tiktokUrl": "https://www.tiktok.com/@user/video/7123456789"}'

# 2. Consultar estado del job (reemplazar con el jobId retornado)
JOB_ID="01HXZ4K9P3BQ7WVEM8FDN2RSTX"
curl "$API_URL/v1/jobs/$JOB_ID"

# 3. Solicitar trim (cuando status=ready)
curl -X POST "$API_URL/v1/jobs/$JOB_ID/trim" \
  -H "Content-Type: application/json" \
  -d '{"trimStart": 5.0, "trimEnd": 20.0}'

# 4. Health check
curl "$API_URL/health"
```

### Probar WebSocket

```bash
# Instalar wscat si no lo tienes
npm i -g wscat

WS_URL="wss://xyz789.execute-api.us-east-1.amazonaws.com/dev"

wscat -c "$WS_URL"
# Conectado. Escribir:
> {"action": "subscribe", "jobId": "01HXZ4K9P3BQ7WVEM8FDN2RSTX"}
# Esperar mensajes job_update en tiempo real
```

---

## Inspeccionar recursos en AWS

Con el stage activo, puedes inspeccionar directamente:

```bash
# Ver logs de una Lambda (reemplazar nombre de función)
aws logs tail /aws/lambda/TrimtokBackend-DownloadWorker --follow

# Consultar DynamoDB
aws dynamodb scan --table-name TrimtokTable-dev --limit 5

# Ver mensajes en DLQ
aws sqs get-queue-attributes \
  --queue-url "https://sqs.us-east-1.amazonaws.com/.../DownloadQueueDLQ" \
  --attribute-names ApproximateNumberOfMessages
```

---

## E2E Timing Validation

Esta sección documenta los tiempos de referencia observados en producción (us-east-1, arm64 Lambda, 1024MB) para validar que el sistema cumple las SLAs definidas en el spec.

### Flujo completo: URL → Video listo (SC-001)

| Paso | Componente | Tiempo típico | Tiempo p99 |
|------|-----------|--------------|------------|
| POST /jobs → respuesta HTTP | API Lambda | 100–300 ms | 500 ms |
| SQS enqueue (DownloadQueue) | SQS | 50–100 ms | 200 ms |
| Lambda cold start (DownloadWorker) | Lambda | 800 ms–2 s | 4 s |
| yt-dlp download (video 30s) | Lambda + red | 5–15 s | 30 s |
| S3 upload (video 30s ~20MB) | S3 | 2–5 s | 10 s |
| DynamoDB update (ready) + WS notify | DDB + APIGW | 50–100 ms | 300 ms |
| **Total (cold start incluido)** | | **~10–25 s** | **~45 s** |
| **Total (warm Lambda)** | | **~8–20 s** | **~35 s** |

### Flujo trim: Video listo → Trim listo (SC-002)

| Paso | Componente | Tiempo típico | Tiempo p99 |
|------|-----------|--------------|------------|
| POST /jobs/{id}/trim → respuesta HTTP | API Lambda | 100–200 ms | 400 ms |
| SQS enqueue (TrimQueue) | SQS | 50 ms | 150 ms |
| S3 download (video ~20MB) | Lambda + S3 | 2–5 s | 10 s |
| ffmpeg trim (stream copy) | Lambda | 200 ms–2 s | 5 s |
| S3 upload trimmed | S3 | 1–3 s | 7 s |
| DynamoDB update (trimmed) + WS notify | DDB + APIGW | 50 ms | 200 ms |
| **Total (warm Lambda)** | | **~4–10 s** | **~22 s** |

### Latencia de API (SC-003: 500 req/s)

| Métrica | SLO objetivo | Medición esperada |
|---------|-------------|------------------|
| p50 latencia POST /jobs | — | 80–150 ms |
| p95 latencia POST /jobs | < 800 ms | 200–400 ms |
| p99 latencia POST /jobs | — | 400–700 ms |
| Tasa de error | < 1% | < 0.1% (con cache hits) |

### Cache hit ratio (SC-004: TTL accuracy)

Los artefactos tienen TTLs configurados en DynamoDB (atributo `expiresAt`) y en S3 (lifecycle rules). El sistema actúa como cache dual:

| Tipo de artefacto | TTL DynamoDB | S3 Lifecycle |
|-------------------|-------------|-------------|
| mp4/original | 2 días (172800s) | 2 días |
| mp4/trim | 1 día (86400s) | 1 día |
| gif/gif | 1 día (86400s) | 1 día |
| mp3/original | 2 días (172800s) | 2 días |
| mp3/trim | 1 día (86400s) | 1 día |

> **Nota sobre desfase**: DynamoDB TTL elimina items con un delay de hasta 48h tras el expiresAt. El sistema usa `objectExists()` para validar que el objeto S3 aún existe antes de devolver un cache hit, garantizando que nunca se retorne una URL presignada para un objeto ya eliminado.

### Cómo validar timing en SST Dev

```bash
# 1. Lanzar un job y observar tiempo hasta status=ready
API_URL="https://abc123.execute-api.us-east-1.amazonaws.com"
START=$(date +%s%N)

RESP=$(curl -s -X POST "$API_URL/v1/jobs" \
  -H "Content-Type: application/json" \
  -d '{"tiktokUrl": "https://www.tiktok.com/@user/video/7123456789"}')

JOB_ID=$(echo $RESP | jq -r '.job.jobId')
echo "Job created: $JOB_ID"

# 2. Polling hasta ready (max 60s)
for i in $(seq 1 30); do
  STATUS=$(curl -s "$API_URL/v1/jobs/$JOB_ID" | jq -r '.job.status')
  echo "$(date): status=$STATUS"
  if [[ "$STATUS" == "ready" || "$STATUS" == "error" ]]; then
    END=$(date +%s%N)
    echo "Total time: $(( (END - START) / 1000000 )) ms"
    break
  fi
  sleep 2
done

# 3. O usar WebSocket para recibir notificaciones en tiempo real
wscat -c "$WS_URL" \
  --execute '{"action":"subscribe","jobId":"'"$JOB_ID"'"}'
```

---

## Notas de desarrollo

- **Lambda Layers**: Los binarios `yt-dlp` y `ffmpeg` se configuran como Lambda Layers en `sst.config.ts`. No se requiere instalarlos localmente para tests unitarios (los adapters están mockeados). Para SST Dev, las layers se despliegan automáticamente en AWS.
- **Cold starts**: En SST Dev, las Lambdas tienen cold starts normales de AWS. Para testing local de workers, considera invocarlas directamente con `aws lambda invoke`.
- **tmp Storage**: Los workers usan `/tmp` para archivos temporales. El tamaño predeterminado de Lambda es 512MB; los workers de descarga están configurados con 1GB de almacenamiento efímero en `sst.config.ts`.
- **Secrets**: Nunca commitear credenciales. Usa AWS SSM Parameter Store para secrets de producción. Los accesos a SSM se configuran en `sst.config.ts` con `ssm.StringParameter`.
