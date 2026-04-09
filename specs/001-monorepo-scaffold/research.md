# Research: TrimTok Monorepo Scaffold

**Phase**: 0 — Pre-design research  
**Branch**: `001-monorepo-scaffold`  
**Date**: 2026-04-08  
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## Finding 1: Next.js Version & Static Export Config

**Decision**: Next.js 16.x (latest stable line as of 2026-Q1, introducing Turbopack stable)

**Key `next.config.ts` for static export**:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
}

export default nextConfig
```

**Required packages (`front/package.json`)**:

| Package | Version |
|---------|---------|
| `next` | `^16.0.0` |
| `react` | `^19.0.0` |
| `react-dom` | `^19.0.0` |
| `@types/react` | `^19.0.0` |
| `@types/react-dom` | `^19.0.0` |
| `@types/node` | `^24.0.0` |
| `typescript` | `^5.0.0` |

**App Router scaffold** (minimal blank app — no Pages Router):

```
front/src/app/
├── layout.tsx   ← root layout (html + body)
└── page.tsx     ← default index page
```

**Alternatives considered**:  
- Next.js 15.x — stable and production-ready, but 16 is the active stable line in 2026; no reason to pin older.  
- Pages Router — rejected per YAGNI; App Router is the current default and required long-term.

---

## Finding 2: SST Ion Version & Minimal Config

**Decision**: SST v4.x (Ion, latest stable as of 2026-Q1; v3 is superseded)

**Minimal `back/sst.config.ts`**:

```typescript
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'trimtok-back',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      home: 'aws',
    }
  },
  async run() {
    const api = new sst.aws.ApiGatewayV2('Api', {
      routes: {
        'GET /health': {
          handler: 'src/health.handler',
        },
      },
    })

    return {
      ApiUrl: api.url,
    }
  },
})
```

**Files generated / expected at scaffold**:

| File | Purpose |
|------|---------|
| `back/sst.config.ts` | Main SST Ion configuration |
| `back/src/health.ts` | Health-check Lambda handler |
| `back/tsconfig.json` | TypeScript configuration |
| `back/package.json` | Per-project dependencies |
| `back/.sst/` | SST Ion runtime artifacts (gitignored) |

**Health-check Lambda handler** (`back/src/health.ts`):

```typescript
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda'

export const handler: APIGatewayProxyHandlerV2 = async () => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'ok' }),
  }
}
```

**Required packages (`back/package.json`)**:

| Package | Type | Version |
|---------|------|---------|
| `sst` | devDependency | `^4.0.0` |
| `aws-cdk-lib` | devDependency | (peer — installed by sst) |
| `@types/aws-lambda` | devDependency | `^8.10.0` |
| `typescript` | devDependency | `^5.0.0` |

**Alternatives considered**:  
- SST v2 (deprecated) — rejected.  
- CDK directly — lower-level, no built-in linking; constitution mandates SST.  
- Pulumi / Terraform — constitution mandates SST; not eligible.

---

## Finding 3: npm Workspaces + concurrently Scripts

**Decision**: npm workspaces with `concurrently` v9.x for parallel dev; sequential `&&` for build.

**Root `package.json` workspaces field**:

```json
"workspaces": ["front", "back"]
```

**Root `dev` script** (labeled concurrent output):

```json
"dev": "concurrently -n front,back -c cyan,yellow \"npm run dev --workspace=front\" \"npm run dev --workspace=back\""
```

**Root `build` script** (sequential for deterministic CI output):

```json
"build": "npm run build --workspace=front && npm run build --workspace=back"
```

**Root `install` pattern**: plain `npm install` from root installs all workspace members automatically.

**concurrently version**: `^9.0.0`

**Alternatives considered**:  
- Turborepo — overkill for two projects; adds complexity without benefit at this scale. Deferred per YAGNI.  
- `npm run --workspaces dev` — does not support labeled prefixes on dev servers; UX is inferior.  
- `yarn workspaces` / `pnpm` — constitution scope and clarifications confirm npm workspaces; not substitutable in v1.

---

## Finding 4: TypeScript `tsconfig.json` Configurations

**Decision**: Strict mode enabled in both projects. Frontend uses `moduleResolution: bundler` (Next.js default); backend uses `moduleResolution: node16` for Lambda compatibility.

**`front/tsconfig.json`** (Next.js App Router defaults + strict):

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", ".next/types/**/*.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

**`back/tsconfig.json`** (Node.js 24 + Lambda targets):

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "resolveJsonModule": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "incremental": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", ".sst"]
}
```

**Alternatives considered**:  
- Non-strict TypeScript — explicitly rejected by spec; strict mode is mandated.  
- `"module": "CommonJS"` for back — Node.js 24 supports ESM natively; `NodeNext` enables proper ESM/CJS resolution that Lambda Node.js 24 runtime supports.

---

## Finding 5: Node.js 24 Pinning

**Decision**: `.nvmrc` pinned to major version `24`; `engines` field declares strict minimum.

**`.nvmrc` content**:

```
24
```

**Root `package.json` `engines` field**:

```json
"engines": {
  "node": ">=24.0.0",
  "npm": ">=10.8.0"
}
```

**Alternatives considered**:  
- `.node-version` file — less universally supported than `.nvmrc`; spec accepts either, `.nvmrc` chosen for broader tooling compatibility.  
- Exact patch pin (e.g., `24.0.0`) — too restrictive; LTS patch updates include security fixes that should be adopted automatically.

---

## Resolved Unknowns Summary

| Unknown | Resolution |
|---------|-----------|
| Next.js version | 16.x latest stable |
| Next.js router style | App Router (no Pages Router) |
| SST version | v4.x (Ion) |
| SST health-check pattern | `sst.aws.ApiGatewayV2` with `GET /health` route |
| concurrently version | 9.x |
| Root dev script | `concurrently` with `-n front,back` labels |
| Root build script | Sequential `&&` |
| Front tsconfig target | ES2020 + DOM, `moduleResolution: bundler` |
| Back tsconfig target | ES2024, `moduleResolution: NodeNext` |
| `.nvmrc` content | `24` (major only) |
| `engines.node` | `>=24.0.0` |
