# Ajinkyans — Project Source of Truth

> **Status:** distilled from the Ajinkyans product and wireframe conversation.  
> **Purpose:** repository-ready reference for product, design, and implementation work.  
> **Scope rule:** this document records decisions and proposals made in the conversation; it does not create new product commitments.

## 1. Product identity and pilot

**Ajinkyans** is a private, mobile-first digital community, reunion-management space, and permanent memory archive for school or college batches.

The first pilot is **Sainik School Satara — 2002 Batch**, for its **Silver Jubilee Reunion in January 2027**. The registered MVP domains are:

- `ajinkyans.com`
- `ajinkyans.in`

Pilot success is assessed after the reunion, with an initial target of at least 50 participating members and a functioning UPI payment flow.

The immediate experience is for one known batch. The architecture must nevertheless model a reusable platform: school → batch → members → houses, events, memories, collections, and expenses. The long-term positioning is not “another social network”, but a **private digital community + reunion platform + permanent memory archive**.

The intended emotional message is:

> 25 years of brotherhood. One batch. One home. Our memories, preserved.

The core differentiator (the “MOAT”) is the accumulated private photo/video/memory archive and the batch’s shared identity—not generic social functionality.

## 2. Product principles

- Private by default: the member directory, profiles, reunion information, and memories are for approved batch members, not the open web.
- Mobile first: most use is expected from WhatsApp links on phones; design first at approximately 390 × 844, then scale to desktop.
- Content is nostalgic; the interface is modern.
- Keep the MVP deliberately simple; no private messaging in the MVP.
- Make uploading a memory extraordinarily easy; do not burden users with excessive metadata.
- Payments are a **collection and reconciliation workflow**, not a platform-held-money flow in the MVP.
- Make transparency visible at the aggregate level while keeping individual financial details restricted.

## 3. MVP information architecture

### Primary navigation

Mobile has five persistent bottom-navigation items:

1. Home
2. Houses
3. Reunion
4. Memories
5. Account

Desktop uses a top navigation with the same destinations and the signed-in user at the right. The content column is capped at roughly 1200 px; it must not stretch across large displays.

The Reunion tab may carry a subtle badge for important updates. The logo returns to Home. Notifications open a lightweight notification view.

### Public and authenticated surfaces

- `/` — public landing page; product/batch identity and Google sign-in only.
- All community data is private behind authentication and approved batch membership.
- After Google authentication, a person with no membership submits an access request; a person awaiting review sees pending approval; an active member reaches Home.

## 4. Users, membership, and roles

There is no separate admin login or password. Everyone uses **Continue with Google** through Firebase Authentication. The app derives their permissions from their batch-specific membership and role.

### Roles

| Role | Purpose and main capabilities |
|---|---|
| Batchmate | View approved batch content; edit own profile; create own memories; like/comment; RSVP; submit payment details; view aggregate fund transparency. |
| Super Admin | Platform owner: provisions and revokes Coordinator access, owns Firebase/platform administration, and collects the platform usage charge. This role has no batch operational or private-content access. |
| Coordinator | Pilot operations: membership approval, reunion management, payment verification, expenses/receipts, content moderation, and batch administration. |
| Platform Admin | Future technical/platform owner across batches; not a separate role in the Ajinkyans 2002 pilot MVP. |

For the Ajinkyans 2002 pilot MVP, there are no separate Treasurer or Content Moderator permissions. Coordinators handle those responsibilities. The Super Admin cannot also hold a Coordinator membership in this batch. Separate roles may be introduced in a future platform version if needed.

Roles must be **batch-specific**, not a global `isAdmin` flag. A user may be a coordinator in one batch and an ordinary member in another. Admin UI visibility is a convenience only; Firestore/Storage rules must enforce all authorization.

### Join and approval flow

```text
Google OAuth → Firebase Authentication
  → existing user/membership?
    → no membership: access request (name, house, passing year)
    → pending membership: pending-approval screen
    → active membership: Home
```

An unapproved user must not read private batch data.

## 5. Core product areas

### Home

Home is the identity and orientation page:

