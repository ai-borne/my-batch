# Ajinkyans UI Redesign — Phase-Wise Execution Plan

## Purpose, scope, and relationship to existing plans

This plan implements the P0–P2 UI/UX direction in `UI_Impr.md` for the existing React, TypeScript, Firebase, and Cloud Functions application. It does not replace `AJINKYANS-PHASE-WISE-EXECUTION-PLAN.md`, the privacy policy, authorization boundaries, or the source of truth. Where they conflict, the source of truth and security plans prevail; record the conflict and amend this plan rather than blending requirements.

**Assumptions:** MVP functional phases are complete, the redesign is delivered as independently releasable increments, and no new payment gateway, messaging capability, tracking of personal data, or authorization model is introduced.

**Success target:** an approved member can complete every P0 journey on a real mobile browser without exposed implementation data, inaccessible controls, or weakened privacy/security boundaries.

## Non-negotiable delivery contract

Every phase is independent and ends only with a successful build and all test suites passing. Do not begin the next phase when a test, build, security check, required manual evidence, or phase handoff is incomplete.

1. Write or update unit/component tests and emulator/integration tests before or alongside each change. Add or update browser coverage for changed user journeys. Tests must state the business and authorization intent, not merely implementation details.
2. Use MVVM boundaries: page/view components render state and issue user intents; hooks/view models coordinate UI state; `src/lib` domain modules own pure calculations, contracts, and validation; Firebase Rules and Cloud Functions remain the authorization authority. Do not duplicate state transitions in views.
3. Preserve SSOT: visible copy lives in `src/lib/copy.ts`; colors and visual values live in `src/styles/tokens.css`; shared types, validation, and reunion-state mapping each have exactly one owner. Do not hard-code visible strings or colors in components.
4. Keep every source file at or below 300 LOC. Split by responsibility before handoff. A cohesive SRP exception requires a local comment explaining why splitting would reduce cohesion, and must still pass architecture review.
5. Treat the security objective as prevention and evidence, not an unprovable claim of absolute security. Every change must preserve batch scoping, least privilege, Rules/Function authorization, input validation, redacted logs, safe caching, and protected payment/moderation data. A known high/critical finding blocks the phase.
6. Use synthetic data only in tests, screenshots, staging seed data, and handoff evidence. Never commit secrets, real UTRs, payment proof, private media, or member PII.

## Required verification at every phase

Run the complete suite on the phase candidate; a skipped command is a failed handoff.

```sh
npm run build
npm test
npm run test:coverage
npm run test:architecture
npm run release:controls
npm run test:rules
npm run test:functions
npm run test:e2e
npm audit --omit=dev --audit-level=high
git diff --check
```

Also perform the phase-specific checks stated below. Record command date, commit SHA, result, and manual/device evidence. Fix all phase-created technical debt immediately, rerun affected checks, and only then mark the phase complete.

## Phase map

| Phase | Priority | Objective | Independently releasable outcome |
| --- | --- | --- | --- |
| UX-0 | Foundation | Lock contracts, copy, tokens, and test baseline | No visual behavior change required; redesign decisions are buildable and testable. |
| UX-1 | P0 | Build accessible responsive shell and primitives | Navigation and common states work across mobile, tablet, and desktop. |
| UX-2 | P0 | Make Home and Reunion state-driven | One authoritative reunion model controls every member-facing CTA and date. |
| UX-3 | P0 | Deliver trustworthy directory and profiles | Search is server-backed, bounded, private, and human-readable. |
| UX-4 | P0 | Complete recoverable archive and finance UX | Members can safely browse/share memories and recover payment-claim issues. |
| UX-5 | P1 | Improve account, notifications, and operations | Settings and operational workspaces are structured without role leakage. |
| UX-6 | P2 / launch gate | Validate content, devices, accessibility, and pilot readiness | Release candidate has evidence for the UI acceptance criteria. |

## Phase UX-0 — Contracts, resources, and baseline

**Objective:** convert the redesign from direction into implementation contracts without changing runtime behavior unnecessarily.

### Work

