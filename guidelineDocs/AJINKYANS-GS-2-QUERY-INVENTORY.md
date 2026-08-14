# GS-2 query and operational inventory

All private reads are scoped by the `batches/{batchId}` path and use `limit(25)` with a Firestore document cursor. The client exposes a continuation only after a full page; an empty or partial page is the terminal state.

| Owner/view | Collection and filter | Order/cursor | Page size | Index |
| --- | --- | --- | --- | --- |
| Directory | `profiles`, optional `houseId` | display name / document cursor | 25 | single-field |
| Archive | `posts`, `status=visible` | `createdAt desc` / document cursor | 25 | posts status+createdAt |
| Comments | post `comments`, `status=visible` | `createdAt desc` / document cursor | 25 | comments status+createdAt |
| Notifications | own notification items | `createdAt desc` / document cursor | 25 | single-field |
| Member finance | `expenses`, `status=approved` | `expenseDate desc` / document cursor | 25 | expenses status+expenseDate |
| Coordinator payments/expenses/members | respective batch collection | newest document cursor | 25 | single-field |
| Coordinator requests/reports | `status=pending/open` | `createdAt desc` / document cursor | 25 | accessRequests/reports composite |

Media authority and limits: Storage Rules reject unsupported types and oversized bytes; `addArchiveMedia` verifies the object’s path, metadata, magic bytes, owner, maximum 20 media items, 20 MB images, 250 MB videos, five-minute videos, and 8,000-pixel image dimensions before publishing derivative paths. Post/album delete and daily retention/orphan cleanup remove source and derivative objects. No telemetry payload accepts text, identifiers, storage paths, receipts, UTRs, or personal data.

Cost ceilings require staging configuration before launch: Firestore reads 100,000/day, Storage 50 GB/month, Functions 20,000 invocations/day. Alerts must trigger at 80%, route to the primary and backup operations owners, be acknowledged within four business hours, and contain only service, metric, threshold, and correlation ID. Mitigation: turn off noncritical pagination affordances, suspend media upload, then investigate redacted telemetry.