- Hero image and text: **Sainik School Satara — 2002 Batch** and **25 Years • One Batch**.
- Prominent Silver Jubilee countdown with a link to Reunion.
- Calculated batch statistics (members, houses, geographic reach, etc.).
- “Our Journey” timeline, e.g. joined school, passed out, previous anniversaries, and 2027 Silver Jubilee. On mobile it scrolls horizontally; timeline entries can open a detail sheet. Coordinators may later edit entries.
- Three to five recent memory posts and a link to all Memories.

The hero is identity rather than navigation. On mobile, it should not dominate more than roughly 45–55% of the viewport.

### Houses and member directory

The six house structure is fixed for the pilot:

- **Junior:** Shivaji, Nehru
- **Senior:** Karve, Rana Pratap, Shastri, Tilak

The Houses page groups house cards by Junior and Senior. A house page has a hero, member count, member search, filtering, and a member list. On phones the directory is a compact list; desktop may use a grid.

Each member profile can include an avatar, name, house, city, profession, optional About, favourite school memory, teacher/activity, optional social links, and that member’s posts. Fields are optional and private to the batch. A member can edit their own profile; other members can report a profile/content. Private messaging is explicitly out of MVP scope.

### Reunion hub

`/reunion` is the operational centre for the January 2027 event. It contains:

- reunion hero and countdown;
- the member’s RSVP status;
- Schedule;
- Venue and directions;
- Accommodation;
- Instructions;
- Reunion Fund;
- Who’s Coming;
- Important Contacts.

The RSVP captures Yes / No / Maybe, accompanying adult/child counts, vegetarian/non-vegetarian preference, hotel requirement, and miscellaneous details. It informs coordinator planning and the “Who’s Coming” directory. RSVP details are visible to approved batch members. Coordinators set the RSVP edit cutoff and may reopen an individual RSVP.

Schedule is date-tabbed timeline content; events show time, title, and location, with event detail and an optional Add to Calendar action. Venue should use a static map preview/deep link rather than an unnecessarily expensive embedded map. Instructions are coordinator-managed, document-like content (arrival, dress code, school visit, photography, parking, emergency, etc.).

### Memories (the archive)

Memories is a first-class primary tab, not an afterthought or simply a “feed”. It supports a private, visual archive of old and new photos/videos.

- Tabs: All, Photos, Videos, Albums.
- Members can post multiple photos or video with a caption, optional people tags, and an optional album.
- Post cards show author/avatar/house, media, caption, likes and comment count.
- Interactions: like, comment, report; an author can delete their own post.
- Posts, photos, videos, comments, and likes appear immediately after submission. Coordinators handle reports, flagged content, removals, and appeals; no pre-publication Coordinator approval is required.
- Privacy, consent, retention, takedown, and moderation rules are defined in `guidelineDocs/AJINKYANS-PRIVACY-CONSENT-MODERATION-POLICY.md`.
- Albums are supported for grouping memories such as school trips, sports, NDA, and the 2027 reunion.
- Upload UI must show previews and progress, and warn before abandoning an active upload.
- Post detail shows media, author, caption, likes, and comments.

The initial product discussion also proposed organising the archive by years (1998–2002) and categories such as school, sports, NDA, mess, teachers, trips, pranks, houses, and passing out. Keep this as a content-organisation direction; do not make it a mandatory posting form.

### Account and settings

Account contains profile, memories/posts, payments, theme, notifications, privacy, FAQ, contact admin, and sign-out. The Admin Dashboard entry appears only to users with a matching role.

Theme choices: System, Light, Dark. Changes occur immediately and the preference is persisted locally.

## 6. Collections, direct UPI payment, and transparency

### MVP payment model: direct to the batch coordinator

Ajinkyans does **not** receive or hold reunion money in V1. A batchmate pays directly to the designated **batch coordinator’s/collection account’s UPI ID**. Ajinkyans records the claim, verification, and reporting workflow.

```text
Batchmate → direct UPI payment → Batch Coordinator / designated collection account
           ↓
   submit amount + UTR + payment date in Ajinkyans
           ↓
   Coordinator verifies against the received payment
           ↓
   payment status and aggregate fund reporting update
```

The payment screen must offer **Open UPI App**, **Copy UPI ID**, and **Show QR**. QR is an alternative, not the sole mobile payment route. After paying, the member submits amount, UTR/transaction ID, payment date/method, and an optional screenshot.

Never request, store, or display UPI PINs, bank passwords, card numbers, CVVs, or other banking credentials.

### Payment states