1. Record the current full-suite baseline and file-size inventory. Resolve any pre-existing failing check before UI work begins; do not mislabel it as new redesign debt.
2. Extend `src/lib/copy.ts` with the approved visible-copy structure and identify all component literals that must move into it. Define copy keys by feature and state, not by page implementation detail.
3. Define semantic token ownership in `src/styles/tokens.css`: light/dark canvas, surface, elevated surface, text, muted text, border, focus, success, warning, danger, overlay, and house accents; include typography, spacing, radius, and elevation tokens.
4. Define typed contracts for directory query/filter/cursor results, display-ready post/comment authors, notification destinations, payment-claim recovery states, and reunion status. Choose one owner module per contract.
5. Create the reunion-state decision table for `announced`, `rsvp_open`, `rsvp_closed`, `confirmed`, `completed`, and `archived`, mapping status to allowed CTA, countdown, schedule visibility, notification behavior, and empty copy.
6. Create the launch-content checklist and name the Coordinator product owner in the launch runbook. No real member data belongs in repository fixtures.

### Test-first evidence

- Unit tests cover every reunion-state mapping and payment-claim state, including invalid transitions and fallback copy.
- Component tests assert semantic token classes/copy keys are used by the first migrated component rather than raw colors or new inline copy.
- Integration tests deny unsupported server query filters, cross-batch reads, and unauthorized retrieval of payment/moderation fields.

### Exit criteria

One authoritative contract exists for each listed domain; the architecture check rejects regressions; all baseline and new tests pass. No screen behavior may depend on an undefined reunion or payment state.

## Phase UX-1 — Responsive shell and reusable accessible primitives

**Objective:** establish the P0 shell before redesigning individual pages.

### Work

1. Refactor the batch shell into focused components below the LOC limit: desktop header/navigation, compact tablet navigation, five-item icon-and-label mobile bottom navigation, header utilities, and safe-area-aware content layout.
2. Build only reusable P0 primitives required by several screens: Button, IconButton, Card, Avatar, Badge, SectionHeading, Skeleton, EmptyState, ErrorState, OfflineBanner, Toast, and ConfirmDialog. Each primitive uses semantic tokens and copy resources.
3. Apply responsive rules: 320–767px one column/16px gutters; 768–1199px compact header plus horizontal tabs; >=1200px 1200px maximum content container and 12-column layout where needed.
4. Implement focus trapping, Escape and focus restoration for dialogs/sheets; live announcements for toasts; reduced-motion behavior; non-color status cues; and 48px primary mobile targets.
5. Preserve notification and sign-out behavior while replacing only their presentation. Do not change their authorization or mark-all-read semantics in this phase.

### Test-first evidence

- Component tests cover active navigation semantics, accessible names, safe-area content padding, dialog keyboard behavior, focus restoration, and reduced-motion classes.
- Browser tests cover 375×812, 768×1024, 1024×768, and 1280×800 navigation without horizontal overflow or hidden bottom-nav content.
- Existing auth/authorization integration tests remain unchanged and pass, proving the shell does not bypass protected routing.

### Exit criteria

All member routes share the new shell; the five primary destinations are reachable on mobile with visible icons and labels; no interaction-critical control relies on color alone.

## Phase UX-2 — State-driven Home and Reunion

**Objective:** make the member’s next reunion action unambiguous and consistent.

### Work

1. Route Home and Reunion through the single reunion-status mapper from UX-0. Remove page-local date/CTA decisions and duplicate date copy.
2. Implement the P0 Home hierarchy: reunion state and one dominant CTA, then exactly one secondary content module. Keep milestones, batch-at-a-glance expansion, and archival timeline enhancement out of this phase.
3. Rework Reunion with RSVP above schedule/fund details; render confirmed details, unavailable details, schedule empty state, calendar action, venue directions, and privacy-safe attendance social proof from typed data.
4. Define loading, empty, offline, permission-denied, and retry states for both pages. Errors must not disclose private data or internal Firebase terminology.
5. Keep calendar links as validated, encoded external actions; do not embed a third-party map or expose venue/private attendance data outside approved-member access.

