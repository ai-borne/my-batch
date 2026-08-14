# Ajinkyans — MVP Implementation Plan

**Status:** Phase 3 complete. Phase 4 is next.

## Success target

Deliver a private, secure MVP for the Ajinkyans 2002 batch: approved Google-authenticated members can manage profiles, RSVP, direct-UPI payment claims, and memories; Coordinators run batch operations; private and financial data remains protected by Firebase Rules and trusted Cloud Functions.

## Phase 0 — Product and architecture lock-in

**Status:** complete.

- Reconcile scope, privacy, authorization, data-model, and payment decisions.
- Lock the stack, environment separation, test tools, and operational responsibilities.
- Document the Super Admin/Coordinator boundary and reconciliation cadence.

**Exit criteria:** the Phase 0 readiness document is complete and the production build passes.

## Phase 1 — Secure foundation

**Status:** complete.

1. Add Tailwind, React Router, Firebase, Vitest, Firebase Emulator Suite, and Playwright.
2. Add safe environment templates and ignore real local configuration/secrets.
3. Configure Firebase development and staging projects; bootstrap real administrator identities privately during staging setup.
4. Implement Google sign-in, user bootstrap, access request, pending, and active-member routing.
5. Implement initial Firestore/Storage rules and callable Cloud Function boundaries.
6. Write emulator and end-to-end tests for unauthenticated, pending, active, Coordinator, and cross-batch access.

**Exit criteria:** pending users cannot read private data; approved users can access their batch only; Coordinator approval works through a trusted function; rules tests and build pass.

## Phase 2 — Identity, directory, and RSVP

**Status:** complete.

1. Implement batch shell, profile, houses, member directory, and house assignment.
2. Implement Coordinator membership management: approve, suspend, remove, and reinstate.
3. Implement reunion configuration and RSVP with cutoff/reopen behaviour.

**Exit criteria:** an approved member can edit their own profile and RSVP; a Coordinator can manage membership, house assignment, reunion details, and RSVP exceptions; all authorization tests and build pass.

## Phase 3 — Payments and financial transparency

**Status:** complete.

1. Implement Coordinator payment instructions and UPI QR configuration.
2. Implement payment-claim submission and Coordinator review, clarification, verification, and rejection.
3. Implement trusted aggregate fund summaries, expenses/receipts, CSV export, audit events, and reconciliation workflow.

**Exit criteria:** payment evidence is Coordinator-only; batchmates see aggregates and approved expenses only; no client can write verified finance state or fund totals; all tests and build pass.

## Phase 4 — Memory archive and moderation

1. Implement scoped photo/video uploads, posts, albums, comments, likes, and reporting.
2. Implement Coordinator moderation, removals, and audit events.
3. Enforce media limits, upload progress/retry/cancel, consent notice, and Storage Rules.

**Exit criteria:** active members can safely publish permitted content; Coordinators can moderate it; invalid, oversized, unauthorized, and cross-batch media access is denied; all tests and build pass.

## Phase 5 — Pilot hardening and launch

1. Add PWA/installability, offline shell, resilience states, accessibility, and mobile-browser testing.
2. Complete logging, backups/export, security review, and restore test.
3. Seed staging with demo data; invite 10–15 batchmates; fix prioritised issues.
4. Apply the go/no-go criteria and configure production privately.

**Exit criteria:** staging tests, security review, backup restore, and controlled pilot pass; launch owner explicitly approves wider release.

## Operating rule

Do not start a later phase while the current phase has a failing build, failing required tests, unresolved security debt, or an unrecorded scope decision that affects the current phase.