| State | Meaning |
|---|---|
| Unpaid | No payment submitted. |
| Submitted | Member has submitted UTR, amount, and payment date. |
| Under Review | A Coordinator is checking the submitted payment details. |
| Verified | Payment has been matched and approved. |
| Rejected | Claim could not be verified; a reason is recorded and the member can resubmit. |

### Collections and expense transparency

The Reunion Fund page shows a transparent aggregate dashboard: target, amount collected, progress, paid-member count, collection headings, expense categories, and current balance. Individual payment status and evidence are restricted to Coordinators. Members submit UTR, amount, and payment date after scanning the Coordinator’s QR code; the submission populates the Coordinator payment dashboard.

All approved batchmates can see aggregate collection and expense information. **Individual payment status, payment records, UTRs, and screenshots are not visible in the batch-member view**; they are limited to Coordinators.

The data model must support multiple contribution heads, not only a single reunion fee. Conversation examples included reunion contribution, spouse contribution, child contribution, accommodation, T-shirt, and optional donation. This enables a member-level “My Reunion” breakdown and a transparent financial report with collections, expenses, and balance.

House coordinators are not intended to be payment intermediaries. They can act as house ambassadors for reminders, while contributions go centrally to the designated batch coordinator account and are attributed to the correct member.

### Financial administration

Coordinator-facing views support payment search/status, UTR and screenshot review, verify/reject/request clarification, reminder workflow, CSV/ledger export, and expense entry. An expense records category, amount, vendor, date, receipt, and notes. Coordinators manage overall reunion settings, finance, and moderation according to their role.

Coordinators own the reconciliation ledger. They reconcile it daily while contributions are being collected, then weekly after the reunion until accounts are closed.

### Future payment direction (not MVP commitment)

The earlier discussion identified a later “Reunion Treasury” concept where a payment gateway could support more automated allocations/vendor payments, subject to eligibility and compliance. Do not assume that capability for the MVP. The V1 architecture should still model batches, events, collections, payments, and expenses so a later gateway integration is possible.

## 7. Monetisation direction

The pilot should prioritise usefulness and adoption rather than charging the Sainik School Satara 2002 batch or using advertising.

The proposed product business models were:

- Per-batch annual subscription (illustrative discussion range: ₹4,999–₹9,999/year).
- One-time reunion package, then annual archive/community continuity fee (illustrative discussion: ₹7,500 package and ₹2,999/year thereafter).
- Later freemium tiers for large storage, custom domains, advanced reunion tools, archive features, and analytics.

The evolving value proposition is batch-level SaaS: a batch gets a private community, directory, RSVP, payments/collection management, communication, and memory archive. Any processing/service fee must be transparent and only considered if the payment/business model supports it.

## 8. Technical architecture

### Chosen stack

| Layer | Direction |
|---|---|
| Web app | React + TypeScript + Vite + Tailwind CSS |
| Routing/state | React Router; add Zustand only if genuinely needed |
| Frontend hosting | Cloudflare Pages on the Ajinkyans domains |
| Authentication | Firebase Authentication with Google OAuth |
| Primary data | Cloud Firestore |
| Media | Firebase Storage for photos and videos |
| Server-side logic | Firebase Cloud Functions initially; add Cloudflare Workers only for a later, specific edge/API requirement |

Cloudflare’s free hosting is appropriate for the small pilot. Media storage and bandwidth, not static React hosting, should be treated as the likely cost pressure.

Use separate Firebase projects/configuration for local development, staging, and production; production data must never be used for testing. Use Vitest with the Firebase Emulator Suite for unit and security-rule tests, and Playwright for end-to-end tests.

### Multi-batch domain model

Do not hard-code the database around Sainik School Satara 2002. Model a reusable hierarchy:

```text
Platform
  └── School
        └── Batch
              ├── memberships / roles
              ├── houses and member profiles
              ├── reunion events and RSVP
              ├── posts, comments, likes, albums, media
              ├── collections and payment claims
              └── expenses and receipts
```

A user has a profile plus membership records per batch. All user-visible data must be scoped by batch.

### Conceptual data areas

- Users/profiles
- Schools and batches
- Batch memberships and roles
- Houses
- Reunion/event, schedule, venue, instructions, contacts, RSVP
- Announcements and notifications
- Posts, comments, likes, albums, media, reports
- Collections/payment heads, payment claims, verification status
- Expenses, receipts, financial summaries

