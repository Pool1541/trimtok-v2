<!--
SYNC IMPACT REPORT
==================
Version change  : [CONSTITUTION_VERSION] → 1.0.0 (initial ratification from blank template)
Modified        : N/A — initial creation; all principles are new
Added sections  : Core Principles (I–X), Technology Stack Constraints, Governance
Removed sections: N/A

Template propagation:
  ✅ .specify/templates/plan-template.md     — Constitution Check gates are resolved at runtime
                                               by the speckit.plan agent reading this file;
                                               no structural changes required.
  ✅ .specify/templates/spec-template.md     — Uses MUST language aligned with this constitution;
                                               no structural changes required.
  ✅ .specify/templates/tasks-template.md    — Generic phase structure is compatible;
                                               principle-driven task types (idempotency,
                                               validation, IaC) will be enforced at
                                               task-generation time.
  ✅ .github/prompts/*.md                    — All prompt files contain only frontmatter;
                                               no outdated references found.
  ✅ .github/agents/*.md                     — Agent files contain only frontmatter;
                                               no outdated references found.

Deferred items : None — all fields resolved.
-->

# Trimtok Constitution

## Core Principles

### I. Serverless-First Architecture

All backend compute MUST run as AWS Lambda functions. API Gateway MUST be the sole entry point
for all synchronous client-facing requests. DynamoDB MUST be the only persistent data store;
no relational databases, caches-as-primary-stores, or file system state are permitted.
Asynchronous workloads MUST be routed through SQS. Architecture decisions MUST prioritize
scalability, operational simplicity, and cost-efficiency over convenience of local state.

**Rationale**: Serverless eliminates capacity planning, scales to zero, and enforces stateless
design. Restricting to a single database technology reduces operational surface area.

### II. Frontend Isolation

The frontend MUST be a statically exported Next.js application. It MUST NOT contain business
logic, data transformation rules, or authorization decisions. It MUST NOT access AWS services,
DynamoDB, or any data store directly. All data access MUST go through versioned API Gateway
endpoints. The frontend is a rendering layer only.

**Rationale**: Coupling business logic to the frontend creates untestable, duplicated rules that
diverge over time. API-only consumption guarantees a single authoritative source of truth.

### III. Modular Clean Architecture

Backend code MUST be organized into feature modules. Each module MUST contain exactly three
layers: `domain` (entities and business rules), `application` (use cases and orchestration),
and `infrastructure` (AWS adapters, DynamoDB access, SQS clients). Business logic MUST reside
exclusively in `domain` and `application` layers. `infrastructure` MUST NOT leak into `domain`
or `application`—dependencies point inward only. Cross-module calls MUST go through
well-defined application interfaces, never directly into another module's infrastructure layer.

**Rationale**: Isolation of business logic makes it independently testable and replaceable.
Inward-pointing dependencies prevent accidental coupling to infrastructure details.

### IV. Dependency Abstraction

All external dependencies (DynamoDB, SQS, S3, Cognito, third-party APIs) MUST be accessed
through repository or adapter interfaces defined in the `application` layer. Concrete
implementations MUST live in `infrastructure`. Lambda handlers MUST NOT instantiate AWS SDK
clients directly; they MUST receive injected adapters. No AWS SDK import is permitted inside
`domain` or `application` source files.

**Rationale**: Abstraction makes unit-testing use cases possible without live AWS infrastructure
and allows swapping implementations without touching business rules.

### V. API Design Discipline

Every API endpoint MUST be synchronous, schema-validated on input and output, and return
consistent error envelopes. Request schemas MUST be validated at the API Gateway or Lambda
entry point before any business logic executes. All endpoints MUST be versioned under a path
prefix (e.g., `/v1/`). Breaking changes MUST increment the version; non-breaking additions
MUST NOT require a version bump. Undocumented or ad-hoc endpoints are MUST NOT be deployed
to production.

**Rationale**: Strict contracts prevent silent regressions, enable client code generation, and
reduce debugging time caused by malformed payloads reaching business logic.

### VI. Asynchronous Processing and Idempotency

SQS MUST be used exclusively for decoupling asynchronous jobs (e.g., video transcoding,
notification dispatch). SQS MUST NOT be used as a substitute for synchronous API calls.
Every SQS consumer (Lambda) MUST be idempotent: processing the same message N times MUST
produce the same observable result as processing it once. Idempotency MUST be enforced through
a deduplication key persisted in DynamoDB before side effects are applied. Distributed locking
MAY be used to coordinate concurrent executions but MUST NOT be the sole guarantee of
idempotency; the DynamoDB deduplication record is authoritative. Consumers MUST handle
partial failures without data corruption.

**Rationale**: SQS provides at-least-once delivery. Without idempotency, duplicate messages
cause data corruption or duplicate side effects that are hard to reverse in production.

### VII. Data Modeling for Access Patterns

DynamoDB schema design MUST be driven by access patterns before any table or index is defined.
No table MUST be designed without a documented access-pattern list. Single-table design SHOULD
be preferred where access patterns permit. Full table scans are MUST NOT be used in production
code paths. Every query MUST use a partition key; filter expressions MUST NOT be the primary
filtering mechanism. GSIs MUST be created only when a new access pattern cannot be served by
the existing key schema.

**Rationale**: DynamoDB performance and cost are entirely determined by key design. Pattern-first
modeling prevents expensive retrofits after launch.

### VIII. Testing Discipline

Tests MUST cover all critical business flows: use cases in the `application` layer and entity
invariants in the `domain` layer. Unit tests MUST NOT depend on AWS infrastructure and MUST
use injected mock/stub adapters. Integration tests for infrastructure adapters MUST run against
local emulators (e.g., DynamoDB Local) or ephemeral cloud environments, never against shared
production or staging resources. Test coverage of `domain` and `application` layers MUST NOT
fall below 80%. End-to-end tests are optional but, if present, MUST NOT be required to pass
for a local development build.

**Rationale**: Testing business flows at the use-case layer provides high confidence with fast
execution. Infrastructure integration tests validate adapters without coupling logic to AWS.

### IX. Security by Default

Every Lambda handler MUST validate and sanitize all inputs before processing, regardless of
the event source. Authentication MUST be enforced on every API Gateway route that exposes
user data or mutations; unauthenticated access MUST be explicitly declared and reviewed.
Authorization checks (ownership, role) MUST be performed inside the `application` layer, not
delegated solely to infrastructure. Secrets MUST be stored in AWS Secrets Manager or SSM
Parameter Store and MUST NOT be embedded in source code, environment variable literals in
SST configuration files, or Lambda environment variables defined in plaintext. Dependency
packages MUST be audited for known vulnerabilities before each production release.

**Rationale**: Security failures in serverless platforms are almost always logic failures—
invalid input, missing auth checks, or hardcoded secrets—not network failures. Enforcing
validation and auth at the code level is non-negotiable.

### X. Infrastructure as Code

All AWS infrastructure MUST be defined using SST (Ion). Manual changes to production
environments using the AWS Console, CLI, or SDK are MUST NOT be performed; any manual change
constitutes a constitutional violation and MUST be reverted by redeploying from the SST
definition. All environment-specific configuration MUST be expressed in SST config files
committed to the repository. Ephemeral stacks for feature branches are encouraged and MUST be
destroyed after merging. Infrastructure changes MUST be reviewed in pull requests alongside
application code changes.

**Rationale**: Manual infrastructure changes create configuration drift that is invisible to
the team and untraceable in version history. IaC enforcement makes every state transition
auditable and reproducible.

## Technology Stack Constraints

The following technology choices are mandated and MUST NOT be substituted without a
constitutional amendment:

| Concern                  | Mandated Technology                          |
|--------------------------|----------------------------------------------|
| Compute                  | AWS Lambda                                   |
| API layer                | AWS API Gateway (HTTP API)                   |
| Async messaging          | AWS SQS (standard queues)                    |
| Database                 | AWS DynamoDB (single-region, on-demand)      |
| Frontend framework       | Next.js (static export mode)                 |
| IaC / deployment         | SST (Ion)                                    |
| Auth (identity)          | AWS Cognito (or equivalent JWT issuer via PR)|
| Secrets management       | AWS Secrets Manager / SSM Parameter Store    |

Any technology not listed above that is introduced into the production stack MUST be
documented in a Technology Decision Record (TDR) and referenced in the relevant spec.

## Governance

This constitution supersedes all other project conventions, style guides, and ad-hoc decisions.
In the event of a conflict, this document is authoritative.

**Amendment procedure**:
1. Open a pull request modifying `.specify/memory/constitution.md`.
2. State the version bump type (MAJOR / MINOR / PATCH) and rationale.
3. Obtain approval from at least one other project maintainer.
4. Update `LAST_AMENDED_DATE` and `CONSTITUTION_VERSION` per semantic versioning rules.
5. Propagate changes to affected templates as described in the Sync Impact Report header.

**Version semantics**:
- MAJOR: Principle removed, renamed in a breaking way, or governance structure redesigned.
- MINOR: New principle added or existing principle materially expanded.
- PATCH: Clarifications, wording improvements, typographical corrections.

**Compliance review**: Every spec, plan, and task list generated by spec-kit agents MUST pass
a Constitution Check gate before implementation begins. The Constitution Check MUST verify
that no proposed design violates Principles I–X. Violations MUST be documented in the
Complexity Tracking table of `plan.md` with explicit justification; undocumented violations
are grounds for blocking a PR.

---

**Version**: 1.0.0 | **Ratified**: 2026-04-06 | **Last Amended**: 2026-04-06
