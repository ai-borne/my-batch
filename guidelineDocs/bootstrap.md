# Super Admin Coordinator Bootstrap — Execution Plan

## Summary

Create [SUPER-ADMIN-BOOTSTRAP-EXECUTION-PLAN.md](/Users/sunil/Downloads/my-batch/guidelineDocs/SUPER-ADMIN-BOOTSTRAP-EXECUTION-PLAN.md) during implementation.

The feature resolves the zero-Coordinator deadlock without turning Super Admin into a routine membership reviewer:

- Only when a batch has **zero active Coordinators**, Super Admin can view pending applicants.
- Super Admin can select one pending applicant and perform **Approve + appoint Coordinator** in one atomic, audited action.
- Once one active Coordinator exists, this bootstrap interface and server capability become unavailable.
- Coordinators then handle the shared pending queue through the existing Coordinator workspace.

## Phase 1 — Secure server-side bootstrap workflow

Success criteria: the backend can safely create the first Coordinator from one pending request, and no other role can invoke or bypass it.

- Write callable integration tests first for:
  - Super Admin successfully bootstrapping one pending applicant into an active Coordinator.
  - Creation of membership, profile, member-code record, access-request approval, and immutable audit event in one transaction.
  - Required business reason, recent authentication, App Check enforcement outside emulators, rate limiting, malformed input, duplicate roll number, and Super Admin self-target denial.
  - Denial for non-Super Admin callers.
  - Denial when any active Coordinator already exists.
  - Concurrent bootstrap attempts yielding exactly one success, one `failed-precondition` result, one Coordinator, and one audit event.
  - An idempotent retry with the same operation ID returning the original successful result after an uncertain client/network failure.
  - Stable pagination with identical timestamps, malformed cursor rejection, and no duplicate candidates across pages.
  - Existing active-member appointment behavior during zero-Coordinator recovery, documenting that it remains available for already-active members.

- Add two narrow Super Admin callables:
  - `listBootstrapCandidates`: returns a bounded, cursor-paginated list of pending applicants only when no active Coordinator exists. It returns only request-derived selection fields: name, roll number, and house.
  - `bootstrapCoordinator`: receives a pending request ID, required business reason, and idempotency-safe operation ID; atomically approves that request and assigns its user the Coordinator role.

- Enforce the zero-Coordinator condition *inside* the `bootstrapCoordinator` Firestore transaction by querying active Coordinator memberships with `limit(1)`. If the query returns a record, fail with `failed-precondition`; do not rely on an earlier check or UI state.

- Reuse the existing membership-approval validation and document-writing logic through a transaction-only shared server helper. The helper validates the pending request and roll-number uniqueness and writes the membership, profile, member-code, and access-request records. It accepts explicit role, actor, and audit metadata so ordinary approval remains `batchmate`/`membership.approved` while bootstrap creates a Coordinator/`membership.bootstrapCoordinatorApproved` event. Authorization, recent-authentication, App Check, rate limiting, idempotency, and the zero-Coordinator guard remain in the public callables.

- Define the exact query shapes before implementation. Candidate pages use `status == pending`, ordered by `createdAt` then document ID, and cursors carry and validate both values. The active-Coordinator guard uses `status == active` and `role == coordinator` with `limit(1)`. Add and deploy every required composite index; do not introduce a mutable coordinator-count document because membership records remain the source of truth. Define how legacy pending records without `createdAt` are handled rather than silently producing unstable pages.

- Record a retention-bound governance audit event named `membership.bootstrapCoordinatorApproved`, containing only actor UID, target UID, batch ID, outcome, role transition, timestamp, business reason, and `retentionUntil`. Use the same centralized audit-retention policy as other governance events; the retention job must delete by `retentionUntil` and continue processing until no eligible records remain.

- Add an operation-specific, high-impact rate-limit policy for bootstrap assignment.

- Persist the completed bootstrap outcome against the authenticated actor, batch, and operation ID so a retry returns the original result instead of a stale-state failure after a successful but unacknowledged commit.

- Export new callables from the Functions entry point and update callable-security inventory tests.

Phase handoff: run Functions integration tests, all unit tests, build, TypeScript checks, and `git diff --check`. Resolve all introduced debt before proceeding.

## Phase 2 — Super Admin bootstrap interface

Success criteria: Super Admin can securely choose one pending applicant only during zero-Coordinator recovery; normal Super Admin behavior remains unchanged afterward.