### Test-first evidence

- Unit tests exhaustively map all reunion statuses to Home/Reunion CTA, copy, countdown, and visibility behavior.
- Component tests cover every named state and confirm no raw date contradiction is rendered.
- Rules/Functions tests prove non-members and cross-batch users cannot read reunion content or RSVP data.
- Browser tests cover RSVP open/closed, confirmed schedule, unavailable/retry, and 375×812 first-viewport primary-action placement.

### Exit criteria

For every defined reunion status, Home and Reunion show the same status meaning and permissible CTA. A member can identify the next action within the initial 375×812 viewport.

## Phase UX-3 — Directory, houses, and member profile trust

**Objective:** replace implementation-facing directory behavior with a scalable, private member experience.

### Work

1. Implement server-backed directory search with normalized approved fields, permitted filters/sorts, debounced requests, cursor pagination, bounded result counts, and required Firestore indexes. Never search only the client-loaded page.
2. Add house presentation data—name, accent, crest/image, selected state, and member count—from a single batch-scoped source.
3. Render profile cards/rows with photo or initials, display name, house, city, profession, and profile affordance. Remove raw IDs and pagination mechanics from member-facing copy.
4. Create profile headers with explicit visibility cues. Add report/contact options only when permitted by product policy; no direct messaging is introduced.
5. Deliver loading, no-results with clear-filter action, empty, offline, permission-denied, and retry paths. Do not reveal whether a private profile exists to an unauthorized user.

### Test-first evidence

- Unit tests validate filter normalization, allowed sort/filter combinations, cursor progression, result-count language, and display-name fallback.
- Emulator integration tests cover bounded batch queries, indexes, cross-batch denial, unauthorized profile denial, and privacy-preserving no-result behavior.
- Browser tests cover search beyond the first page, active chips, clear filters, zero results, and profile navigation at mobile/tablet/desktop widths.

### Exit criteria

Directory queries are bounded and batch-scoped; all member-facing records use display-ready identity; all visible result counts reflect the server contract rather than loaded-record mechanics.

## Phase UX-4 — Memories and fund recovery UX

**Objective:** make high-value archive and finance tasks understandable, recoverable, and privacy-safe.

### Work

1. Prioritize memory browsing and sharing: accessible feed cards, author/avatar/date/caption, media grid/lightbox, reaction/comment summaries, contextual overflow, and a focused share flow. Implement the three sharing steps without imposing optional metadata as required.
2. Add media skeletons, thumbnails, video posters, lazy loading, cancel/retry/error recovery, abandonment warning, and appropriate contextual image alternatives. Preserve existing file validation and Storage authority.
3. Keep moderation operationally separate. Define reporter acknowledgement, affected-member notice, removal rendering, and appeal route according to the privacy policy; reports remain private.
4. Present fund aggregate progress, verified collections, approved expenses, balance, payment instructions, open/copy UPI action, QR, security warning, and member claim status. Do not expose other members’ claims, UTRs, or proofs.
5. Implement payment recovery presentation for draft, submitted, under review, clarification required, verified, rejected, and resubmitted. Prevent accidental duplicate claims through server-authoritative idempotency; render clear correction/resubmission actions.

### Test-first evidence

- Unit/component tests cover upload/share state progression, cancellation/retry, consent acknowledgement, claim-state rendering, duplicate prevention affordances, and safe error copy.
- Rules/Functions integration tests deny invalid media, unauthorized evidence, cross-batch access, unsupported claim transitions, duplicate mutation, and unauthorized moderation visibility.
- Browser tests cover upload interruption/retry, image/video fallback, comment/report, payment rejection/clarification/resubmission, and Coordinator-only evidence access.
- Performance evidence on documented representative 4G settings confirms feed chrome and first usable content render before non-visible media is downloaded.

### Exit criteria

A member can browse and share a memory, and submit/recover a payment claim, without losing work or accessing another member’s financial/moderation data. Media and payment state failures have tested recovery actions.

## Phase UX-5 — Account, notifications, and role-specific operations

