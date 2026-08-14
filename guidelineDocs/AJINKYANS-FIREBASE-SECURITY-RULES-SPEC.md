# Ajinkyans — Firebase Security Rules Specification

This specification translates the pilot permission matrix into enforceable Firebase authorization requirements. It is a design contract for the eventual `firestore.rules`, `storage.rules`, and trusted backend functions; it is not a substitute for automated rules tests.

## Security baseline

- Public users may access only the landing page and public product identity. No private batch document or media is publicly readable.
- Every private read/write requires Firebase Authentication and an active membership in the requested batch, unless the operation is explicitly Super Admin-only.
- Membership status and role are read from `batches/{batchId}/memberships/{uid}`. A client-editable profile field is never an authorization source.
- Pilot roles are `batchmate` and `coordinator`; the platform Super Admin is represented by a server-controlled custom claim/configuration.
- A member may write only their own profile, RSVP, posts, comments, likes, reports, and payment submission request.
- Sensitive payment evidence is Coordinator-only. Aggregate finance data is readable by active batch members.
- Client applications cannot write aggregate totals, verification fields, role fields, audit events, or approval timestamps.
- All Storage uploads must be authenticated, batch-scoped, MIME/size validated, and written to server-approved paths.

## Rule helper contract

The eventual rules should provide helpers equivalent to:

```text
isSignedIn()
uid()
isSuperAdmin()
membership(batchId)
isActiveMember(batchId)
isCoordinator(batchId)
isSelf(targetUid)
validBatchId(batchId)
```

`isCoordinator(batchId)` must verify both authentication and an active membership document whose role is `coordinator`. `isSuperAdmin()` must use a server-controlled custom claim or protected configuration document; never trust an email or a client-written role field by itself.

## Firestore rule requirements by path

### `users/{uid}`

- Read: authenticated user may read their own user document; Coordinators/Super Admin may read only fields required for batch operations.
- Create/update: user may create/update only their own non-authoritative profile fields.
- Deny client writes to authorization claims, batch roles, membership status, payment permissions, or platform flags.

### `batches/{batchId}`

- Read: active batch members, Coordinators, and Super Admin.
- Create/update/delete: Super Admin only, preferably through a trusted backend operation.
- Client cannot alter `schoolId`, `passingYear`, owner, or platform status after creation.

### `batches/{batchId}/memberships/{uid}`

- Read: active batch members may read membership data needed for the directory; pending users may not read the member list.
- Create/update/delete: Super Admin and Coordinators through controlled operations.
- A Coordinator may not grant or revoke Coordinator access unless explicitly delegated by Super Admin; pilot default is Super Admin-only role assignment.
- A member cannot change their own `role`, `status`, `approvedBy`, or `approvedAt`.

### `batches/{batchId}/accessRequests/{requestId}`

- Create: authenticated user may create only a request associated with their own `uid` and the target batch.
- Read: requester may read their own request; Coordinator/Super Admin may read requests for their batch.
- Update: requester may update only while pending and only their allowed identity/request fields. Coordinator/Super Admin may approve/reject through trusted operations.
- Delete: Coordinator/Super Admin only, with an audit event.

### `batches/{batchId}/profiles/{uid}`

- Read: active batch members, Coordinators, and Super Admin.
- Create/update: user may write only their own profile and only approved profile fields.
- Coordinator/Super Admin may update operational fields such as house assignment, subject to audit logging.
- Delete/suspend: Coordinator/Super Admin only through a controlled operation.

### `batches/{batchId}/rsvps/{uid}`

- Read: active batch members, Coordinators, and Super Admin.
- Create/update: member may write only their own RSVP before the configured cutoff.
- After cutoff: member writes are denied; Coordinator/Super Admin may reopen or update through a trusted operation.
- A member cannot write `updatedBy` as another user, alter cutoff configuration, or alter another member’s RSVP.
- Validate attendance enum, non-negative adult/child counts, food preference enum, boolean hotel requirement, and bounded miscellaneous text.

### `batches/{batchId}/posts/{postId}`

- Read: active batch members, Coordinators, and Super Admin.
- Create: active member may create a post only with `authorUid == request.auth.uid` and a valid batch ID.
- Update/delete: author may update/delete their own post; Coordinator/Super Admin may moderate or remove any post.
- Immutable fields: `batchId`, `authorUid`, `createdAt`.
- Validate caption length, media references, album membership, and server timestamps.

### Comments, likes, albums, and reports

`posts/{postId}/comments/{commentId}`:

- Active members may create comments as themselves and delete their own comments.
- Coordinator/Super Admin may remove or hide any comment.
- Immutable fields include `authorUid`, `postId`, and `createdAt`.

`posts/{postId}/likes/{uid}`:

- Active members may create/delete only the like document whose ID equals their own UID.
- Like counts should be maintained transactionally or treated as derived data; clients must not arbitrarily set counters.

`albums/{albumId}`:

- Active members may read.
- Author/owner may create and edit their own album; Coordinator/Super Admin may manage all albums.
- Media membership changes must validate the referenced batch and post ownership.

`reports/{reportId}`:

