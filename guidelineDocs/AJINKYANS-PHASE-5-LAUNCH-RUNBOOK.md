# Ajinkyans — Phase 5 Pilot and Launch Runbook

This runbook is intentionally non-secret. Project IDs, administrator identities, backup locations, recovery contacts, and launch approval remain in the private operator system.

## Release success criteria

The pilot is ready for wider release only when all of the following are evidenced in the release record:

- `npm run build`, `npm test`, `npm run test:rules`, and `npm run test:e2e` pass against the release commit.
- The staging PWA installs on Android Chrome and iOS Safari, works after one online visit with the network disabled, and never displays cached private data after sign-out.
- Keyboard-only use, 200% zoom, mobile Chrome, and mobile Safari are checked for the landing, access request, profile, RSVP, payment claim, archive upload, report, and Coordinator paths.
- A backup is created, restored into an isolated Firebase project, and its document count and sampled access controls match staging.
- The security review in `AJINKYANS-PHASE-5-SECURITY-REVIEW.md` has no unresolved high or critical finding.
- 10–15 approved pilot members complete the agreed journeys; launch owner records all priority defects and accepts their resolution or explicitly defers them.
- The launch owner explicitly approves production release.

## Staging seed and pilot

## UX-0 launch-content checklist

The Coordinator product owner is the Coordinator recorded in the private operator release record. Their identity is intentionally not committed here, because this repository must not contain member or operator PII. This is the source-of-truth conflict with the redesign plan's request to name the owner in-repository; the private release record takes precedence.

Before a pilot invite, that owner must confirm all of the following are present in staging:

- Six complete house records, each with its presentation data.
- Display names and approved avatars where available.
- 10–20 vetted synthetic archive memories across at least one collection.
- Current reunion status, schedule, venue, and approved contact content.
- Current payment instructions, including a safe UPI action and QR reference.
- No real member data, payment identifiers, private media, or credentials in seed data or evidence.

Record completion, date, tested commit, and owner identity only in the private release record.

Authenticate with a staging-only operator account, then seed only synthetic data:

```sh
AJINKYANS_DEPLOYMENT_ENV=staging AJINKYANS_STAGING_PROJECT_ID='your-staging-project' AJINKYANS_STAGING_BATCH_ID='2002' npm run seed:staging -- --confirm-demo-seed
```

The script requires an explicit staging environment declaration, refuses a project ID that does not contain `staging`, requires a confirmation flag, and creates 50 synthetic members plus 30 synthetic records for each paginated list. It does not create Authentication accounts, media, or Coordinator identities. Run `npm run verify:staging-pagination` with the same staging-only variables before inviting pilot members.

## Backup and restore evidence

1. Export the Firestore database to a private, access-controlled Cloud Storage backup location using the Firebase/Google Cloud production runbook. Record the timestamp, source project, encrypted location, operator, and command reference in the private release record—never in this repository.
2. Restore that export into a fresh, isolated Firebase project. Do not restore over staging or production.
3. Compare collection/document counts, then test one active member, one pending user, one Coordinator, and cross-batch denial. Confirm payment evidence remains Coordinator-only.
4. Record a pass/fail result, restoration duration, and recovery gaps. Delete the isolated restore project after evidence is captured under the operator retention policy.

## Production cutover

Configure Google Auth authorised domains, Firebase Rules, Storage Rules, Functions, billing, alert recipients, and recovery contacts privately. Deploy the exact tested commit, take a pre-cutover backup, and retain the release-owner approval. Do not copy staging configuration or synthetic data into production.

## Operational logging

Use Cloud Functions structured logs for runtime failures and `auditEvents` for material Coordinator actions. Route production alerts to the private on-call contact. Logs and audit events must not include UTRs, payment screenshots, media bytes, credentials, or other unnecessary personal data.