**Objective:** improve recurring account and operational work without expanding permissions.

### Work

1. Divide Account into identity, professional/life details, school memories, links, photo, appearance, privacy, support, and danger-zone sections. Show a sticky save control only after an edit and provide a member-safe preview.
2. Add notification icon, unread count, timestamps, deep links, explicit mark-all-read action, and full-height mobile sheet. Opening notifications must not change read status.
3. Organize Coordinator operations into requests, reunion, fund, members, archive moderation, and announcements; use responsive tables/cards. All destructive actions require impact copy, reason capture where relevant, confirmation, and reauthentication where policy requires it.
4. Keep Super Admin governance distinct: coordinator assignment, audit search/filtering, and irreversible action confirmation only. Explicitly deny batch-content/operational routes to Super Admins without matching membership.

### Test-first evidence

- Component tests cover dirty-state save behavior, section labels, notification read semantics, deep-link destination validation, confirmation dialogs, and danger styling with non-color cues.
- Rules/Functions tests cover notification read mutation authorization, Coordinator-only actions, audit scope, and Super Admin denial of batch-private content.
- Browser tests cover profile save/reload, notification opening versus explicit mark-all-read, mobile sheet behavior, Coordinator destructive confirmation, and Super Admin forbidden routes.

### Exit criteria

Account edits are grouped and recoverable, notifications do not silently alter state, and operational screens expose only the actions authorized for the signed-in role.

## Phase UX-6 — Content readiness, accessibility, device validation, and pilot gate

**Objective:** validate the completed redesign with launch-quality content and real-world conditions.

### Work

1. Seed only approved synthetic staging launch content: six houses, 10–20 vetted archive posts, display-ready profiles where available, reunion status/schedule/contacts, and payment instructions. The Coordinator product owner completes the launch checklist.
2. Run visual regression checks at 375×812, 768×1024, 1024×768, 1280×800, and 1440×900. Record no horizontal overflow, truncated controls, unusable forms, or obscured fixed content.
3. Test iOS Safari and Android Chrome in browser and installed-PWA modes: text scaling, safe areas, photo picker/camera flow, keyboard overlap, slow/unstable networks, interrupted upload recovery, reconnect, and post-sign-out cache behavior.
4. Conduct moderated usability checks with 8–12 approved pilot participants or equivalent representatives. Measure unaided success for access, finding a batchmate, profile update, RSVP, payment claim, memory browse/upload/comment/report, and Coordinator review. Keep only redacted aggregate notes.
5. Triage every issue with reproduction, severity, owner, affected role, privacy/security impact, test plan, and resolution. Fix all launch blockers within this phase and rerun the full suite after each release-candidate change.

### Exit criteria

- Launch checklist is complete and owned.
- All critical journeys achieve at least 90% unaided completion; each remaining failure is resolved or has a recorded product decision approved by the launch owner.
- No high/critical security finding, accessibility blocker, or P0 regression remains.
- The release record identifies one immutable tested commit and explicit go/no-go approval.

## Mandatory Phase Handoff

Complete this immediately after each phase. `Complete` is not permitted until every debt item is resolved and all required checks pass.

```text
Phase: UX-?
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

Security review:
- Changed trust boundaries, threats considered, findings, resolution, and regression tests

Verification:
- npm run build: pass/fail (run ID/date)
- npm test: pass/fail (run ID/date)
- npm run test:coverage: pass/fail (run ID/date)
- npm run test:architecture: pass/fail (run ID/date)
- npm run release:controls: pass/fail (run ID/date)
- npm run test:rules: pass/fail (run ID/date)
- npm run test:functions: pass/fail (run ID/date)
- npm run test:e2e: pass/fail (run ID/date)
- npm audit --omit=dev --audit-level=high: pass/fail (run ID/date)
- git diff --check: pass/fail (run ID/date)
- Required device/staging/manual evidence: reference and result

Next phase eligibility:
- Approved / blocked
- Reason and exact unblock condition
```

If the status is `Blocked`, stop. Do not begin later phase work until the named unblock condition is met and all affected verification is rerun.
