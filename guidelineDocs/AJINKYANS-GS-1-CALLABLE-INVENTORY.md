# GS-1 callable security inventory

All entries use `secureCall`: production App Check is enforced, missing/invalid authentication is denied by the callable or role helper, unexpected failures return a generic error, and the Functions emulator intentionally disables only App Check enforcement. Every limit is a server-only `rateLimits/{batchId}:{uid}:{operation}` record; Firestore Rules deny all client access to that root collection.

## Member operations

| Callable | Actor and batch scope | Validation / state / duplicate handling | Limit and retry | Audit |
| --- | --- | --- | --- | --- |
| `submitRsvp` | Active member, own batch | Bounded RSVP fields; cutoff or explicit reopen; deterministic UID document | 10 / 10 min; retry returns the final RSVP | Not material |
| `submitPaymentClaim` | Active member, own batch | Configured contribution head, bounded UTR/amount/date/path; request ID is claim ID | 4 / 10 min; same key returns the original claim | `payment.submitted` |
| `attachPaymentEvidence` | Active claim owner | Claim must be submitted/under review; exact claim path | 6 / 10 min; safe repeat replaces the same path | Not material |
| `createPost`, `createAlbum`, `saveArchiveComment`, `reportArchiveContent` | Active member, own batch | Bounded content/category/consent; request ID is the created document ID | 10, 10, 20, 10 / 10 min; same key returns the original record | Report handling is audited by moderation; media/post deletion is audited |
| `addArchiveMedia` | Visible post/album owner | Exact storage path, declared metadata and bytes, mime/size/duration limits | 6 / 10 min; verified media is array-unioned | `archive.media.verified` |
| `updateOwnPost`, `manageAlbum`, `deleteOwnPost`, `deleteOwnComment`, `setArchiveLike` | Active owner; Coordinator may manage an album | Owner/status checks; likes use UID document; deleted states are stable | 20, 10, 10, 20, 60 / 10 min; repeat converges safely | Material archive changes are audited |
| `markNotificationsRead` | Active notification owner | 1–50 bounded IDs on caller's notification path | 30 / 10 min; repeat is safe | Not material |
| `requestProfileDataChange` | Active member, own batch | Correction/deletion only; request ID is document ID | 3 / hour; same key is safe | Not material |

## Coordinator and platform operations

| Callable | Actor and batch scope | Validation / state / duplicate handling | Limit and retry | Audit |
| --- | --- | --- | --- | --- |
| `approveMembership`, `rejectMembership` | Active Coordinator in request batch | Pending request only; approval creates active batchmate | 5 / 10 min; completed request is not reapplied | `membership.approved` / `membership.rejected` |
| `manageMembership` | Active Coordinator in member batch | Active→suspended/removed; suspended→active; only active members get houses | 10 / 10 min; matching final state is safe | `membership.*` |
| `reopenRsvp` | Active Coordinator in member batch | Existing member UID only; server sets reopen flag | 10 / 10 min; final flag is safe | `rsvp.reopened` |
| `reviewPaymentClaim` | Active Coordinator in claim batch | Submitted→under review/verified/rejected; under review→verified/rejected; terminal states cannot change | 10 / 10 min; same state creates no duplicate audit/notification | `payment.*` |
| `saveExpense` / `reviewExpense` / `attachExpenseReceipt` / `rebuildFundSummary` | Active Coordinator in batch | Bounded expense fields; request ID is expense ID; draft→approved/rejected only; exact receipt path | 10, 10, 10, 3 / 10 min; replay converges without duplicate creation | `expense.*` / `fundSummary.rebuilt` |
| `moderateArchiveContent`, `cleanupArchiveOrphans` | Active Coordinator in batch | Open report and supported action; cleanup only removes unreferenced 24h-old media | 10 / 10 min, 2 / hour; stable content/report state | `moderation.*` / `archive.orphans.cleaned` |
| `publishAnnouncement` | Active Coordinator in batch | Bounded title/body; request ID is announcement ID and recipient notification IDs are deterministic | 3 / 10 min; retry finishes the same fan-out without duplicate notifications | `announcement.published` |
| `assignCoordinator` | Freshly authenticated Super Admin only | Cannot assign self; target must be active; only a Coordinator may be revoked | 3 / hour; matching role is safe | `coordinator.assigned` / `coordinator.revoked` |

`secureCall` is the SSOT for App Check and error handling. `callablePolicies` in `functions/src/security.ts` is the SSOT for limits, windows, and rationale. Browser clients create a request ID at each durable-create submission and retain the post ID during upload retry; callers should retry a `resource-exhausted` response after its stated window instead of submitting new data.