Exact Firestore collection paths and schemas have not yet been decided.

## 9. Security and privacy requirements

Security is a product requirement from the start because the app handles names, email addresses, photos/videos, reunion information, UTRs, and potentially contact details.

- Use Firebase Google OAuth; do not operate a separate password system.
- Enforce authenticated, approved, batch-scoped access through Firestore Security Rules and Firebase Storage rules.
- Do not rely on hidden React buttons or client-side checks as authorization.
- Restrict writes so members can edit only their own profile and content; Coordinator permissions are role based.
- Storage must not be publicly writable. Uploads require authentication and appropriate batch membership.
- Validate and constrain uploads; account for moderation/reporting and removal of inappropriate content.
- Apply rate limiting/abuse controls especially to sign-in-related operations, posts, comments, uploads, and payment submissions.
- Provide report post/report user, moderation, delete/removal, and basic block capability as discussed.
- Keep profiles and member directory out of public search/indexing. The landing page can identify the community, but private content starts after approval.
- Personal profile fields are optional, with batch-only visibility for optional data.
- Payment evidence is sensitive: restrict UTRs/screenshots to Coordinators; do not expose individual payment details in aggregate dashboards. Approved batch members see aggregate payment progress only.

## 10. PWA and resilience requirements

Ajinkyans will be an installable PWA on iPhone and Android as launch-hardening work after the secure core flows are complete:

- Web App Manifest and app icons.
- HTTPS, splash/theme colours, responsive viewport, and iPhone safe-area support.
- Service worker and versioned caches.
- Offline app shell and previously cached basic content.
- Do not promise the entire social feed or uploads while offline.
- Provide an offline banner and explicit loading, empty, error, permission-denied, and expired-session states.

## 11. Wireframe v1 — layout specification

### Visual direction

Modern, understated, nostalgic, and military-heritage-informed—but not camouflage, military stencil typography, or a corporate dashboard. Use large photography, warm off-white/dark charcoal surfaces, muted olive accents, sparing brass/gold highlights, rounded cards, restrained shadows, and generous whitespace. School/reunion photographs supply most visual richness.

### Principal screens

1. **Landing:** batch image/identity, “25 Years • One Batch”, Continue with Google, privacy note.
2. **Home:** hero, January 2027 countdown, journey timeline, latest batch posts.
3. **Houses:** Junior/Senior house groups and distinctive but restrained house cards.
4. **House detail:** member count, search, compact member list; member opens profile.
5. **Member profile:** photo, identity, house, city/profession, optional About and school-years fields, posts.
6. **Reunion:** countdown, RSVP, schedule, venue/directions, accommodation, instructions, fund, attendee list, contacts.
7. **RSVP and schedule:** RSVP form; date/time event timeline with optional add-to-calendar/reminders.
8. **Fund/payment:** direct UPI instructions/QR, payment-detail submission, personal status, aggregate transparency.
9. **Memories:** visual feed with Photos/Videos/Albums, easy share flow, post detail and album screens.
10. **Account:** profile, posts/memories, payments, theme, notifications, privacy, FAQ, contact admin, sign out, role-gated Admin link.
11. **Admin:** overview metrics plus members, collections, expenses, reunion, content, announcements, settings.

V1 also established design for loading skeletons, empty/error/offline states and mobile-friendly interaction throughout.

## 12. Wireframe v2 — component-level implementation specification

### Layout and design tokens

- Mobile range: 320–767 px; safe area, page header, main content, and bottom navigation.
- Desktop: top nav and central content; max width ~1200 px.
- Typography: Inter primary; optional restrained display serif such as DM Serif Display for hero headings. Do not use military stencil type.
- Use 4/8 px spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Typical card padding: 16 px; typical section spacing: 32 px.
- Radius: 8 px controls, 16 px cards, 20 px hero, 999 px pills.
- Touch targets: minimum 44 × 44 px.

Light semantic palette:

```text
background #F7F5F0   surface #FFFFFF   subtle surface #F0EEE8
primary text #17201C secondary text #69716D border #DFDED8
accent: muted olive; highlight: muted brass
```

Dark semantic palette:

