# Super Admin Governance — Phase 5 Operations and Release Gate

This procedure is intentionally non-secret. Keep project IDs, administrator email addresses, credential locations, incident contacts, approval records, and audit exports only in the private operator record.

## Trusted offline Super Admin provisioning and revocation

Only a trusted operator using Firebase Admin credentials outside this repository may set the `superAdmin` custom claim. Never grant Super Admin through the browser, Firestore Rules, a Firestore console edit, or an in-app flow.

1. Verify the target Google account and the intended Firebase project using an independent, approved operator channel.
2. Authenticate the operator workstation with least-privilege Application Default Credentials for that project. Do not save credentials in this repository or shell history.
3. From the tested release commit, run `node scripts/set-super-admin-claim.mjs grant <email> --confirm-super-admin-claim` or `node scripts/set-super-admin-claim.mjs revoke <email> --confirm-super-admin-claim`.
4. Record the operator, target UID, action, project, time, approval reference, and command result in the private operator record. Do not record credentials or unnecessary personal data.
5. Force a fresh ID token by signing out and back in, or by calling `getIdToken(true)`. Claim changes do not affect an already-issued token immediately.
6. For a revocation, verify that `/super-admin` is denied after token refresh and that governance callables reject the former administrator. Remove any unrelated Firebase/IAM access separately; this claim procedure does not manage IAM.

The script looks up the account by email, preserves unrelated custom claims, and changes only `superAdmin`. Its explicit confirmation flag prevents an accidental invocation, but it is not a substitute for operator approval.

## Coordinator offboarding

Use the Super Admin console to revoke the Coordinator role with a factual business reason. The callable records the immutable governance audit event. Have the former Coordinator refresh their token/session and verify that the Coordinator route redirects and protected callable actions are denied. Do not suspend membership, alter member code or approval state, change finance records, or modify content permissions as part of a Coordinator-only offboarding unless a separately authorized procedure requires it.

## Audit-log review and retention verification

Review governance events at least monthly and after every role change or incident. Filter by coordinator assignment/revocation, actor UID, target UID, and time window; reconcile each event with the private approval record. Escalate an unmatched, unexpected, or missing event under the incident process.

`executeAuditRetention` runs daily at 03:30, deletes audit events whose centralized `retentionUntil` has elapsed in 250-document batches until none remain, and logs its deletion count. Each quarter, confirm scheduled invocation success, no repeated errors, the configured 24-month retention deadline, and that all eligible records are removed. Records missing `retentionUntil` require trusted operator review; do not invent a deadline from member data.

## Incident response

For a suspected unauthorized Super Admin claim, Coordinator grant, audit-access issue, or data exposure: acknowledge via the private escalation path; preserve redacted Cloud Logging and audit references; revoke the affected Super Admin claim and Coordinator role where appropriate; refresh/revoke compromised sessions; remove unrelated IAM access; notify the product owner; and record scope, remediation, and follow-up privately. Do not copy credentials, payment evidence, private content, or full personal data into logs or incident notes.

## Rollback

Deploy only an already-tested prior release commit. Before rollback, take a private backup and capture the current deployed revision. Redeploy the prior Functions, Firestore Rules, Storage Rules, and web application together, then run the Super Admin and Coordinator smoke checks. A rollback never restores or edits audit events through a browser client. If the incident concerns authorization, revoke affected claims/roles first; code rollback alone does not invalidate tokens or IAM permissions.

## Deployment checks

Before production deployment, record passing results against the exact commit for `npm run build`, `npm test`, `npm run test:architecture`, `npm run release:controls`, `npm run test:rules`, `npm run test:functions`, and `npm run test:e2e`. Confirm the production deployment uses the tested Firebase project, that only least-privilege operators hold administration access, and that a private backup/isolated restore and alert-routing check are evidenced.

Production App Check is enforced for callables outside the Functions emulator. This is intentionally stricter than the Phase 5 plan's conflicting monitor-only wording: Phase 2 and the repository-wide callable security baseline require enforcement, and the implementation and tests already use that safer control. Validate App Check traffic in staging before release; do not weaken production authorization to satisfy a monitoring exercise.

Deployment remains blocked until the private operator record contains these approvals and operational results. Repository tests cannot prove production deployment, real-traffic App Check observations, backup restore, alert delivery, or Firebase/IAM ownership.
