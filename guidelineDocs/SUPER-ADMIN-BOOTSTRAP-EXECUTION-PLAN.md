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