```text
background #0D1110   surface #151A18   elevated #1B211E
primary text #F2F3EF secondary text #A6ADA8 border #2B322E
accent: muted olive; highlight: muted brass
```

Implement semantic tokens (for example `bg-background`, `bg-surface`, `text-primary`, `text-secondary`, `border-default`, `accent`) rather than hard-coded component colours.

### Reusable primitives to build first

```text
AppShell, PageHeader, BottomNav, DesktopNav, Avatar,
Button, IconButton, Card, Badge, Pill, Tabs, SearchInput,
Modal, BottomSheet, Toast, ConfirmDialog, Skeleton,
EmptyState, ErrorState, OfflineBanner, ImageViewer, VideoPlayer,
FileUploader, AvatarUploader
```

Use an application shell composed of desktop navigation, mobile header, main content, mobile bottom navigation, and global toast.

### Screen routes and interactions

| Route | Key components/behaviour |
|---|---|
| `/` | Brand header, hero image, batch/reunion identity, Google login and privacy note. |
| `/home` | Identity hero, automatic countdown linking to `/reunion`, calculated stats, horizontal timeline/detail sheet, 3–5 latest `PostCard`s. |
| `/houses` | `HouseSection` groups with `HouseCard`s for Junior/Senior houses. |
| `/houses/:house` | Back action, house hero/count, member search/filters, member list. |
| `/members/:id` | Profile header/avatar/name/house/location, About, school-memory section, member posts; own profile edit, other profile report. |
| `/account/profile/edit` | Photo, identity, house, city, profession, About, school-memory data and optional LinkedIn/Instagram; batch-only privacy controls. |
| `/reunion` | Hero, countdown, RSVP status, menu cards and fund summary. |
| `/reunion/rsvp` | attendance, spouse, children, accommodation and save confirmation. |
| `/reunion/fund` | Fund hero/progress, member payment status, payment CTA, collection breakdown, expenses and balance. |
| `/reunion/fund/pay` | UPI app/deep link, copy ID, QR, then UTR/date/optional screenshot submission. |
| `/memories` | memory header, share button, filter tabs and feed. |
| post detail / album | media viewer, likes/comments; album grid and add-media action. |
| Account/FAQ/Notifications | persisted appearance controls, accordion FAQ, lightweight activity notifications. |
| Admin | member management, collection verification, expense management, reunion settings, moderation, role management. |

### Admin component details

Member management supports search, view/edit, house assignment, approval, suspension and removal. Payment dashboard displays target, verified/awaiting/pending totals and Coordinator-only member-level status; Coordinator actions are verify, reject, request clarification, inspect UTR/screenshot, and export CSV. Expense creation includes category, amount, vendor, date, receipt, and notes. Coordinators handle moderation queues with dismiss/remove actions. Role management lists named batch administrators and role-based permissions.

### Cross-screen states and interaction rules

Every significant screen needs:

- loading skeleton;
- empty state with a relevant CTA;
- retryable error state;
- offline banner;
- permission-denied message;
- reauthentication path for expired session.

Use bottom sheets on mobile for concise details, confirm destructive actions, show upload progress, and do not let users accidentally abandon active media uploads.

## 13. Suggested build sequence

The conversation’s phased MVP sequence:

1. Foundation: React/TypeScript/Vite/Tailwind, Firebase, Google auth, batch/member model, themes, mobile-first shell.
2. Identity: Home, Houses, member directory/profiles, search.
3. Reunion: countdown, schedule, instructions, RSVP, announcements.
4. Memory archive: photo/video upload, feed, comments, likes, albums, tagging.
5. Polish: PWA, notifications, moderation, admin dashboard, performance, security, storage optimisation.
6. Pilot: invite 10–15 batchmates, fix issues, then open to the whole 2002 batch.

## 14. Explicit non-decisions / future ideas

The following appeared as ideas, not confirmed MVP requirements:

- “Then & Now” photo comparisons (2001 → current/reunion).
- A future “Connect” action on member profiles.
- Automated payment allocation, vendor payments, refunds, or gateway split payments.
- AI photo organisation, downloadable batch albums, advanced analytics, and unlimited/large media tiers.
- Exact financial amounts, event dates beyond January 2027, specific UPI ID/account, and final named administrators.
- Exact Firestore schema, notification provider, and domain-routing configuration.

Do not implement these as fixed scope without a subsequent product decision.
