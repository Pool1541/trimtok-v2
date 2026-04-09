# Developer Quickstart: TrimTok Monorepo

**Branch**: `001-monorepo-scaffold`  
**Date**: 2026-04-08

---

## Prerequisites

| Requirement | Minimum Version | Notes |
|-------------|----------------|-------|
| Node.js | 24.x LTS | Use nvm: `nvm use` from repo root |
| npm | 10.8.x | Bundled with Node.js 24 |
| AWS CLI | 2.x | Required for backend dev only |
| AWS credentials | Active profile | Required for `sst dev` (Live Lambda) |

> **Node version manager**: The repo includes a `.nvmrc` pinned to `24`. Run `nvm use` once
> after cloning to switch to the correct version automatically.

---

## First-Time Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd trimtok

# 2. Activate Node.js 24 (if using nvm)
nvm use

# 3. Install all dependencies (front + back) in one command
npm install
```

`npm install` from the root automatically installs dependencies for all npm workspace members
(`/front` and `/back`) without any per-project steps.

---

## Start Development Environment

```bash
# From the repo root — starts both projects concurrently
npm run dev
```

Terminal output will be labeled:
- `[front]` — Next.js dev server (default: http://localhost:3000)
- `[back]` — SST Live Lambda Development session

> **AWS credentials required for [back]**: `sst dev` tunnels Lambda invocations to live AWS
> infrastructure. Configure your credentials before running:
> ```bash
> aws configure
> # or
> export AWS_PROFILE=your-profile
> ```

> **Frontend only** (no AWS needed):
> ```bash
> cd front && npm run dev
> ```

> **Backend only**:
> ```bash
> cd back && npm run dev
> ```

---

## Production Build

```bash
# From the repo root — builds front then back sequentially
npm run build
```

| Project | Output Location | Format |
|---------|----------------|--------|
| `/front` | `front/out/` | Static HTML/CSS/JS export |
| `/back` | `back/.sst/` | Lambda deployment artifacts |

A non-zero exit code indicates a failure in one of the sub-projects. Check the labeled
output to identify which project failed.

---

## Per-Workspace Commands

You can target a single workspace from the root without changing directories:

```bash
# Run dev for front only
npm run dev --workspace=front

# Build back only
npm run build --workspace=back
```

---

## Deploy Backend

```bash
cd back
npm run deploy
# or for a specific stage:
npx sst deploy --stage production
```

> Deployment requires valid AWS credentials with appropriate IAM permissions for
> Lambda, API Gateway, and CloudFormation.

---

## Verify Deployment

After a successful `sst deploy`, the `ApiUrl` output will be printed. Verify the
health endpoint:

```bash
curl https://<api-gateway-id>.execute-api.<region>.amazonaws.com/health
# Expected: {"status":"ok"}
```

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `nvm: command not found` | nvm not installed | Install nvm from https://github.com/nvm-sh/nvm |
| Port 3000 already in use | Another process uses the port | Kill the process or run `next dev -p 3001` |
| `Error: AWS credentials not found` | No active AWS profile | Run `aws configure` or set `AWS_PROFILE` |
| `ENOENT: node_modules not found` | Running build/dev before install | Run `npm install` from the repo root first |
| TypeScript errors on build | Strict mode violation | Fix the TypeScript error; strict mode is non-negotiable |
