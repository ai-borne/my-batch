# Ajinkyans — Phase 7 staging operations and release controls

This is a non-secret operating procedure. Enter names, project IDs, domains, alert destinations, backup locations, and credentials only in the private operator record. Do not paste them into this repository, issues, browser logs, or release notes.

## Staging-only configuration

Before deploying the release candidate, the operator must record evidence that:

- the Firebase project is a separate staging project with staging-only Google identities and no production export/import source;
- Google Authentication, Firestore, Storage, Cloud Functions, and Firebase App Check are enabled for the staging project;
- the staging web configuration has `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`, while the deployed client proves App Check token issuance and callable enforcement;
- Cloud Logging receives Cloud Functions runtime logs and `auditEvents` records material Coordinator actions without UTRs, payment evidence, media bytes, credentials, or private message bodies;
- a Cloud Logging alert routes Cloud Function errors to the private on-call escalation contact, and an intentional non-production test event is delivered and acknowledged; and
- all staging data is synthetic. Seed only with the guarded command below; do not use production accounts, payments, media, exports, or credentials.

```sh
AJINKYANS_DEPLOYMENT_ENV=staging AJINKYANS_STAGING_PROJECT_ID='your-staging-project' AJINKYANS_STAGING_BATCH_ID='batch-2002-3711' npm run seed:staging -- --confirm-demo-seed
```

## Private operator record

The release owner must maintain an access-controlled private operator record with an owner, backup contact, and last-verified date for each of these items:

| Item | Required evidence |
|---|---|
| Firebase, domains, DNS, source control, and billing | Account owner, least-privilege administrators, recovery contact, and renewal/billing owner |
| Credentials and App Check | Storage location, rotation owner, recovery procedure, and confirmation that no secret is committed |
| Escalation and incident response | WhatsApp escalation contact, on-call recipient, severity definitions, acknowledgement target, and incident communication owner |
| Launch inputs | Administrators, schedule/logistics, UPI/account details and contribution heads, archive categories, branding, device baseline, and storage/cost ceiling |

## Staging verification checklist

The release owner records the date, operator, staging project alias, release commit, result, and redacted evidence reference for every item below.

- [ ] Run `npm run build`, `npm test`, `npm run test:rules`, `npm run test:e2e`, and `npm run release:controls` from the release commit.
- [ ] Complete staging smoke journeys for unauthenticated, pending, active batchmate, Coordinator, and Super Admin roles. Include cross-batch denial, access request/approval, profile, RSVP, payment claim/review, archive/report/moderation, notification, and sign-out flows.
- [ ] Deliver and acknowledge a non-production alert. Confirm its payload contains no secret or personal financial data.
- [ ] Export Firestore to a private, access-controlled backup location. Restore it only into a new isolated restore project, never staging or production.
- [ ] Compare source and isolated restore collection/document counts. Test active-member access, pending-user denial, Coordinator-only payment evidence, and cross-batch denial in the restored project.
- [ ] Record restore duration, recovery gaps, and cleanup of the isolated restore project under the retention policy.
- [ ] Complete the formal Phase 7 security review and resolve every high or critical finding before release approval.

## Incident response minimum

For a suspected access-control, credential, data-loss, payment-evidence, or moderation incident: acknowledge through the private escalation path; preserve relevant redacted log/audit references; contain access using the least disruptive safe action; notify the product owner; record impact, remediation, and follow-up; and rotate credentials where exposure is suspected. Never place affected members' personal or payment data in the incident record.

## Status

The repository controls are ready for review. Phase 7 remains blocked pending the private staging, alert-delivery, backup/isolated-restore, ownership, and smoke-test evidence listed above.
