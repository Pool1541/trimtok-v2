# Feature Specification: TrimTok Monorepo Scaffolding

**Feature Branch**: `001-monorepo-scaffold`  
**Created**: 2026-04-07  
**Status**: Draft  
**Input**: User description: "Build the scaffolding for TrimTok; this should be a monorepo with /back and /front folders. Should be able to compile and start both projects from a centralized package.json file."

## Clarifications

### Session 2026-04-07

- Q: How should the root `dev` script run `/front` and `/back` concurrently? → A: `concurrently` npm package
- Q: Should source files use TypeScript or JavaScript? → A: TypeScript (strict mode) in both `/front` and `/back`
- Q: What minimum Node.js version must the repository require? → A: Node.js v24 LTS
- Q: How should the backend run during local development? → A: `sst dev` (SST Live Lambda Development — requires valid AWS credentials)
- Q: Should the monorepo include a `/packages` folder for shared modules now? → A: No — only `/front` and `/back`; no `/packages` in this scope (YAGNI)

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Start Full Dev Environment from Root (Priority: P1)

A developer clones the TrimTok repository, installs dependencies once from the root, and starts
both the frontend and backend in development mode with a single command from the root directory.
Both projects become available without any extra terminal sessions or manual per-project setup.

**Why this priority**: This is the baseline developer experience. Until a developer can start the
full project from one place, no other team member can contribute or verify changes end-to-end.
It is the definition of "monorepo working correctly."

**Independent Test**: Run the install and start commands from the root on a freshly cloned
repository. The frontend dev server and backend development endpoint MUST both respond within
60 seconds without any additional manual steps.

**Acceptance Scenarios**:

1. **Given** a freshly cloned repository with no prior installs, **When** the developer runs
   the root install command, **Then** all dependencies for `/front` and `/back` are installed
   without errors.
2. **Given** all dependencies are installed, **When** the developer runs the root dev-start
   command, **Then** the frontend dev server starts and is accessible in a browser and the
   backend development endpoint is reachable.
3. **Given** the dev environment is running, **When** the developer modifies a file in `/front`
   or `/back`, **Then** the corresponding project hot-reloads without a full restart.

---

### User Story 2 - Build Both Projects for Production from Root (Priority: P2)

A developer or CI pipeline triggers a production build of the entire platform from the root
directory using a single command. Both the frontend static bundle and the backend deployable
artifact are produced in their respective output directories.

**Why this priority**: Once development is verified (P1), the next critical milestone is a
clean production build. This gates all deployment and QA workflows.

**Independent Test**: Run the root build command on a clean working tree. Both `/front` and
`/back` MUST produce output artifacts without errors. The frontend output MUST be a fully
self-contained static export (no server-side rendering runtime required).

**Acceptance Scenarios**:

1. **Given** all dependencies are installed, **When** the developer runs the root build
   command, **Then** `/front` produces a static export bundle and `/back` produces the Lambda
   deployment artifacts, both without errors.
2. **Given** a build has completed, **When** a developer inspects the output directories,
   **Then** they find all expected output files present and no source files mixed in.
3. **Given** a broken change exists in `/front`, **When** the root build command runs,
   **Then** the build fails with a clear error pointing to the `/front` project, and does not
   silently succeed.

---

### User Story 3 - Work on Each Project Independently (Priority: P3)

A developer works exclusively on the frontend or the backend without starting the other project.
Each sub-project can be installed, started, and built in isolation using per-project commands from
within its own directory.

**Why this priority**: Team members often own one sub-project. Forcing every developer to run
the entire stack wastes resources and slows iteration. Per-project isolation is a quality-of-life
requirement, not a blocker.

**Independent Test**: Navigate into `/front` or `/back` and run the local install and dev-start
commands. The targeted project MUST start successfully without any dependency on the sibling
project being installed or running.

**Acceptance Scenarios**:

1. **Given** only `/front` dependencies are installed, **When** a developer runs the frontend
   dev command from within `/front`, **Then** the frontend dev server starts without errors.
2. **Given** only `/back` dependencies are installed, **When** a developer runs the backend
   dev command from within `/back`, **Then** the backend development server starts without errors.
