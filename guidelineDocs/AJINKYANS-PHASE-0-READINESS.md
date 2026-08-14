# Ajinkyans — Phase 0 Implementation Readiness

**Status:** complete — the implementation contract is locked. Private administrator identities are supplied only during Firebase bootstrap and are never committed to source control.

## Purpose

Phase 0 turns the product documentation into the implementation contract. It does not create production Firebase projects, configure private administrator accounts, or add application code.

## Locked implementation contract

| Area | Decision |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, and React Router. |
| Authentication | Firebase Authentication with Google OAuth only. |
| Data and media | Cloud Firestore and Firebase Storage, fully batch-scoped. |
| Authorization | Firestore and Storage Rules are authoritative; UI visibility is not authorization. |
| Trusted backend | Firebase Cloud Functions first. Cloudflare Workers require a future, specific edge/API decision. |
| Environments | Separate local, staging, and production Firebase projects/configuration; never use production data for testing. |
| Testing | Vitest plus Firebase Emulator Suite for unit/rules tests; Playwright for end-to-end flows. |
| Private access | Only active batch members can access private batch content. Pending users cannot read it. |
| Operational authority | Coordinators run all batch operations, including membership management and payment reconciliation. The Super Admin provisions/revokes Coordinator access only and has no batch operational or private-content access. |
| Reconciliation | Coordinators reconcile the ledger daily while contributions are being collected, then weekly after the reunion until accounts are closed. |
| Payments | Direct UPI to the designated Coordinator/collection account; UTR, amount, and payment date are required; screenshots are optional. |
| Sensitive finance | Payment claims, UTRs, and screenshots are Coordinator-only. Aggregate finance and approved expenses are visible to active batch members. |
| Media | JPG, PNG, HEIC, WebP, MP4, and MOV; photos up to 20 MB, videos up to 250 MB and five minutes. |
| Privacy | The pilot privacy, consent, retention, takedown, and moderation policy is binding. |
| PWA | Installable/offline behaviour is launch hardening, after secure core workflows are complete. |

The Firestore model and Firebase rules requirements are defined in `AJINKYANS-FIRESTORE-DATA-MODEL.md` and `AJINKYANS-FIREBASE-SECURITY-RULES-SPEC.md`.

## Private deployment configuration required during Phase 1

This value is deliberately not stored in source control:

1. Record the Super Admin Gmail ID and at least one Coordinator Gmail ID in private deployment configuration.

## Deferred decisions that do not block the secure foundation

- Exact reunion schedule, contacts, directions, and logistics.
- Final contribution amount and contribution-head calculation.
- Expense category list and CSV column layout.
- Whether a post can include more than one video; the MVP data model supports multiple media references but the upload UX must define its final limit before the Memories phase.
- Domain routing, operational logging/error reporting provider, storage quota/cost ceiling, branding assets, and PWA implementation details.

## Phase 1 entry criteria

- The private administrator identities are available to the deployment operator without being committed to source control when Firebase staging is bootstrapped.
- Firebase development and staging project identifiers are available to the implementation team.
- The Super Admin bootstrap method is selected without committing private credentials to source control.

## Phase 1 success criteria

- A user can sign in with Google, submit an access request, and see no private data while pending.
- A Coordinator can approve an eligible request through a trusted Cloud Function.
- An active member can read only their own batch’s private data.
- Emulator tests prove that unauthenticated, pending, cross-batch, and unauthorized role-escalation access is denied.
