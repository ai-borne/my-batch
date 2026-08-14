# Ajinkyans — Pilot Permission and Visibility Matrix

This matrix is the authorization reference for the Ajinkyans 2002 pilot MVP. UI visibility is not authorization; Firebase Authentication, Firestore Security Rules, Storage Rules, and trusted backend functions must enforce these permissions.

## Roles

| Role | Scope | Description |
|---|---|---|
| Super Admin | Platform | Provisions and revokes Coordinator access, owns Firebase/platform administration, and collects the platform usage charge. It has no batch operational or private-content access and cannot hold a Coordinator membership. |
| Coordinator | Batch | Runs membership approval, reunion operations, payment verification, expenses, announcements, and moderation. |
| Batchmate | Batch | Approved member who can use private community features and submit their own content/RSVP/payment claims. |
| Pending user | None | Authenticated user awaiting membership approval; cannot read private batch data. |

## Access rules

| Capability / data | Public | Pending user | Batchmate | Coordinator | Super Admin |
|---|---:|---:|---:|---:|---:|
| Landing page and public product identity | Read | Read | Read | Read | Read |
| Private batch content | No | No | Read | Read/write | No |
| Access request | Create own | Create/update own request | No longer needed | Read/approve/reject | No |
| Member directory and profiles | No | No | Read | Read; manage house assignment only | No |
| Own profile | No | No | Read/write own | Read/write own | No |
| Another member’s profile | No | No | Read | Read | No |
| Houses and house membership | No | No | Read | Manage | No |
| Reunion configuration | No | No | No | Read/write | No |
| Own RSVP | No | No | Create/read/update own until cutoff | Read/update/reopen | No |
| Other members’ RSVP details | No | No | Read | Read/write | No |
| Memories/posts | No | No | Read/create own/update/delete own | Read/create/update/delete/moderate | No |
| Comments/likes | No | No | Create/read; delete own | Read/delete/moderate | No |
| Reports | No | No | Create own report | Read/resolve | No |
| Aggregate payment progress | No | No | Read | Read/write via trusted workflow | No |
| Own payment claim/evidence | No | No | Submit UTR, amount, and date only; do not read stored claim | Read/write/verify/reject | No |
| Other members’ payment status, UTRs, screenshots | No | No | No | Read/write | No |
| Expenses and approved receipts | No | No | Read | Read/write | No |
| Draft/unapproved expense evidence | No | No | No | Read/write | No |
| Announcements/notifications | No | No | Read | Create/manage | No |
| Role assignment | No | No | No | No | Assign/revoke Coordinator role |
| Batch creation/settings | No | No | No | No | Platform bootstrap only |
| Export ledger/CSV | No | No | No | Allowed | No |

## Required authorization invariants

- Every private document must be scoped to a batch and checked against an active membership.
- `Super Admin` is identified by a server-controlled allowlist/custom claim, not by a client-editable profile field.
- Coordinator access is batch-specific and is granted by the Super Admin to a Gmail-authenticated user; do not authorize by email string alone after account creation—store the resolved Firebase `uid`.
- A Batchmate may write only their own profile, RSVP, posts, comments, likes, reports, and payment submission request.
- A member must not read payment claims, UTRs, screenshots, or individual payment status, including their own stored evidence, after submission.
- Aggregate financial totals must be written by a trusted backend transaction/function; clients must not increment totals directly.
- Storage paths for payment evidence must be Coordinator-only. Media uploads must require an active batch membership.
- Coordinator actions that approve/reject membership, verify/reject payments, change roles, moderate content, or delete records should create an audit event.
- Public routes must not expose member-directory, RSVP, memory, payment, or Storage URLs.

## Decisions still needed before writing production rules

- [x] A Super Admin cannot also be represented as a Coordinator in this batch.
- [x] Coordinators may manage a member's house assignment only; they cannot edit another member's profile fields.
- [ ] Exact audit-log retention period.
- [x] Upload limits and allowed MIME types: photos up to 20 MB; videos up to 250 MB and 5 minutes; JPG, PNG, HEIC, WebP, MP4, and MOV.
