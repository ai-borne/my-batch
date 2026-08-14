# Ajinkyans 2002 — Gold-Standard Execution Plan

## Purpose and scope

This is the phase-by-phase delivery plan for the existing React, TypeScript, Firebase Authentication, Firestore, Storage, and Cloud Functions application. It implements `AJINKYANS-GOLD-STANDARD-PLAN.md`; it does not add a payment gateway, messaging, or a stack rewrite.

**Definition of ready:** a controlled production launch is allowed only when every phase has a complete handoff, evidence identifies one immutable tested commit, and no high or critical security finding remains open.

**Dependencies to confirm before GS-4:** separate staging/production Firebase projects, authorised App Check providers, alert routing, encrypted backup storage, and real iOS/Android test devices. A missing dependency blocks its phase; it must not weaken the gate.

## Universal delivery contract

Each phase is independently releasable. Do not start a later phase if the earlier handoff is incomplete, a build/test fails, required evidence is missing, phase-created debt is unresolved, or a high/critical finding is open.

For every work item:

1. Define measurable acceptance and rejection paths first.
2. Add unit, emulator/integration, and browser tests before or alongside implementation. Tests must encode the business rule and authorization reason.
3. Implement the minimum scoped change. Views render state and delegate actions; domain libraries/services own business behaviour; Rules and Functions remain the authorization authority.
4. Preserve SSOT: types, copy, design tokens, validators, configuration, and state transitions each have one authoritative owner. Client validation aids feedback but never authorizes access.
5. Inspect the diff for secrets, UTRs, personal data in logs, unsafe caching, unbounded reads, authorization bypasses, and dependency vulnerabilities.
6. Run all phase checks, immediately remove technical debt created by the phase, and record the handoff.

### Architecture, resource, and security constraints

- No source file exceeds 300 LOC. If a cohesive SRP requires an exception, a local comment must explain why splitting would reduce cohesion; otherwise split it.
- Use `src/lib/copy.ts` for visible strings and `src/styles/tokens.css` for color/design tokens. Do not introduce hard-coded color literals outside token definitions.
- Every private read/write is batch-scoped. UI role visibility is never an authorization control.
- Security-relevant validation is enforced in Functions and Rules; use App Check, least privilege, input schemas, durable rate limits, idempotency, redacted logs, and explicit retention/deletion.
- Never track credentials, real UTRs, receipts, personal-data fixtures, service-account keys, or Firebase project aliases. Keep dependencies intentionally versioned with lockfiles.

### Verification commands

```sh
npm run build
npm test
npm run test:architecture
npm run release:controls
npm run test:rules
npm run test:functions
npm run test:e2e
npm audit --omit=dev --audit-level=high
```

Rules and Functions tests require emulators; browser tests require the documented local prerequisites. A skipped required command is a failed phase. Manual/staging evidence is allowed only where this document names it explicitly.

## Roadmap

| Phase | Objective | Pass condition |
| --- | --- | --- |
| GS-0 | Repeatable release baseline | CI succeeds twice on the full suite |
| GS-1 | Callable security and abuse resistance | Authorization, state, and limit matrix is covered |
| GS-2 | Safe scale for data/media | Bounded queries, lifecycle, costs, and performance are evidenced |
| GS-3 | Accessible member experience | Critical journeys pass automation and device checks |
| GS-4 | Operational recovery proof | Staging, alert, backup/restore, and review evidence pass |
| GS-5 | Controlled pilot and go/no-go | Pilot blockers are resolved and owner approves release |

## Phase GS-0 — Reliable release baseline

**Objective:** make local and CI verification deterministic before feature or security changes.

### Work

1. Record supported Node, Firebase CLI, Java, browser/Playwright, emulator, and package-manager versions; inventory current scripts, ports, fixtures, and CI gaps.
2. Assign/document emulator ports and cleanup. A clean checkout must run Rules and Functions suites using isolated state without manual process cleanup.
3. Add protected-branch/PR CI running build, unit, architecture, release-control, Rules, Functions, and browser suites. Upload safe failure/coverage artifacts.
4. Configure coverage thresholds for source paths implementing documented critical journeys; do not treat percentage coverage as a replacement for journey tests.
5. Replace floating `latest` declarations with reviewed versions/ranges, retain lockfiles, schedule an owner-led dependency review, and resolve production high/critical audit findings.
6. Extend guardrails so deliberately oversized files, hard-coded colors, tracked secrets/project aliases, and missing release artefacts fail.

### Tests and success metrics

| Proof | Required result |
| --- | --- |
| Clean emulator integration | Two consecutive clean starts complete Rules and Functions suites without port collisions. |
| CI enforcement | Intentionally failing unit, Rules, and browser tests each fail CI. |
| Security hygiene | Production dependency audit has no high/critical finding. |
| Repeatability | Two consecutive commits pass the complete CI matrix. |

