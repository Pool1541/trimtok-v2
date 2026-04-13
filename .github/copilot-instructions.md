# getting-started Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-13

## Active Technologies
- TypeScript 5.x + Next.js 16.2.3, React 19.2.4, Tailwind CSS v4, shadcn/ui latest (new-york), tw-animate-css (002-trimtok-frontend-ui)
- N/A — sin persistencia; todo en memoria (002-trimtok-frontend-ui)
- TypeScript 5.x — Node.js 20 (Lambda runtime) + Hono 4.x (HTTP API framework + Lambda adapter), AWS SDK v3, Zod (schema validation), SST 4.x (IaC), yt-dlp binary (Lambda layer), ffmpeg binary (Lambda layer) (003-trimtok-backend)
- DynamoDB (single-table, on-demand) + S3 (artifacts bucket con lifecycle rules) (003-trimtok-backend)
- TypeScript 5.x (frontend) / TypeScript 5.x Node 20 (backend) (005-frontend-backend-integration)
- DynamoDB (single-table) + S3 (artifacts). No new tables or indexes required. (005-frontend-backend-integration)

- [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION] (001-monorepo-scaffold)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

cd src; pytest; ruff check .

## Code Style

[e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]: Follow standard conventions

## Recent Changes
- 005-frontend-backend-integration: Added TypeScript 5.x (frontend) / TypeScript 5.x Node 20 (backend)
- 003-trimtok-backend: Added TypeScript 5.x — Node.js 20 (Lambda runtime) + Hono 4.x (HTTP API framework + Lambda adapter), AWS SDK v3, Zod (schema validation), SST 4.x (IaC), yt-dlp binary (Lambda layer), ffmpeg binary (Lambda layer)
- 002-trimtok-frontend-ui: Added TypeScript 5.x + Next.js 16.2.3, React 19.2.4, Tailwind CSS v4, shadcn/ui latest (new-york), tw-animate-css


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