- Add a dedicated “Coordinator bootstrap” panel above the active-member directory.
- Load it independently from the active-member directory:
  - Hide the panel entirely once an active Coordinator exists.
  - Show a clear empty state if there are no pending applicants.
  - Show pending applicants in bounded pages with “Load more.”
  - Display only selection-relevant information supplied in the request: name, roll number, and house. Do not expose email. If email becomes a confirmed business requirement, add an explicit trusted-server read from `/users/{uid}`, document the privacy rationale, and return no other user fields.

- Add an accessible confirmation dialog:
  - Action: “Approve and appoint Coordinator.”
  - Required business reason.
  - Existing reauthentication flow before submission.
  - Clear success, permission-denied, retry, and stale-state messages.
  - A single-flight submission button. A `failed-precondition` response reloads candidates and hides the panel if another actor has already created a Coordinator; duplicate-roll conflicts remain actionable.

- After a successful bootstrap:
  - Refresh the bootstrap panel, active-member directory, and audit log.
  - The new Coordinator appears in the active directory.
  - The bootstrap panel disappears because the zero-Coordinator condition no longer holds.

- Keep all user-facing text in the existing `COPY` resource and use existing components/styles. No hardcoded colors or parallel design system.

- Add React tests for panel visibility, empty/loading/error states, stable pagination, required reason, confirmation, reauthentication, single-flight submission, successful refresh, duplicate-roll conflicts, stale-state recovery, and hidden state after a Coordinator exists.

Phase handoff: run the complete frontend test suite and production build. Confirm no file exceeds 300 LOC; split by responsibility where needed.

## Phase 3 — Authorization, security, and regression verification

Success criteria: the new path cannot expose pending applicants or weaken existing Coordinator/member boundaries.

- Extend emulator integration coverage to prove:
  - Pending users remain unable to read private data after submitting a request.
  - Super Admin accesses pending candidates only through the trusted callable, never directly through Firestore, and receives no user data beyond the documented candidate response shape.
  - A bootstrap-created Coordinator can immediately open Coordinator tools and approve another pending request.
  - Super Admin remains isolated from batch content and cannot become a Coordinator.
  - Existing Coordinator approval, rejection, role appointment/revocation, audit filtering, and pagination remain unchanged.

- Review Firestore Rules and confirm no client-side rule broadening is required; the new access remains server-only.
- Verify callable payload validation, cursor validation, minimal data return, operation-idempotency behavior, audit retention, recent-auth checks, and no personal data in function logs. Verify that both callables use the existing `secureCall` App Check configuration in automated tests; verify actual rejected invalid/missing App Check traffic in deployed staging rather than treating emulator behavior as production proof.
- Run all tests, build, lint/type checks available in the repository, and inspect the final diff for accidental environment, secret, or generated-file changes.

Phase handoff: document any debt found, remove it immediately, and confirm every test and build succeeds.

## Phase 4 — Staging and production release validation

Success criteria: a real zero-Coordinator scenario is proven in staging before controlled production release.

- Deploy the complete Functions, Firestore-index, and Hosting revision to staging first. In staging:
  - Use a Super Admin account and at least two test applicants.
  - Verify the initial no-Coordinator state.
  - Bootstrap one applicant as Coordinator.
  - Confirm the bootstrap panel disappears.
  - Sign in as the new Coordinator and approve the second applicant.
  - Confirm corresponding audit records and protected-route behavior.
  - Confirm requests without valid App Check are rejected.

- Promote the exact revision validated in staging to production only after staging passes; do not independently rebuild or redeploy artifacts during promotion.
- In production, perform the bootstrap action only if production truly has zero active Coordinators; otherwise the existing active-member appointment flow remains the correct path.
- Capture private release evidence: deployed revision, passing staging checks, production smoke check, audit event, and release-owner approval.

## Assumptions and fixed decisions

- Bootstrap authority is available **only while the batch has zero active Coordinators**. It is not a permanent Super Admin approval queue.
- Super Admin can bootstrap only one pending applicant at a time; after success, ordinary access requests are handled by Coordinators.
- The existing Super Admin active-member appointment flow remains available during zero-Coordinator recovery for already-active members. Bootstrap exists specifically for the case where the viable candidate is still pending.
- The shared pending queue is not assigned to a Coordinator. Once appointed, every Coordinator can review all pending requests.
- Super Admin never gains private batch-content access, and the founder account remains ineligible for Coordinator membership.
- Current active-member search behavior is untouched by this feature; bootstrap candidates use cursor pagination rather than an unbounded directory scan.