**Verification:** run every command above. Record CI run URLs/IDs, audit result, supported-version document, and local clean-start evidence.

## Phase GS-1 — Callable security and abuse resistance

**Objective:** make all private server operations authenticated, authorised, validated, limited, retry-safe, and auditable.

### Work

1. Inventory every callable: actor, batch scope, data, state transition, App Check policy, idempotency/duplicate handling, audit event, rate-limit window/key/threshold/rationale.
2. Ensure all sensitive callable exports use shared authentication, App Check, active-membership, batch-role, schema validation, and safe-error helpers. Explicitly test emulator configuration without weakening production enforcement.
3. Apply durable server-only, operation-specific limits for RSVP, payment, upload/post, comments/likes/reports, moderation, notifications, and Coordinator actions. Define user-facing retry behaviour.
4. Enforce allowed membership, RSVP, payment, media, and moderation transitions on the server. Use transactions/deterministic keys where retries could duplicate a mutation.
5. Align Firestore/Storage Rules to the permission matrix. Audit material Coordinator, finance, and moderation operations using safe metadata only—never credentials, UTRs, receipt/media bytes, or excessive PII.

### Test-first matrix

| Boundary | Required automated evidence |
| --- | --- |
| Trust | Missing App Check, unauthenticated, non-member, pending/rejected/suspended, cross-batch, and non-Coordinator callers are denied. |
| Abuse | Each limit permits its documented burst, denies the next call safely, and rate-limit records are unreadable/unwritable by clients. |
| Integrity | Invalid/replayed state changes fail; valid retries are idempotent. |
| Privacy | Rules deny cross-batch/private/audit/UTR/receipt access for every unauthorized role. |
| Audit | Authorized material action writes complete redacted audit data; denial leaks no sensitive context. |

**Exit criteria:** every callable is classified and App Check-protected; all sensitive mutations have documented limits; the complete role/state denial matrix passes.

**Verification:** `build`, `test`, `test:architecture`, `release:controls`, `test:rules`, `test:functions`, audit, and a focused security review. Resolve every high/critical finding before handoff.

## Phase GS-2 — Trustworthy data, media, and performance at scale

**Objective:** keep private data usable, bounded, and affordable as batch content grows.

### Work

1. Create a query inventory: collection, batch constraint, order, cursor, page size, end/empty state, index, and owner. Convert directory, archive, comments, notifications, payment claims, reports, and Coordinator lists to bounded cursor pagination.
2. Add only indexes required by the inventory. Seed representative synthetic staging data and validate filtering, ordering, pagination, and access boundaries.
3. Define media mime/bytes/dimensions/duration/count limits. Add client compression, preview, cancellation/retry; retain Functions as authority for validation, thumbnail/poster generation, orphan/deleted cleanup, and retention execution.
4. Define Firestore/Storage/Function cost ceilings, pre-ceiling alerts, dashboard/log query, owner, acknowledgement SLA, and mitigation. Alert payloads must be redacted.
5. Add privacy-preserving telemetry for callable/upload failures, UI crashes, and performance regressions with safe event codes/correlation IDs only.

### Test-first matrix

| Area | Required automated/staging evidence |
| --- | --- |
| Queries | Each list makes bounded batch-scoped requests, advances/ends cursors correctly, and never mixes batches. |
| Media | Invalid/oversized inputs fail; upload, cancel, retry, preview, delete, orphan cleanup, and retention are tested. |
| Scale | Synthetic staging queries return correct pages with no missing-index prompt. |
| Operations | Alert fires before its ceiling and telemetry rejects/redacts sensitive fields. |
| Mobile | Measured representative 4G non-media screen reaches first usable content in <=3 seconds using documented device/network settings. |

**Exit criteria:** no unbounded private collection view; all media lifecycle paths are server-authoritative and covered; staging validates index/cost/performance evidence.

**Verification:** `build`, `test`, `test:architecture`, `test:functions`, `test:e2e`; additionally `test:rules` if Rules change. Attach only synthetic-data, alert, and performance evidence.

## Phase GS-3 — Member experience and accessibility polish

**Objective:** deliver understandable, recoverable, accessible core journeys on actual phones.

### Work

1. Run structured sessions with 8–12 representative members for access request, profile, directory, RSVP, payment claim, memory upload, and Coordinator review. Convert each issue to a tested fix or explicit product decision.
2. Replace browser prompts and ambiguous destruction with accessible in-app confirmation/reason forms. Standardise loading, empty, pending, success, validation failure, server failure, retry, offline, and permission-denied states.
3. Complete landmarks, labels, keyboard order, focus restoration, announcements, contrast, reduced motion, 200% zoom/reflow, and touch-target checks.
4. Validate PWA installation, offline shell, reconnect/retry, interrupted upload recovery, and sign-out cache purge. The service worker must not retain private Firebase responses, media, or authenticated data after sign-out.

### Required browser/device coverage

