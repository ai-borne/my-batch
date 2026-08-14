# Ajinkyans 2002 — Gold Standard Plan

## Purpose and scope

This plan turns the current MVP into a production-ready private batch application without changing its React, Firebase, Firestore, Storage, or Cloud Functions architecture.

### Success definition

The product is ready for a controlled production launch only when all of the following are true:

- Every sensitive callable is protected by Firebase App Check and an appropriate abuse limit.
- CI runs the full build, unit, rules, Functions integration, and browser test suite on every change.
- The documented critical member and Coordinator journeys have automated coverage and pass on real mobile-device checks.
- The app is resilient for expected batch scale: paginated data views, bounded media processing, quotas, and observable failures.
- A staging smoke test, backup/isolated-restore drill, security review, and controlled pilot have recorded evidence with no unresolved high or critical finding.

## Non-negotiable working rules

Each phase is independently releasable. Do not begin a later phase if the current phase has a failed build, failed test, unresolved high/critical security finding, or an incomplete handoff.

For every code change:

1. Add or update tests before or alongside implementation.
2. Keep changes scoped to the phase and preserve the existing design tokens, resources, and file-size checks.
3. Run the phase verification commands successfully.
4. Resolve technical debt created in the phase immediately.
5. Record the phase handoff using the template at the end of this document.

## Phase GS-0 — Establish a reliable release baseline

**Objective:** make local and CI verification repeatable before security or UX work begins.

**Deliverables**

- Identify and document ownership of Firebase emulator ports; ensure a clean checkout can run all local emulator suites without manual process cleanup.
- Add a CI workflow that executes `npm run build`, `npm test`, `npm run test:architecture`, `npm run release:controls`, `npm run test:rules`, `npm run test:functions`, and `npm run test:e2e`.
- Add test coverage reporting and thresholds for the explicitly documented acceptance paths. Coverage is an evidence signal, not a substitute for journey tests.
- Replace floating `latest` dependency declarations with intentional, reviewed version ranges; retain lockfiles and add a scheduled dependency/security review.
- Document supported Node, Firebase CLI, Java, browser, and emulator versions.

**Success metrics**

- A clean CI run completes all required commands successfully on two consecutive commits.
- A clean local checkout can run the emulator suites with no port collision.
- CI blocks a deliberately introduced unit-test, rules-test, and browser-test failure.
- Production dependency audit has no known high or critical vulnerability.

**Verification**

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

## Phase GS-1 — Callable security and abuse resistance

**Objective:** ensure server-side mutation paths resist unauthorised automation and misuse.

**Deliverables**

- Apply `enforceAppCheck` to every callable that reads or mutates private batch data. Preserve emulator support explicitly and test both production and emulator configurations.
- Classify callables by risk and use the existing durable rate-limit mechanism for RSVP, payment, upload/post, comment/like/report, moderation, notification, and Coordinator operations. Set documented limits per operation rather than one global limit.
- Ensure rate-limit records are server-only and do not expose member activity to clients.
- Add server-side validation for duplicate or suspicious payment submissions, allowed state transitions, media metadata, and idempotent/retry-safe mutations where needed.
- Make audit events complete for material Coordinator, finance, and moderation actions while excluding UTRs, media bytes, credentials, and unnecessary personal information.

**Success metrics**

- 100% of callable exports use the shared App Check configuration.
- 100% of sensitive mutations are rate-limited with a documented reason and threshold.
- Rules/Functions tests demonstrate denial for missing App Check, non-members, suspended members, non-Coordinators, cross-batch callers, excessive requests, invalid state transitions, and duplicate claims.
- No high or critical finding remains in the Phase GS-1 security review.

**Verification**

```sh
npm run build
npm test
npm run test:rules
npm run test:functions
```

## Phase GS-2 — Trustworthy data, media, and performance at scale

**Objective:** prevent data growth from degrading privacy, cost, or usability.

**Deliverables**

- Add cursor pagination and bounded queries for directory members, archive posts, comments, notifications, payment claims, reports, and Coordinator lists.
- Define Firestore indexes from actual query shapes and verify them in staging with representative synthetic data.
- Add client-side image compression where appropriate and retain server-side thumbnail/preview validation as the authority.
- Finalize video limits, poster/preview generation, upload cancellation/retry, orphan cleanup, deleted-media cleanup, and retention execution.
- Define storage and Firebase cost ceilings, alerts, and an owner response procedure.
- Add structured, privacy-preserving telemetry for callable failures, upload failures, UI crashes, and performance regressions.

