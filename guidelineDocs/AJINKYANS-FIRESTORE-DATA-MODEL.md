# Ajinkyans — Firestore Data Model (Pilot MVP)

This is the initial batch-scoped model for the Ajinkyans 2002 pilot. It keeps the pilot simple while preserving the school → batch → membership hierarchy needed for later batches.

## Modeling principles

- Use Firebase Auth `uid` as the identity key; Gmail is used for sign-in and admin assignment, not as the primary document key.
- Put all private community records under a batch or include an immutable `batchId` that Security Rules validate. A practical pilot ID is `batch-2002-3711`, with `schoolId: "3711"` and `passingYear: 2002` stored as separate fields.
- Prefer predictable document IDs for one-per-member records such as membership and RSVP.
- Keep payment evidence in Firebase Storage and store only metadata/reference paths in Firestore.
- Treat aggregate finance summaries as derived data maintained by trusted backend code.
- Store timestamps as Firestore `Timestamp` values and record `createdAt`, `updatedAt`, and actor IDs on mutable operational records.

## Collection layout

```text
users/{uid}
schools/{schoolId}
schools/{schoolId}/batches/{batchId}
batches/{batchId}
batches/{batchId}/memberships/{uid}
batches/{batchId}/houses/{houseId}
batches/{batchId}/profiles/{uid}
batches/{batchId}/accessRequests/{requestId}
batches/{batchId}/reunion/config
batches/{batchId}/reunion/schedule/{eventId}
batches/{batchId}/reunion/contacts/{contactId}
batches/{batchId}/rsvps/{uid}
batches/{batchId}/posts/{postId}
batches/{batchId}/posts/{postId}/comments/{commentId}
batches/{batchId}/posts/{postId}/likes/{uid}
batches/{batchId}/albums/{albumId}
batches/{batchId}/reports/{reportId}
batches/{batchId}/paymentConfig/current
batches/{batchId}/paymentClaims/{claimId}
batches/{batchId}/fundSummary/public
batches/{batchId}/expenses/{expenseId}
batches/{batchId}/announcements/{announcementId}
batches/{batchId}/auditEvents/{eventId}
```

The application uses `batches/{batchId}` as the canonical path. A school directory/index may reference the batch, but application reads and writes are batch-scoped.

## Core document shapes

### `users/{uid}`