| Journey group | Success, failure, and recovery paths |
| --- | --- |
| Access | Sign-in, request, pending, rejection/resubmission, approval, suspension, permission denied. |
| Community | Profile validation/edit, directory filtering, RSVP retry, payment reject/resubmit, aggregate finance only. |
| Archive | Upload/cancel/retry/error, comment/like/report, author delete, Coordinator moderation outcome. |
| Accessibility | Keyboard-only critical paths, restored focus, labelled controls, announcements, reduced motion, 200% zoom. |
| PWA | Offline/reconnect/install and post-sign-out cache inspection. |

**Exit criteria:** >=90% unaided completion for every critical journey; all remainder is a tested fix or recorded product decision; Android Chrome and iOS Safari, keyboard, screen-reader, and zoom checks pass.

**Verification:** `build`, `test`, `test:architecture`, `test:e2e`; include Rules/Functions checks for backend changes. Attach usability/device evidence, never participant PII.

## Phase GS-4 — Staging operations and recovery proof

**Objective:** demonstrate safe operation and recovery using synthetic staging data only.

### Work

1. Complete `AJINKYANS-PHASE-7-OPERATIONS.md` with isolated staging identities, projects, and non-production credentials. Verify no production endpoint/data is used.
2. Record primary and backup owners for Firebase, domains/DNS, billing, credentials, on-call, support, moderation, retention, cost response, incident response, and launch approval.
3. Configure production-equivalent App Check, least-privilege administration, redacted structured logging, alert routing, and credential rotation. Test alert receipt and acknowledgement.
4. Create encrypted backup, restore to a separate project, compare safe aggregate document/media counts, run critical authorization tests there, measure RTO/RPO, and clean restored data under retention rules.
5. Execute `AJINKYANS-PHASE-7-SECURITY-REVIEW.md` against the release candidate commit. Fix high/critical findings and rerun affected verification.

### Exit criteria and evidence

- Staging smoke tests cover active, pending, suspended, Coordinator, and Super Admin roles.
- Alert proof names the receiver and acknowledgement time and proves redaction.
- Restore proof includes manifest/checksum, isolated target, counts, authorization results, RTO/RPO, and cleanup.
- Every operational responsibility has a recently verified primary and backup owner; no high/critical finding remains.

**Verification:** entire command suite, staging smoke scripts, and formal security review. Store evidence references—not sensitive contents—with the candidate SHA.

## Phase GS-5 — Controlled pilot and production go/no-go

**Objective:** validate the release with approved real members before any production data is introduced.

### Work

1. Invite 10–15 approved users to staging only. Do not use production profiles, finance records, archive media, or receipts. Provide support, privacy/consent information, test roles, and feedback route.
2. Execute scripts for member, pending user, suspended user, Coordinator, and Super Admin: access, profile, RSVP, direct-UPI claim/review, archive/report/moderation, notifications, offline/retry, sign-out.
3. Triage each defect with reproduction, severity, owner, affected role, security/privacy impact, and evidence. Fix and regression-test all launch blockers within this phase; accepted non-blockers need named owner and rationale.
4. Assemble release record: tested SHA, CI, security review, restore proof, device/accessibility evidence, pilot result, risk register, rollback steps, and explicit launch-owner decision.
5. Only after recorded approval, configure production privately, deploy that exact SHA, take pre-cutover backup, run post-deploy smoke checks, and import data under the privacy policy. Any changed commit restarts relevant verification.

**Exit criteria:** all assigned pilot journeys complete; launch blockers are resolved; release record points to one immutable commit; launch owner records go/no-go. No deployment proceeds from implied approval.

**Verification:** entire automated suite plus pilot/staging evidence and release-owner approval.

## Mandatory Phase Summary

Complete this immediately after every phase and before beginning the next one.

```text
Phase: GS-?
Status: Complete / Blocked
Release candidate commit: <immutable SHA>

Delivered:
- Requirement, implementation, and test evidence

Success metrics:
- Metric / target / measured result / evidence reference

Technical debt identified:
- None, or each concrete phase-created item

Debt resolution completed immediately:
- Exact remediation and verification for every item above

Verification:
- npm run build: pass/fail (run ID/date)
- npm test: pass/fail (run ID/date)
- npm run test:architecture: pass/fail (run ID/date)
- npm run release:controls: pass/fail (run ID/date)
- npm run test:rules: pass/fail (run ID/date)
- npm run test:functions: pass/fail (run ID/date)
- npm run test:e2e: pass/fail (run ID/date)
- npm audit --omit=dev --audit-level=high: pass/fail (run ID/date)
- Required manual/staging/device evidence: reference and result

Security review:
- Scope and findings:
- Resolution and regression tests:

Next phase eligibility:
- Approved / blocked
- Reason and exact unblock condition:
```

`Complete` means all relevant automated checks passed, manual/staging evidence exists, phase-created debt is fully resolved, and security findings meet the gate. Otherwise record `Blocked` and do not start later-phase work.
