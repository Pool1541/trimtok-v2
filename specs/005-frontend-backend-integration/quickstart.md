# Quickstart: Frontend–Backend Integration

Feature `005-frontend-backend-integration` — TrimTok mock removal + real API/WS integration.

## Prerequisites

1. **Backend deployed**: The SST backend must be deployed (`sst deploy --stage dev`) or running in dev mode (`sst dev`). See `back/README.md`.
2. **Node.js 20** and **npm** installed locally.
3. A valid TikTok video URL for manual testing.

## 1 — Get API URLs

After deployment, read the output values from SST:

```bash
cat back/.sst/outputs.json
```

Look for:
- `ApiUrl` → your `NEXT_PUBLIC_API_URL` (HTTP API Gateway, e.g., `https://rxidfoa8o1.execute-api.us-east-1.amazonaws.com`)
- `WebSocketUrl` → your `NEXT_PUBLIC_WS_URL` (WS API Gateway, e.g., `wss://x532bxsc3h.execute-api.us-east-1.amazonaws.com/$default`)

## 2 — Configure Environment

```bash
cd front
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_API_URL=<ApiUrl from step 1>
NEXT_PUBLIC_WS_URL=<WebSocketUrl from step 1>
```

## 3 — Install Dependencies

```bash
cd front
npm install
```

New packages added by this feature:
- `@tanstack/react-query` v5
- `react-use-websocket` v4
- `@tanstack/react-query-devtools` (dev only)

## 4 — Run the Frontend

```bash
cd front
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 5 — Test the Full Flow

1. **Download**: Paste a TikTok URL → click "Descargar" → watch the progress spinner → confirm the preview screen loads with real video data.
2. **MP4 Download**: On the preview screen, click "Descargar MP4" → a presigned S3 URL triggers a browser download.
3. **MP3 Download**: Click "Descargar MP3" → wait for the "procesando..." state → file downloads when ready.
4. **Trim MP4**: Select a trim range → click "Descargar MP4 recortado" → wait → file downloads.
5. **Trim GIF**: Select a trim range → click "Descargar GIF" → wait → GIF downloads.

## 6 — Verify Backend Fix (`POST /v1/jobs` cache hit)

After downloading a video once, paste the **same TikTok URL** again. The response should include `jobId` even though the artifact is already cached in S3. If `jobId` is missing, the backend change in Phase A is not deployed.

```bash
curl -s -X POST $NEXT_PUBLIC_API_URL/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{"url":"<same_tiktok_url>"}' | jq .
# Expected: { "jobId": "...", "status": "ready", "downloadUrl": "..." }
```

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Spinner never resolves | WS URL missing or wrong | Check `.env.local` → `NEXT_PUBLIC_WS_URL` |
| 404 on API call | API URL missing or wrong | Check `.env.local` → `NEXT_PUBLIC_API_URL` |
| Download button does nothing | `videoUrl` is null / presigned URL expired | Re-download the video (URL TTL is 3600s) |
| "Descargar GIF/MP3" button stuck | Backend worker not running (local dev) | Run `sst dev` with all workers active |
| `jobId` missing on cache hit | Backend Phase A not deployed | Deploy backend change to `create-job.usecase.ts` |
