# Super Admin Governance — Phase 2 Operations

## Audit retention and legacy backfill

`executeAuditRetention` is a system-only scheduled Cloud Function. It runs daily at 03:30 and removes up to 250 `auditEvents` records whose server-created `createdAt` is at least 24 months old. It uses the Admin SDK, so browser clients cannot create, modify, read, or delete audit records.

New Coordinator role-change records also receive `retentionUntil` at creation. Existing audit records are intentionally not rewritten: the scheduled deletion uses their authoritative `createdAt` timestamp, which applies the same 24-month policy to legacy records without fabricating a migration timestamp. The first production deploy is the backfill activation point; each daily run processes the next bounded legacy batch until no eligible record remains.

Before deployment, verify that historical audit records have valid `createdAt` timestamps. Records without one must be reviewed by an operator and either assigned their original event time through trusted Admin tooling or removed according to the incident-retention policy; the application must never infer it from user data.

## Data access

`listGovernanceMembers` and `listGovernanceAuditEvents` require the Firebase ID-token `superAdmin === true` claim, App Check in production, and their own durable rate limits. Display names and emails are returned only by the authorized directory callable. Audit records contain UIDs and governance metadata—not display names, emails, or other copied PII.
