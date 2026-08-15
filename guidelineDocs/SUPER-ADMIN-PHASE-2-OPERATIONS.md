# Super Admin Governance — Phase 2 Operations

## Audit retention and legacy backfill

`executeAuditRetention` is a system-only scheduled Cloud Function. It runs daily at 03:30 and removes every eligible `auditEvents` record in 250-document batches, continuing until none remain. Eligibility is the centralized `retentionUntil` timestamp set when a retention-bound governance event is created. It uses the Admin SDK, so browser clients cannot create, modify, read, or delete audit records.

New Coordinator role-change and bootstrap-approval records receive `retentionUntil` at creation. Existing audit records without that field are intentionally not rewritten: an operator must assign the original event time through trusted Admin tooling and derive the approved retention deadline, or remove the record under the incident-retention policy. The application never infers that deadline from user data.

Before deployment, verify that historical audit records have a valid `retentionUntil`. Records without one must be reviewed by an operator and either receive the approved retention deadline through trusted Admin tooling or be removed according to the incident-retention policy; the application must never infer it from user data.

## Data access

`listGovernanceMembers` and `listGovernanceAuditEvents` require the Firebase ID-token `superAdmin === true` claim, App Check in production, and their own durable rate limits. Display names and emails are returned only by the authorized directory callable. Audit records contain UIDs and governance metadata—not display names, emails, or other copied PII.
