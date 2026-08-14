# Ajinkyans — Pre-Implementation Lock-In Checklist

Use this checklist to close the decisions that affect scope, data safety, permissions, cost, and architecture before building the MVP. Keep the source-of-truth document as the product context; record each final decision here with an owner and date.

## How to use this checklist

- Mark an item `[x]` only when the decision is explicit and recorded.
- Mark an item `[~]` when a temporary pilot assumption is acceptable and documented.
- Leave an item `[ ]` when it still needs discussion.
- Do not enter real member, payment, or private media data until the security and privacy items are complete.

## Pilot decisions captured

These answers came from the pilot owner and should guide the MVP. Items marked `[~]` are usable as pilot assumptions but still need a final operational value.

- [x] **Product owner:** the pilot owner is the person maintaining this checklist.
- [~] **Role assignment:** the Super Admin adds a Batch Coordinator Gmail ID, which grants that person Coordinator access. Super Admin account details will be configured privately later.
- [x] **Reunion timing:** 06–08 January 2027; the detailed daily schedule remains open.
- [x] **Reunion location:** Sainik School Satara, India; the final venue logistics and map details remain open.
- [x] **Timezone:** India Standard Time (`Asia/Kolkata`).
- [x] **Pilot audience:** the Ajinkyans 2002 batch.
- [x] **Media:** photos and videos are included in the pilot.
- [x] **Comments:** comments are enabled at pilot launch.
- [x] **Membership approval:** access requests are manually approved by a coordinator.
- [x] **RSVP visibility:** attendance is visible to approved batchmates by default.
- [x] **RSVP planning fields:** spouse, child, vegetarian/non-vegetarian preference, and hotel requirement are collected.
- [x] **RSVP fields:** attendance (Yes/No/Maybe), accompanying adult count, accompanying child count, vegetarian/non-vegetarian preference, hotel required (Yes/No), and miscellaneous details.
- [x] **RSVP editing:** Coordinators set the cutoff date; members may edit until that cutoff, and Coordinators may reopen an individual RSVP afterward.
- [~] **Contribution amount:** ₹30,000 per family is the starting estimate/default; Coordinators may configure another amount.
- [~] **Payment initiation:** members pay the designated Coordinator using the QR code shown on the website, then submit/confirm payment details. The payment dashboard updates as claims are recorded and verified.
- [x] **Payment submission fields:** after scanning the UPI QR code, members submit UTR number, amount, and payment date; the submission populates the Coordinator payment screen.
- [x] **Payment evidence:** payment screenshots are optional.
- [x] **Member support:** members contact Coordinators personally through WhatsApp. No support inbox or private messaging is included in the website MVP.
- [x] **Visibility:** member profiles, RSVP details, and approved expenses/receipts are visible to approved batch members. Individual payment status, UTRs, and screenshots are restricted to Coordinators; batch members see aggregate payment progress only.
- [x] **Pilot roles:** the pilot uses Super Admin and Coordinator roles only. There are no Treasurer or Content Moderator permissions in this MVP.
- [x] **Identifiers:** use an immutable batch ID such as `batch-2002-3711`; store `schoolId: "3711"` and `passingYear: 2002` separately.
- [x] **Upload limits:** photos up to 20 MB; videos up to 250 MB and 5 minutes; JPG, PNG, HEIC, WebP, MP4, and MOV.

### Remaining answers required before these can be fully locked

- [ ] Record the Project/Super Admin Gmail ID privately in deployment/admin configuration when ready.
- [~] Record the Batch Coordinator Gmail ID; it will be added by the Super Admin.
- [x] Confirm the reunion date window: 06–08 January 2027.
- [x] Confirm the venue: Sainik School Satara.
- [~] Clarify the final per-family amount after RSVP planning; current default is approximately ₹30,000 per family and may be changed by Coordinators.
- [x] Use personal WhatsApp contact with Coordinators for member support; publish coordinator contact details separately from the website messaging features.
- [x] Define RSVP editing: Coordinators set the cutoff and may reopen an individual RSVP.
- [x] Define payment status states: Unpaid, Submitted, Under Review, Verified, Rejected.

## 1. Pilot identity and scope

- [x] Confirm the pilot name: Ajinkyans 2002 (Sainik School Satara — 2002 Batch).
- [x] Confirm the pilot launch/reunion date and timezone: 06–08 January 2027, `Asia/Kolkata`.
- [x] Confirm the pilot venue and whether directions/accommodation information is ready: Sainik School Satara confirmed; logistics details remain open.
- [x] Confirm the initial member invitation and approval process: access requests are manually approved.
- [ ] Define the pilot success criteria (for example: approved members, RSVP completion, memories uploaded, and payment reconciliation).
- [ ] Explicitly list what is out of MVP scope: direct messaging, payment gateway/platform-held funds, automated vendor payouts, AI organisation, and other future ideas.
- [x] Decide whether video uploads are included in the first pilot or enabled after the photo archive is stable: photos and videos are included.