3. **Given** a developer is in the root directory, **When** they run a project-scoped command
   (e.g., `--workspace=front`), **Then** only the targeted project actions execute.

---

### Edge Cases

- What happens when one project's install fails but the other succeeds? Each project MUST
  report its own failure clearly and the root command MUST exit with a non-zero code.
- What happens when a port required by `/front` or `/back` is already in use? Each project
  MUST fail fast with a clear error message indicating the port conflict.
- What happens when a developer runs the build before running install? The command MUST fail
  with an actionable error (missing dependencies), not a cryptic module resolution error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST contain a `/front` folder for the frontend project and a
  `/back` folder for the backend project at the repository root.
- **FR-002**: The repository root MUST contain a `package.json` that declares both `/front`
  and `/back` as workspace members.
- **FR-003**: The root `package.json` MUST expose a single `dev` script that starts both
  `/front` and `/back` development servers concurrently using the `concurrently` npm package.
  Each project's output MUST be prefixed with its project name in the terminal.
- **FR-004**: The root `package.json` MUST expose a single `build` script that builds both
  `/front` and `/back` for production.
- **FR-005**: The `/front` project MUST be configured as a Next.js application with static
  export enabled and TypeScript support (`tsconfig.json` in strict mode).
- **FR-006**: The `/back` project MUST be configured with SST (Ion) as the infrastructure and
  deployment framework targeting AWS Lambda, with TypeScript (`tsconfig.json` in strict mode)
  as the source language for all Lambda handler code. The `/back` `dev` script MUST invoke
  `sst dev`, which uses SST Live Lambda Development to tunnel invocations to real AWS
  infrastructure; valid AWS credentials are required in the developer environment.
- **FR-007**: Each project (`/front`, `/back`) MUST have its own `package.json` with scripts
  for `dev` and `build` so they remain independently runnable.
- **FR-008**: A single root install command MUST install dependencies for all workspace
  members without requiring per-project manual installation.
- **FR-009**: The root `package.json` MUST NOT contain business logic, routing rules, or
  application configuration — only workspace orchestration scripts.
- **FR-010**: The repository MUST include a root-level `.gitignore` that excludes `node_modules`,
  build outputs, and environment files for both sub-projects.
- **FR-011**: The root `package.json` MUST declare `"engines": { "node": ">=24" }` to enforce
  the minimum Node.js v24 LTS runtime requirement. The repository MUST include a `.nvmrc` or
  `.node-version` file pinned to `24` at the repository root.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer with the correct runtime prerequisites can go from `git clone` to
  both dev servers running using exactly two root commands (install + dev) in under 3 minutes
  on a standard developer machine.
- **SC-002**: The root build command completes without errors and produces deployable artifacts
  for both `/front` and `/back` in a single run.
- **SC-003**: Each sub-project starts independently within its own directory without any
  dependency on the sibling project being installed or running.
- **SC-004**: Every root script exits with a non-zero code and a human-readable error message
  when any sub-project fails, ensuring CI pipelines detect failures reliably.

## Assumptions

- The target developers have Node.js v24 LTS installed prior to cloning; no runtime
  installation is in scope for this feature. The repository enforces this minimum via the
  `engines` field in the root `package.json`.
- Both `/front` and `/back` use TypeScript with strict mode enabled; no plain JavaScript
  source files are permitted in either project.
- The workspace orchestration uses npm workspaces; switching to an alternative package manager
  workspace implementation is out of scope for v1.
- The `/back` development mode uses `sst dev` (SST Live Lambda Development), which requires
  valid AWS credentials in the developer environment. There is no local-only emulation mode;
  developers MUST have an AWS account and properly configured credentials to run the backend.
- The `/front` Next.js application starts as a blank scaffold (no pages beyond a default
  index); full page implementation is out of scope.
- The `/back` SST project starts as a blank scaffold with a single health-check Lambda
  function wired to API Gateway; business logic implementation is out of scope.
- The repository structure is intentionally minimal: only `/front` and `/back` are in scope.
  A `/packages` directory for shared modules MUST NOT be created as part of this feature;
  shared module support is deferred to a future feature if needed.
