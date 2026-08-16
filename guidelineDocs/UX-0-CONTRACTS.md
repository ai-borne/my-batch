# UX-0 implementation contracts

## Contract ownership

| Domain | Authoritative module | Consumer rule |
| --- | --- | --- |
| Directory query, filters, cursor, and result | `src/lib/directory.ts` | Server calls normalize through this contract; UI never reports client-loaded totals. |
| Display-ready post/comment identity | `src/lib/displayIdentity.ts` | Member views render display identity, never an author UID. |
| Notification destination | `src/lib/notifications.ts` | Destinations are typed internal paths, not arbitrary URLs. |
| Payment-claim recovery | `src/lib/paymentClaim.ts` | A view derives recovery actions from the one presentation mapper. |
| Reunion status | `src/lib/reunionState.ts` | Home and Reunion must use this mapper for CTA, countdown, schedule, notification, and empty state. |

## Reunion decision table

| Status | CTA | Countdown | Schedule | Notify members | Empty copy |
| --- | --- | --- | --- | --- | --- |
| `announced` | Get notified | Hidden | Hidden | Yes | Details will be shared here. |
| `rsvp_open` | RSVP | Visible | Hidden | Yes | — |
| `rsvp_closed` | View details | Visible | Hidden | No | RSVP is closed. |
| `confirmed` | View schedule | Visible | Visible | Yes | — |
| `completed` | View memories | Hidden | Visible | No | The reunion has concluded. |
| `archived` | View memories | Hidden | Visible | No | This reunion is now part of the archive. |

Unknown or missing state falls back to `announced`; no page may invent a date, CTA, or state-specific copy.

## Contract alignment note

The existing Cloud Function persists `underReview` and has no clarification/resubmission transition. UX-0 establishes the approved UI contract as `under_review`, `clarification_required`, and `resubmitted`. UX-4 must align the persisted function contract atomically, with a migration and emulator tests; no view may translate or invent those states before then.

## Visible-copy migration inventory

`src/lib/copy.ts` owns all new visible strings. UX-0 migrated the shared resilience component as the executable pattern. The remaining member-facing literals identified for the next focused migrations are in `App.tsx`, `auth/AccessRequest.tsx`, `batch/BatchShell.tsx`, `HomePage.tsx`, `HousesPage.tsx`, `ReunionPage.tsx`, `FinancePage.tsx`, `MemoriesPage.tsx`, `ProfilePage.tsx`, `NotificationCenter.tsx`, and `CoordinatorPage.tsx`. Existing Super Admin copy is already centralized. This inventory prevents new literals while preserving UX-0's no-unnecessary-runtime-change scope.