## 2. People, ownership, and operating rules

- [~] Name the Super Admin / primary product owner: account details to be configured privately later.
- [~] Name the Coordinator(s): Batch Coordinator is added by the Super Admin; Gmail ID remains open.
- [x] Confirm there are no Treasurer or Content Moderator permissions in the pilot MVP; Coordinators handle those responsibilities.
- [ ] Define who can approve, suspend, remove, and reinstate members.
- [ ] Define who can approve, reject, or request clarification on payment claims.
- [ ] Define an escalation contact for privacy, safety, and inappropriate content reports.
- [x] Decide the support channel for the pilot: members contact Coordinators personally through WhatsApp; no in-website messaging flow.

## 3. Membership and identity

- [ ] Confirm Google OAuth as the only sign-in method for MVP.
- [ ] Define the access-request fields: name, house, passing year, and any additional verification field.
- [ ] Define how coordinators verify that an access request belongs to the batch.
- [ ] Define the membership states and transitions: requested, pending, active, suspended, removed.
- [ ] Confirm the six pilot houses and their Junior/Senior grouping.
- [ ] Decide whether a member may belong to more than one batch in the platform model.
- [ ] Define the canonical profile fields and which are optional.
- [x] Define who can see each profile field and RSVP details: visible to approved batch members; public unauthenticated users cannot access them.
- [ ] Decide the account deletion, profile removal, and data-export process.

## 4. Roles and authorization

- [x] Confirm the pilot batch-specific roles: Batchmate, Coordinator, and Super Admin. Treasurer and Content Moderator permissions are excluded from the pilot MVP.
- [ ] Define a permission matrix for reading and writing each product area.
- [ ] Confirm whether one person may hold multiple roles in the same batch.
- [ ] Define who may assign, change, and revoke roles.
- [ ] Confirm that Firestore and Storage rules—not UI visibility—are the authorization source of truth.
- [x] Define Coordinator financial access: Coordinators can access UTRs, screenshots, payment claims, exports, and receipts.
- [ ] Define the audit trail required for approvals, role changes, payment decisions, moderation, and deletions.

## 5. Reunion and RSVP

- [x] Confirm the final reunion date window and timezone: 06–08 January 2027, `Asia/Kolkata`; daily start/end times remain open.
- [x] Confirm the RSVP states: Yes, No, Maybe.
- [x] Confirm RSVP fields: spouse, children, vegetarian/non-vegetarian preference, and hotel requirement.
- [x] Decide the visibility of attendance, spouse/children counts, and accommodation requirements: visible to approved batch members.
- [x] Allow members to edit RSVP until a Coordinator-configured cutoff date; Coordinators may reopen an individual RSVP.
- [ ] Confirm schedule dates, event titles, locations, and owners for updates.
- [ ] Confirm venue, directions, parking, emergency, dress-code, and school-visit instructions.
- [ ] Confirm important contacts and the owner responsible for keeping them current.
- [ ] Decide whether Add to Calendar is required for MVP or a post-pilot enhancement.

## 6. Payments and financial transparency

- [x] Confirm that MVP payments go directly to a designated Coordinator/collection account using the QR code shown on the website.
- [~] Confirm the collection UPI ID, account owner, and process for changing it: configured by Coordinators.
- [~] Confirm contribution heads: spouse, child, vegetarian/non-vegetarian preference, and hotel requirement are required for planning; the financial contribution-head model remains open.
- [~] Confirm the amount or calculation rule for each contribution head: ₹30,000 per family is the starting/default amount; Coordinators may set another amount. The website records payment claims and populates the dashboard.
- [ ] Define accepted payment methods and required claim fields.
- [ ] Confirm whether UTR/transaction ID, payment date, amount, method, and screenshot are mandatory or optional.
- [x] Define payment states: Unpaid, Submitted, Under Review, Verified, Rejected.
- [x] Define who can see individual payment records and evidence: Coordinators only; approved batch members see aggregate payment progress only.
- [x] Define aggregate dashboard visibility: approved batch members see aggregate payment progress; individual payment records remain restricted to Coordinators.
- [x] Define expense visibility: approved expenses and receipts are visible to approved batch members.
- [ ] Define expense categories and required receipt/vendor/date/notes fields.
- [ ] Confirm reconciliation frequency and who owns the ledger.
- [ ] Confirm CSV export format and retention period for financial evidence.