**Success metrics**

- No collection view loads an unbounded result set.
- Representative 4G mobile journeys load first usable content within the agreed budget (initial target: 3 seconds for non-media screens).
- Upload, retry, cancellation, cleanup, and retention paths have automated tests.
- Staging proves alerts trigger before the documented storage/cost ceiling is exceeded.

**Verification**

```sh
npm run build
npm test
npm run test:functions
npm run test:e2e
```

## Phase GS-3 — Member experience and accessibility polish

**Objective:** make the essential journeys feel clear, fast, and dependable on real phones.

**Deliverables**

- Run structured usability sessions with 8–12 representative batchmates. Prioritise sign-in/access request, profile, directory, RSVP, payment claim, memory upload, and Coordinator review.
- Replace browser prompts and ambiguous destructive actions with accessible in-app confirmation/reason forms.
- Standardize pending, success, error, retry, offline, permission-denied, and empty states across every mutation and list view.
- Complete keyboard traversal, focus restoration, semantic announcements, contrast, reduced motion, 200% zoom, and touch-target review.
- Validate PWA install/offline/sign-out cache behaviour on Android Chrome and iOS Safari.

**Success metrics**

- At least 90% of usability participants complete each critical member journey without moderator help; all failures become tracked fixes or explicit product decisions.
- All critical flows pass keyboard-only and screen-reader checks.
- Browser automation covers each critical success, failure, retry, and permission-denied path.
- No private Firebase data or authenticated response is retained by the service worker after sign-out.

**Verification**

```sh
npm run build
npm test
npm run test:e2e
```

Manual evidence: Android Chrome, iOS Safari, 200% zoom, keyboard-only navigation, screen reader, offline/reconnect, and sign-out cache inspection.

## Phase GS-4 — Staging operations and recovery proof

**Objective:** demonstrate the team can operate and recover the system safely.

**Deliverables**

- Complete every item in `AJINKYANS-PHASE-7-OPERATIONS.md` using only synthetic staging data.
- Configure Firebase App Check, structured Cloud Logging, redacted alert routing, least-privilege administrator access, ownership records, and credential rotation procedures.
- Perform an encrypted Firestore backup export and isolated restore into a separate project; compare counts and re-test access boundaries.
- Run a formal security review on the release commit and resolve all high/critical findings.
- Establish support, incident response, moderation escalation, cost, and retention owners in the private operator record.

**Success metrics**

- Alert delivery is tested and acknowledged by the named on-call owner.
- Restore completes within an agreed RTO, with document counts and critical authorization tests matching the source environment.
- Every required operational owner and backup owner is recorded and recently verified.
- No unresolved high or critical security finding exists.

**Verification**

```sh
npm run build
npm test
npm run test:rules
npm run test:functions
npm run test:e2e
npm run release:controls
```

## Phase GS-5 — Controlled pilot and production go/no-go

**Objective:** validate the polished product with real users before production data is introduced.

**Deliverables**

- Invite 10–15 approved pilot members to staging; do not use production financial, archive, or profile data.
- Run scripted role-based journeys for member, pending user, suspended user, Coordinator, and Super Admin.
- Triage pilot feedback by severity. Fix launch blockers under the same phase gate; record accepted non-blocking feedback.
- Produce a release record containing the tested commit, CI evidence, security review, restore evidence, device evidence, known-risk register, and launch-owner approval.
- After explicit approval only: configure production privately, deploy the tested commit, take a pre-cutover backup, and import data according to the privacy policy.

**Success metrics**

- All pilot participants complete their assigned critical journeys; 100% of launch blockers are resolved.
- All release evidence points to one immutable tested commit.
- Launch owner explicitly approves go/no-go after reviewing the risk register.

## Phase handoff template

```text
Phase: GS-?
Status: Complete / Blocked

Delivered:
- ...

Success metrics:
- Metric and measured result: ...

Technical debt identified:
- ...

Debt resolution completed immediately:
- ...

Verification:
- npm run build: pass/fail
- npm test: pass/fail
- npm run test:architecture: pass/fail
- npm run release:controls: pass/fail
- npm run test:rules: pass/fail
- npm run test:functions: pass/fail
- npm run test:e2e: pass/fail
- Manual/staging evidence: ...

Security review:
- Findings:
- Resolution:

Next phase eligibility:
- Approved / blocked, with reason
```
