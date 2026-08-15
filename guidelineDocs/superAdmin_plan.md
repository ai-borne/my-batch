# Super Admin Governance — Phase-Wise Execution Plan

Target document: `guidelineDocs/SUPER-ADMIN-EXECUTION-PLAN.md`

## Phase 0 — Baseline and Safety Gate

- Inspect current roles, Firestore Rules, callable functions, routes, AuthProvider, Coordinator UI, audit schema, and existing test conventions.
- Record baseline build/test commands and their passing status before any change.
- Confirm no Firebase secrets, service-account JSON, client configuration, or reCAPTCHA keys are tracked by Git.
- Identify files near 300 LOC before changing them; split by responsibility instead of extending oversized files.

Success criteria:

- Production build succeeds.
- All current unit, Rules, callable integration, and release-control tests pass.
- No tracked secret is detected.
- Phase Summary is issued before Phase 1.

## Phase 1 — Authorization Model and Route Foundation

TDD first:

- Add tests proving Super Admin claim detection, correct route destination, and denial of Super Admin access to normal member/request-access flows.
- Add tests proving normal members and Coordinators cannot access `/super-admin`.

Implementation:

- Extend auth state with `isSuperAdmin`, sourced only from Firebase ID-token custom claims.
- Add a dedicated Super Admin route guard and `/super-admin` route.
- Redirect `/admin` to `/super-admin`; keep `/account/coordinator` strictly Coordinator-only.
- Keep Super Admin outside normal member `BatchShell`; do not grant a membership automatically.
- Ensure the UI is never the authorization authority: backend checks remain mandatory.

Success criteria:

- Super Admin lands at a safe placeholder console after sign-in.
- Coordinator and member navigation remain unchanged.
- Build and all tests pass.
- Phase Summary confirms no unresolved technical debt.

## Phase 2 — Secure Governance Backend and Audit Data

TDD first:

- Add callable integration tests for Coordinator assignment/revocation.
- Cover active-member requirement, self-assignment denial, recent-auth requirement, App Check enforcement, rate limits, required reason, and no-op behavior.
- Add Rules tests proving no client can directly write or read audit events.
- Add tests for Super Admin-only paginated member-directory and audit-log access.

Implementation:

- Extend `assignCoordinator` to require a validated reason for every assign/revoke action.
- Record immutable governance audit events with actor, target, batch, action, outcome, reason, role before/after, and timestamp.
- Add Super Admin-only callable endpoints for:
  - Active member/Coordinator directory, searchable by name, email, and member code.
  - Cross-feature audit events with date, action, actor, target filters, and opaque pagination.
- Keep PII out of audit records; resolve display information only through the authorized directory endpoint.
- Denied or malformed governance attempts are written as structured Cloud Function logs, not user-created Firestore audit entries.
- Restrict audit-event data access to trusted callable functions only.
- Add a system-only 24-month audit retention process and migration/backfill strategy for existing audit records.

Success criteria:

- Only a claimed Super Admin can list governance data or mutate Coordinator roles.
- Revoked Coordinators fail all protected backend actions immediately.
- Audit records cannot be changed or deleted by users.
- Build and all tests pass.
- Phase Summary confirms no unresolved technical debt.

## Phase 3 — Super Admin Console UI/UX

TDD first:

- Add component/interaction tests for Coordinator search, assignment, revocation, reason validation, confirmation, error handling, pagination, and audit filters.
- Test loading, empty, access-denied, and retry states.

Implementation:

- Build a dedicated, minimal Super Admin shell:
  - Coordinator access directory.
  - Audit-log screen.
  - Secure sign-out.
- Add server-paginated member search and role status presentation.
- Use a confirmation dialog for every role mutation; require fresh Google reauthentication immediately before submitting.
- Require a business reason and display clear success/failure feedback.
- Provide audit filters for action, actor, target, and date range.
- Use existing string resources and universal color/theme conventions; add reusable resources rather than hardcoding user-facing text or colors.
- Keep components under 300 LOC; separate data hooks, view models, and presentation components by responsibility.

Success criteria:

- Super Admin can safely appoint/revoke eligible Coordinators and inspect authoritative logs.
- No normal member or Coordinator can render or use Super Admin controls.
- Build and all tests pass.
- Phase Summary confirms no unresolved technical debt.

## Phase 4 — Coordinator Hardening and Role-Change Resilience

TDD first:

- Test that a revoked Coordinator loses privileged UI access after refresh and receives backend denial without a page refresh.
- Test Coordinator approval/member-management flows remain unchanged.
- Test Super Admin role changes do not alter member codes, approval status, finance records, or content permissions.

Implementation:

- Refresh membership when entering privileged Coordinator routes and after permission-denied responses.
- Redirect revoked Coordinators away from Coordinator tools with a clear, non-sensitive explanation.
- Preserve the authority hierarchy:

  `Super Admin → assigns/revokes Coordinators → Coordinators manage batch members`

- Validate that all Coordinator actions continue using existing protected callable functions and Firestore Rules.
- Do not expand Super Admin scope into member approval, moderation, content, or finance operations.

Success criteria:

- Role changes take effect safely and consistently across UI, Firestore Rules, and callable functions.
- Existing Coordinator workflows remain fully functional.
- Build and all tests pass.
- Phase Summary confirms no unresolved technical debt.

## Phase 5 — Operations, Security Review, and Release Gate

- Create/update the operational runbook for trusted offline Super Admin provisioning and revocation.
- Document claim refresh, incident response, Coordinator offboarding, audit-log review, retention verification, rollback, and deployment checks.
- Perform a security review:
  - Verify no secrets are committed.
  - Verify least-privilege Firestore Rules and callable authorization.
  - Verify App Check remains monitor-only until real traffic is validated.
  - Verify audit data cannot be client-modified.
  - Verify error messages do not expose sensitive information.
- Run the complete production build and all test suites.
- Deploy only when every phase’s acceptance criteria and release controls pass.

Success criteria:

- All Super Admin and Coordinator governance flows are documented, tested, and deployed safely.
- Every test passes with no skips.
- The phase handoff explicitly confirms zero deferred technical debt.
- Only after this gate passes does work begin on the member-facing MOAT features.

## Required Phase Handoff Format

At the end of every phase, provide:

1. Work completed and verified.
2. Technical debt identified.
3. Exact remediation performed immediately.
4. Build command result.
5. Unit, integration, Rules, and release-control test results.
6. Confirmation that the phase is fully complete before the next phase starts.

## Defaults Locked

- Initial Super Admin: `founder@ai-borne.in`, provisioned only through trusted offline Firebase Admin tooling.
- Initial Coordinator: `mail.sunilpawar@gmail.com`.
- Batch: `sssatara-2002`.
- Super Admin scope: Coordinator role governance and full audit visibility only.
- Audit reasons: required for every Coordinator role change.
- Audit retention: 24 months.
- No in-app creation of Super Admin accounts.