## 7. Memory archive and moderation

- [ ] Confirm allowed media types, file-size limits, duration limits, and image dimensions.
- [ ] Decide whether a post may contain multiple photos/videos.
- [ ] Confirm required and optional post metadata: caption, people tags, album, year, category.
- [ ] Decide whether years/categories are filters in MVP or only future organisation metadata.
- [ ] Define who may create, edit, and delete albums.
- [ ] Define post, comment, and user reporting categories.
- [ ] Define moderation actions: dismiss, hide, remove, suspend, and appeal/escalation.
- [ ] Define media ownership, consent, takedown, and deletion rules.
- [x] Decide whether comments are enabled at pilot launch: enabled.

## 8. Privacy, security, and compliance

- [ ] Approve the privacy notice and consent language for profiles, photos/videos, RSVP, and payment evidence.
- [ ] Confirm that private batch data is excluded from public indexing and unauthenticated reads.
- [ ] Define retention/deletion periods for inactive accounts, reports, payment evidence, and removed media.
- [ ] Define the process for a member requesting correction or removal of personal data.
- [ ] Confirm Firestore rules for approved membership and batch scoping.
- [ ] Confirm Storage rules for authenticated, batch-scoped uploads and financial evidence.
- [ ] Define upload validation, malware/content checks, rate limits, and abuse controls.
- [ ] Decide how expired sessions and reauthentication are handled.
- [ ] Create test cases for cross-batch data access and role escalation.
- [ ] Decide who owns Firebase, domains, DNS, source control, and production credentials.

## 9. Technical architecture and operations

- [ ] Confirm React + TypeScript + Vite + Tailwind as the frontend stack.
- [ ] Confirm Firebase Authentication, Firestore, and Storage for MVP.
- [ ] Decide whether trusted backend work starts in Firebase Cloud Functions, Cloudflare Workers, or both.
- [ ] Define the initial Firestore collection/document model before UI implementation.
- [ ] Define environment separation: local, staging, and production Firebase projects/configuration.
- [ ] Confirm hosting and domain routing for `ajinkyans.com` and `ajinkyans.in`.
- [ ] Decide the state-management boundary; add Zustand only if component/local state is insufficient.
- [ ] Define logging, error reporting, backup/export, and incident-response procedures.
- [ ] Define media storage quotas, thumbnail/transcoding approach, and expected pilot cost ceiling.
- [ ] Confirm browser/device support and the minimum mobile viewport.

## 10. Experience and design system

- [ ] Approve the visual direction, typography, semantic colour tokens, spacing, and radius rules.
- [ ] Confirm the mobile five-item navigation and desktop navigation behaviour.
- [ ] Approve the landing, Home, Houses, Reunion, Memories, Account, and Admin screen priorities.
- [ ] Define loading, empty, error, offline, permission-denied, and expired-session states for every major route.
- [ ] Confirm upload progress, cancel, retry, and abandon-upload behaviour.
- [ ] Confirm accessibility baseline: keyboard access, focus states, contrast, labels, and touch targets.
- [ ] Decide whether dark mode is required for launch or can follow the pilot.
- [ ] Confirm branding assets: logo, hero photography, app icons, favicon, and social preview image.

## 11. Pilot readiness and launch gates

- [ ] Seed a staging batch with non-production/demo data.
- [ ] Test Google sign-in, access requests, approval, suspension, and reauthentication end to end.
- [ ] Test every role against the permission matrix.
- [ ] Test payment claim, verification, rejection, resubmission, and aggregate reporting flows.
- [ ] Test upload, feed, comments, reporting, moderation, and deletion flows.
- [ ] Test mobile browsers, installable PWA behaviour, offline shell, and poor-network states.
- [ ] Run a security review covering Firestore, Storage, uploads, exports, and secrets.
- [ ] Run a data/backup restore test before importing real data.
- [ ] Invite 10–15 batchmates for a controlled pilot.
- [ ] Record pilot issues, prioritise fixes, and define the go/no-go criteria for wider release.

## Recommended decision order

1. Pilot scope, owners, and reunion facts.
2. Membership, roles, privacy, and authorization.
3. Payment model and financial visibility.
4. Data model and backend boundaries.
5. Memory moderation and media limits.
6. Design details, PWA, and polish.
7. Pilot testing and launch gates.

## Decision record template

Copy this block for every decision that is closed:

```text
Decision:
Chosen option:
Reason:
Owner:
Date:
Impacted areas:
Follow-up / revisit date:
```
