# Checklist: API & WebSocket Integration Requirements Quality

**Purpose**: Thorough PR-reviewer validation of spec completeness, WS/HTTP consistency, edge case coverage, and acceptance criteria quality
**Created**: 2026-04-13
**Feature**: [spec.md](../spec.md)
**Depth**: Thorough | **Audience**: Reviewer (PR) | **Focus**: Completeness · WS/HTTP Consistency · Edge Cases · Acceptance Criteria Quality

---

## Requirement Completeness

- [ ] CHK001 - Are loading/waiting state requirements defined for the UI during MP3, trim, gif operations while awaiting the WS notification? [Gap, Spec §P2/P3/P4]
- [ ] CHK002 - Is there a requirement specifying whether the frontend opens the WS connection BEFORE or AFTER receiving the `jobId` from `POST /v1/jobs`? [Gap, Spec §FR-002]
- [ ] CHK003 - Are requirements defined for what the frontend does with `thumbnailUrl` — where it is displayed, and what the fallback is if absent? [Gap, Spec §FR-005]
- [ ] CHK004 - Is the role of `getJob` in `ApiClient` specified — when is it used if WS is the sole async notification mechanism? [Gap, Spec §Key Entities — ApiClient]
- [ ] CHK005 - Is there a requirement specifying that the frontend must persist the original TikTok URL in app state (needed by FR-008 to create a new MP3 job)? [Gap, Spec §FR-008]
- [ ] CHK006 - Are requirements for concurrent operations defined — what happens if the user triggers a second download while a trim is in progress? [Gap]
- [ ] CHK007 - Is the timeout requirement of 120 seconds (FR-004) specified as applying to ALL async operations (trim, gif, mp3) or only to P1 downloads? [Gap, Spec §FR-004]
- [ ] CHK008 - Is there a requirement for whether the WS connection is reused across operations (e.g., reuse for trim after download) or a new one is opened each time? [Gap, Spec §Clarifications — "una sola conexión reutilizada"]
- [ ] CHK009 - Are error handling requirements defined specifically for trim/gif/mp3 operations (what the user sees when `status: "error"` arrives during trim)? [Gap]
- [ ] CHK010 - Is there a requirement covering what happens if a cache-hit `downloadUrl` in P1 has already expired by the time the user clicks "Descargar MP4"? [Gap, Spec §Assumptions]

---

## Requirement Clarity

- [ ] CHK011 - Is "una sola conexión reutilizada por sesión" clarified with a lifecycle definition — when is it opened, when is it closed, what session boundary triggers reuse vs reconnect? [Ambiguity, Spec §Clarifications]
- [ ] CHK012 - Is `format: "mp3"` in FR-008 unambiguous — does it mean a brand-new `POST /v1/jobs` call or a different endpoint? [Ambiguity, Spec §FR-008]
- [ ] CHK013 - Is "≤ 6 segundos" in P4 specified as a frontend-enforced UI constraint (disable button if segment > 6s) or a backend error response? [Ambiguity, Spec §P4]
- [ ] CHK014 - Are the units of `trimStart` / `trimEnd` defined (seconds, milliseconds, HH:MM:SS)? [Ambiguity, Spec §FR-009]
- [ ] CHK015 - Is "navegar a la pantalla de previsualización" in P1 scenario 3 defined in terms of mechanism (route change, state update, component swap)? [Ambiguity, Spec §P1 scenario 3]
- [ ] CHK016 - Is "`status: 'ready'`" for the MP3 notification (FR-008) confirmed as the same terminal status value used for video downloads, or a different one? [Ambiguity, Spec §FR-008]
- [ ] CHK017 - Is "message legible al usuario" in FR-011 specified with language, tone, or display location requirements? [Ambiguity, Spec §FR-011]
- [ ] CHK018 - Is the `NEXT_PUBLIC_WS_URL` format specified (full URL including stage path, e.g. `wss://…/$default`, vs base URL only)? [Ambiguity, Spec §FR-001]

---

## Requirement Consistency (WS / HTTP)

