# Super Admin Governance — Execution Record

## Phase 0 — Baseline and Safety Gate

Completed: 2026-08-15

### Scope inspected

- Roles and authorization: memberships use `batchmate` and `coordinator`; the existing callable `assignCoordinator` requires the Firebase custom claim `superAdmin === true`.
- Firestore Rules: client membership mutations are denied; audit events are write-denied to clients and currently coordinator-readable.
- Routes and UI: `/account/coordinator` is Coordinator-only, and `/admin` currently redirects there. No Super Admin UI route exists yet.
- Authentication: `AuthProvider` derives user state from Firebase Auth and membership state from `batches/sssatara-2002/memberships/{uid}`. It does not yet surface custom claims.
- Audit schema: callable functions create immutable `batches/{batchId}/auditEvents` records containing actor, action, target where applicable, batch, outcome, and timestamp. The Phase 2 governance-specific schema has not yet been implemented.
- Test conventions: unit/component tests use Vitest; Rules and callable integration tests run against dedicated Firebase Emulator configurations; E2E uses Playwright plus seeded Firebase emulators; release controls and architecture checks are Node scripts.

### Baseline safety findings

- Git worktree was clean before Phase 0 changes.
- No TypeScript or TSX source file is at or above the 300 LOC limit.
- No tracked `.env`, service-account JSON, private key, Firebase client configuration, or reCAPTCHA key was detected. `.env` files are ignored; only the empty-value `.env.example` template is tracked.
- The local Node runtime is v24.4.1 while the repository declares Node 22 for deployment. This was recorded as environment evidence only; the Firebase Functions deployment target remains intentionally Node 22 and was not changed during the baseline phase.

### Baseline defect and immediate remediation

The E2E suite initially failed two tests because its server could expose Vite while Firestore's REST listener was still unstable, and its access-request fixtures did not satisfy production query and Rules requirements:

- `createdAt` was missing, so an ordered Coordinator query excluded the pending request.
- `rollNumber` was missing, so Firestore Rules correctly rejected a corrected access request.

Remediation completed in this phase:

- Seed E2E data before exposing Vite to Playwright.
- Require three consecutive successful Firestore REST responses before continuing.
- Add `createdAt`, `updatedAt`, and valid `rollNumber` values to the pending and rejected fixture documents.
- Remove the now-redundant Playwright late-seeding hook.

### Verification results

| Gate | Command | Result |
| --- | --- | --- |
| Production build | `npm run build` | Passed |
| Unit/component tests | `npm test` | Passed: 35 tests in 14 files |
| Coverage | `npm run test:coverage` | Passed: all configured thresholds |
| Architecture | `npm run test:architecture` | Passed: 77 source files |
| Firestore/Storage Rules | `npm run test:rules` | Passed: 8 tests |
| Callable integration | `npm run test:functions` | Passed: 11 tests |
| E2E | `npm run test:e2e` | Passed: 14 tests |
| Release controls | `npm run release:controls` | Passed |
| Production dependency audit | `npm audit --omit=dev --audit-level=high` | Passed |

### Phase handoff

All Phase 0 requirements are complete and verified. The E2E fixture/startup debt found during the phase was removed immediately; no Phase 0 technical debt is deferred. Product authorization, Super Admin routes, governance audit access, and console UI remain deliberately untouched until their respective later phases.

## Phase 5 — Operations, Security Review, and Release Gate

Completed in repository: 2026-08-15

### Work completed and verified

- Added the trusted offline Super Admin claim grant/revoke utility and the non-secret operating procedure for claim refresh, Coordinator offboarding, incident response, audit review, retention verification, rollback, and deployment checks.
- Added a Super Admin-specific security review and test coverage that prevents the operating procedure and offline-claim safeguards from being removed silently.
- Corrected the Firebase Rules specification to match the enforced policy: audit events are unreadable and unwritable by every browser client, and only the claimed Super Admin audit callable may return them.
- Resolved the plan's App Check conflict in favour of production enforcement, which is required by Phase 2 and the repository-wide callable baseline and is already covered by tests.

### Technical debt and remediation

The stale audit-read statement in the Rules specification was technical debt. It was corrected immediately. No deferred repository technical debt remains from this phase.

### Verification results

| Gate | Result |
| --- | --- |
| Production build | Passed: `npm run build` |
| Unit/component and release-control tests | Passed: `npm test` (49 tests), `npm run test:coverage`, `npm run test:architecture`, `npm run release:controls` |
| Firestore/Storage Rules | Passed: `npm run test:rules` (21 tests) |
| Callable integration | Passed: `npm run test:functions` |
| Browser E2E | Passed: `npm run test:e2e` (14 tests) |
| Production dependency audit | Passed: `npm audit --omit=dev --audit-level=high` (0 vulnerabilities) |

### Phase handoff

The repository implementation and release controls for Phase 5 are complete. Production deployment remains intentionally blocked until private operator evidence exists for trusted IAM review, real-traffic App Check validation, backup plus isolated restore, alert delivery, release-owner approval, and the deploy itself. Those external actions are release prerequisites, not deferred repository technical debt.