```ts
{
  displayName: string,
  email: string,
  photoURL?: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

Do not store authorization in a client-editable `isAdmin` field.

### `batches/{batchId}`

```ts
{
  schoolId: "3711",
  batchId: "batch-2002-3711",
  name: "Ajinkyans 2002",
  schoolName: "Sainik School Satara",
  passingYear: 2002,
  timezone: "Asia/Kolkata",
  reunionStartDate: Timestamp,
  reunionEndDate: Timestamp,
  status: "pilot" | "active" | "archived",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### `memberships/{uid}`

```ts
{
  uid: string,
  batchId: string,
  role: "batchmate" | "coordinator",
  status: "pending" | "active" | "suspended" | "removed",
  houseId?: string,
  approvedBy?: string,
  approvedAt?: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

Super Admin assignment is stored in a server-controlled configuration/claim plus an audit event. Do not allow a member to set their own role.

### `profiles/{uid}`

```ts
{
  uid: string,
  displayName: string,
  avatarPath?: string,
  houseId?: string,
  city?: string,
  profession?: string,
  about?: string,
  favouriteSchoolMemory?: string,
  teacherOrActivity?: string,
  socialLinks?: { linkedin?: string, instagram?: string },
  updatedAt: Timestamp
}
```

### `rsvps/{uid}`

```ts
{
  uid: string,
  batchId: string,
  attendance: "yes" | "no" | "maybe",
  accompanyingAdults: number,
  accompanyingChildren: number,
  foodPreference: "vegetarian" | "nonVegetarian" | "notSpecified",
  hotelRequired: boolean,
  miscellaneousDetails?: string,
  submittedAt?: Timestamp,
  updatedAt: Timestamp,
  updatedBy: string,
  reopenedBy?: string,
  reopenedAt?: Timestamp
}
```

The active RSVP cutoff belongs in `reunion/config`; rules/functions must enforce it. Coordinators may reopen an individual RSVP through a trusted operation.

### `paymentConfig/current`

```ts
{
  defaultFamilyAmountPaise: number,
  currency: "INR",
  upiId: string,
  qrStoragePath: string,
  accountLabel?: string,
  rsvpCutoffAt?: Timestamp,
  updatedBy: string,
  updatedAt: Timestamp
}
```

The amount is a configurable starting estimate (currently ₹30,000 per family), not a hard-coded business constant.

### `paymentClaims/{claimId}`

```ts
{
  batchId: string,
  memberUid: string,
  familyAmountPaise: number,
  amountPaise: number,
  status: "unpaid" | "submitted" | "underReview" | "verified" | "rejected",
  utr: string,
  paymentDate: Timestamp,
  paymentMethod: "upi",
  screenshotStoragePath?: string,
  rejectionReason?: string,
  submittedAt?: Timestamp,
  reviewedBy?: string,
  reviewedAt?: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

Claims and screenshot metadata are Coordinator-only after submission. A member submits the UTR, amount, and payment date through a callable function or protected endpoint; the resulting claim populates the Coordinator payment screen. The client does not write arbitrary status or verification fields.

### `fundSummary/public`

```ts
{
  targetPaise: number,
  collectedPaise: number,
  verifiedFamilyCount: number,
  verifiedPaymentCount: number,
  expensePaise: number,
  balancePaise: number,
  updatedAt: Timestamp
}
```

This document contains aggregate data only and is readable by active batch members. Update it transactionally after payment verification and expense approval.

### `expenses/{expenseId}`

```ts
{
  category: string,
  amountPaise: number,
  vendor: string,
  expenseDate: Timestamp,
  receiptStoragePath?: string,
  notes?: string,
  status: "draft" | "approved" | "rejected",
  createdBy: string,
  approvedBy?: string,
  approvedAt?: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

Approved expense summaries and receipts are readable by active batch members. Draft/rejected records and any sensitive receipt metadata remain Coordinator-only unless explicitly approved.

## Storage paths

```text
batches/{batchId}/profiles/{uid}/avatar/*
batches/{batchId}/posts/{postId}/media/*
batches/{batchId}/albums/{albumId}/media/*
batches/{batchId}/payments/{claimId}/evidence/*
batches/{batchId}/expenses/{expenseId}/receipts/*
batches/{batchId}/reunion/qr/*
```

All uploads require authentication, active batch membership, MIME/size validation, and a server-generated path. Payment evidence and unapproved receipts are Coordinator-only.

## Required indexes and backend operations

- Membership by `status`, `houseId`, and `displayName` lookup strategy.
- Posts by `createdAt` and optional `albumId`.
- Payment claims by `status`, `memberUid`, and `updatedAt` (Coordinator-only).
- Expenses by `status` and `expenseDate`.
- Access requests by `status` and `createdAt`.

Trusted backend operations should handle: approving membership, assigning Coordinator role, enforcing/reopening RSVP cutoff, creating payment claims, changing payment status, updating aggregate fund summary, approving expenses, and writing audit events.

## Open implementation decisions

- [x] Use top-level `batches/{batchId}` as the canonical application path; use an immutable ID such as `batch-2002-3711`, with `schoolId: "3711"` and `passingYear: 2002` fields.
- [x] Members submit UTR, amount, and payment date; the claim populates the Coordinator screen. No member-facing payment claim/history view is required.
- [x] Approved expenses and receipts are visible to all active batch members; drafts/unapproved records remain Coordinator-only.
- [x] Pilot upload limits: photos up to 20 MB, videos up to 250 MB and 5 minutes; accepted formats JPG, PNG, HEIC, WebP, MP4, and MOV.