- Active members may create only a report authored by themselves.
- Reporter may read their own report status; Coordinator/Super Admin may read and resolve reports.
- Report resolution fields are Coordinator/Super Admin-only and audit logged.

### Payment data

`batches/{batchId}/paymentConfig/current`:

- Read: active batch members may read non-sensitive payment instructions such as QR path, UPI ID, and current configured amount.
- Write: Coordinator/Super Admin only; validate INR amounts, UPI format, and Storage path ownership.

`batches/{batchId}/paymentClaims/{claimId}`:

- Create: active member may submit a claim only through a trusted callable/backend operation. The submitted `memberUid` must equal the authenticated UID.
- Read: Coordinator/Super Admin only. Batchmates cannot read stored claims, including their own claim after submission.
- Update: Coordinator/Super Admin only for status, review fields, rejection reason, and evidence metadata.
- Client cannot write `status`, `reviewedBy`, `reviewedAt`, or aggregate fields.
- Required submission fields are UTR, amount, payment date, and member UID. Validate amount bounds and UTR length/format.

`batches/{batchId}/fundSummary/public`:

- Read: active batch members, Coordinators, and Super Admin.
- Write: trusted backend only after verified payment or approved expense changes.
- Deny all direct client writes.

### Expenses and receipts

`batches/{batchId}/expenses/{expenseId}`:

- Read: active batch members may read approved expenses only; Coordinator/Super Admin may read all states.
- Create/update/delete: Coordinator/Super Admin only.
- Draft, rejected, vendor details, notes, and unapproved metadata remain Coordinator-only unless explicitly approved.
- Approved expense changes must update the aggregate fund summary through trusted code.

### Configuration, announcements, and audit

- Reunion configuration, schedule, contacts, announcements, and RSVP cutoff: Coordinator/Super Admin write; active members read published records.
- `auditEvents/{eventId}`: Coordinator/Super Admin may read according to operational need; client writes are denied. Trusted backend creates immutable audit events.
- Audit events must record actor UID, batch ID, action, target path/type, timestamp, and outcome without copying sensitive payment evidence into logs.

## Storage Rules requirements

Expected paths:

```text
batches/{batchId}/profiles/{uid}/avatar/{file}
batches/{batchId}/posts/{postId}/media/{file}
batches/{batchId}/albums/{albumId}/media/{file}
batches/{batchId}/payments/{claimId}/evidence/{file}
batches/{batchId}/expenses/{expenseId}/receipts/{file}
batches/{batchId}/reunion/qr/{file}
```

- Profile/post/album uploads: active batch members may upload only to their own authorized creation flow; Coordinators/Super Admin may moderate/remove.
- Payment evidence and unapproved receipts: Coordinator/Super Admin read/write only.
- Approved expense receipts: active batch members may read; only Coordinator/Super Admin may write/delete.
- Reunion QR: active members may read; Coordinator/Super Admin may replace.
- Validate content type and size in Storage Rules and again in backend processing. Recommended pilot limits: photos 20 MB; videos 250 MB and 5 minutes; formats JPG, PNG, HEIC, WebP, MP4, MOV.
- Do not expose permanent public download URLs for private media. Use authenticated Firebase access or short-lived authorized downloads.
- Reject paths where the supplied batch ID does not match the document/binding being uploaded.

## Trusted backend operations

Implement these as callable Cloud Functions or equivalent authenticated backend endpoints:

1. `approveMembership` / `rejectMembership`
2. `assignCoordinator`
3. `reopenRsvp`
4. `submitPaymentClaim`
5. `reviewPaymentClaim`
6. `approveExpense` / `rejectExpense`
7. `rebuildFundSummary`
8. `moderateContent`
9. `writeAuditEvent`

Each operation must re-check the caller’s batch role, validate the request, write only allowed fields, and create an audit event for material changes.

## Rules test matrix

Before staging data is used, automated Emulator Suite tests must verify at minimum:

- Unauthenticated user cannot read any private batch document or Storage object.
- Pending user cannot read member directory, profiles, RSVPs, posts, payments, or expenses.
- Batchmate can read approved private content but cannot read payment claims/evidence.
- Batchmate cannot edit another member’s profile, RSVP, post, comment, or like.
- Batchmate cannot bypass the RSVP cutoff or reopen an RSVP.
- Batchmate cannot write a verified payment status or fund summary.
- Coordinator can approve membership, verify/reject payments, manage expenses, and moderate content only within their batch.
- Coordinator cannot assign another Coordinator unless the Super Admin operation permits it.
- Super Admin can assign the Coordinator and configure the batch.
- Cross-batch reads and writes fail even when the user is an active member of a different batch.
- Payment evidence and unapproved receipts are inaccessible to Batchmates.
- Approved expenses and aggregate fund summary are readable to active Batchmates.
- Oversized, invalid-MIME, or path-mismatched uploads fail.
- Deleted/suspended members lose private access immediately after their membership status changes.

## Pre-production gates

- [ ] Rules are deployed first to a Firebase staging project.
- [ ] Emulator tests cover the complete matrix above.
- [ ] No production payment evidence or real member media is used in development.
- [ ] Super Admin bootstrap procedure is documented and tested.
- [ ] Firebase project ownership, billing, backups, and incident contacts are recorded privately.