- [ ] CHK019 - Are P3 acceptance scenarios (trim out-of-cache) and P4 acceptance scenarios consistently written using WS notification language, aligned with FR-003? [Conflict, Spec §P3 scenario 2 / P4 scenario 1]
- [ ] CHK020 - Does FR-009 use consistent language ("notificación WebSocket") across all three operations (trim MP4, trim MP3, gif), or does wording vary per operation? [Consistency, Spec §FR-009]
- [ ] CHK021 - P4 scenario 1 says "cuando el backend responde con `downloadUrl` listo" — does this align with the WS-only notification model defined in FR-003? [Conflict, Spec §P4 scenario 1]
- [ ] CHK022 - Does the MP3 flow in FR-008 (new job creation) require a second `{ action: "subscribe", jobId }` WS message; is this requirement stated? [Consistency, Spec §FR-002 / FR-008]
- [ ] CHK023 - Does FR-006 ("extender AppState para incluir `jobId`") cover all states that need it — including any intermediate states for mp3/gif operations? [Consistency, Spec §FR-006]
- [ ] CHK024 - Is there consistency between FR-012 (WS closes on unmount) and the edge case where a user navigates away mid-operation — is the in-progress operation abandoned or silently continued? [Conflict, Spec §FR-012 / Edge Cases]
- [ ] CHK025 - Are P2 scenario 2 and FR-008 consistent in that both describe an async MP3 flow awaiting WS — or does one imply a synchronous response? [Consistency, Spec §P2 scenario 2 / FR-008]

---

## Acceptance Criteria Quality

- [ ] CHK026 - Can SC-001 ("menos de 60 segundos") be objectively measured — is there a defined start event (URL submitted) and end event (video plays in preview) specified? [Measurability, Spec §SC-001]
- [ ] CHK027 - Can SC-002 ("cero `console.log` como handlers") be objectively verified via static code review, or does it require runtime observation? [Measurability, Spec §SC-002]
- [ ] CHK028 - Does P1 scenario 1 describe an observable user outcome, or does it describe internal implementation steps (opening WS, POST call)? [Acceptance Criteria Quality, Spec §P1 scenario 1]
- [ ] CHK029 - Are acceptance scenarios for P2/P3/P4 written with observable outcomes (file download starts) rather than internal mechanism references (WS receives message)? [Acceptance Criteria Quality, Spec §P2–P4]
- [ ] CHK030 - Is SC-005 ("conexión WS se cierra correctamente") measurable from a PR reviewer perspective — how would a reviewer verify this criterion? [Measurability, Spec §SC-005]

---

## Scenario Coverage

- [ ] CHK031 - Are requirements defined for what happens when a WS subscription acknowledgment is not received from the backend (connection opens but no `$connect` confirmation)? [Coverage, Gap]
- [ ] CHK032 - Is there a requirement or scenario covering what happens if `downloadUrl` is absent from an otherwise valid `status: "ready"` WS message? [Coverage, Gap]
- [ ] CHK033 - Is the scenario "user refreshes the browser mid-operation" explicitly declared in-scope or out-of-scope? [Coverage, Gap]
- [ ] CHK034 - Are error scenarios defined for operations in `TrimScreen` beyond the trim flow — e.g., what happens if `POST /v1/jobs/:jobId/gif` returns a 4xx/5xx? [Coverage, Gap]
- [ ] CHK035 - Is the scenario "user re-trims the same video with different points after a successful trim" defined — is it allowed, and does it create a new job or update the existing one? [Coverage, Spec §P3]
- [ ] CHK036 - Is there a requirement for what happens if the WS message arrives while the component that subscribed has already unmounted (race condition between navigate and WS delivery)? [Coverage, Gap]

---

## Edge Case Coverage

- [ ] CHK037 - Are edge cases for invalid input defined for operations beyond the initial download — e.g., trim with `trimStart >= trimEnd` or `trimEnd > duration`? [Edge Case, Gap]
- [ ] CHK038 - Is there a defined behavior for receiving a WS notification for a `jobId` that does not match the currently active job in app state (stale message)? [Edge Case, Gap]
- [ ] CHK039 - Is the case where `POST /v1/jobs` itself fails (network error, not backend 4xx) covered in requirements, distinct from a backend error response? [Edge Case, Spec §FR-011]

---

## Non-Functional Requirements

- [ ] CHK040 - Are accessibility requirements specified for waiting/loading states — e.g., ARIA live regions or screen reader announcements when a WS notification arrives? [Coverage, Gap]
- [ ] CHK041 - Are there requirements for WebSocket behavior on mobile browsers or background-tab scenarios where connections may be throttled or dropped? [Coverage, Gap]
- [ ] CHK042 - Are error message language/locale requirements defined (e.g., "all messages in Spanish matching app UI language")? [Gap, Spec §FR-011]
