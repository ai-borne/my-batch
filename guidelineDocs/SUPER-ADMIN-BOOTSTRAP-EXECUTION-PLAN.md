# Super Admin Coordinator Bootstrap — Phase 1 Record

## Query and data decisions

- Candidate pages query `accessRequests` by `status == pending`, then ascending `createdAt`, then document ID. The cursor contains both the timestamp in milliseconds and the request ID; malformed cursors are rejected.
- Legacy pending requests without a Firestore `createdAt` do not appear in this stable ordered query. They must be backfilled with their original request time before they can be selected; this is intentional rather than silently providing an unstable page.
- The transaction queries active memberships with `status == active` and `role == coordinator`, limited to one. Memberships remain the source of truth; no coordinator-count document exists.
- Bootstrap candidates return only request ID, display name, roll number, and house ID. They do not read user records or return email.

## Retention and idempotency

- `membership.bootstrapCoordinatorApproved` stores actor and target UIDs, batch ID, outcome, role transition, server timestamp, business reason, and the centralized 24-month `retentionUntil` value.
- The scheduled audit-retention job deletes every eligible event by `retentionUntil`, in 250-document batches until none remain.
- Bootstrap operation results are scoped to the Super Admin, batch, and operation ID. Retrying an acknowledged-or-uncertain successful operation returns its saved result.

## Phase 3 verification record

- Firestore Rules remain unchanged: pending applicants cannot read private batch data, and a Super Admin claim grants neither direct batch access nor direct access-request reads. Bootstrap candidates are available only through the trusted `listBootstrapCandidates` callable.
- Emulator integration tests assert that the candidate response has exactly `requestId`, `displayName`, `rollNumber`, and `houseId`; it does not expose user-profile fields such as email. They also prove that a Coordinator created by bootstrap immediately uses the ordinary `approveMembership` callable to approve the next applicant.
- The callable implementation uses shared `secureCall` App Check enforcement, payload/cursor validation, minimal response projection, durable operation idempotency, recent-authentication checks, retention-bound audit events, and sanitized error logging. No function logs request payloads or candidate data.
- Staging verification completed on the deployed `my-batch-staging` revision: the registered reCAPTCHA Enterprise web app was deployed before Functions enforcement, and both `bootstrapCoordinator` and `listBootstrapCandidates` are active with `FUNCTIONS_ENFORCE_APP_CHECK=true`. Direct callable requests without an App Check token returned HTTP 401 / `UNAUTHENTICATED` for both endpoints. Live browser-token observation was not available in this session; perform that normal-client smoke check during Phase 4 release validation.
