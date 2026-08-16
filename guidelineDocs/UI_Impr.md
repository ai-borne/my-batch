# Ajinkyans UX Audit & Redesign Specification

**Status:** decision-ready UX direction. Implementation may begin only after the P0 data contracts, content ownership, and acceptance checks below are agreed.

## Delivery Priorities

Implement in priority order. A lower priority must not delay a higher one.

- **P0 — pilot trust and task completion:** responsive shell and navigation; semantic design tokens; Home/Reunion reunion-state CTA; directory identity and server-backed search; member-facing author data; all system states; payment-claim status; core accessibility and mobile-browser coverage.
- **P1 — experience depth:** schedule calendar actions, notification deep links, richer profile header, grouped Account editing, coordinator dashboard information architecture, and memory filters/albums.
- **P2 — enhancement after pilot evidence:** archival storytelling strip, member milestones, profile-completeness scoring, contextual desktop side rails, and non-essential visual motion.

**Phase success criteria:** P0 is complete only when its build and all existing plus new tests pass; staging contains the required launch content; and the validation matrix passes at every specified viewport. No P1/P2 work proceeds with a failing build, test, accessibility defect, or unresolved privacy/security issue.

## Findings

- **The product feels like an internal prototype:** the visual language switches between expressive editorial moments and generic white data-entry cards. Adopt the existing editorial-heritage direction consistently: warm paper background, deep green, restrained gold accent, archival photography, and a clear type scale.
- **Desktop wastes its available space:** the fixed 920px content rail becomes visually lost on laptop/desktop. Use a 1200px max-width and responsive two-column layouts where useful.
- **Mobile navigation is too weak:** five text-only tabs compete in a cramped fixed bar, while notifications and sign-out are detached in the header. Use icon + label bottom navigation for the five member areas; put notifications and profile/account controls in the header. Respect safe areas and keep the bar from obscuring content.
- **Tablet is the missing layout:** do not switch directly from mobile to desktop at 768px. At 768–1199px, use a compact header plus a second-row horizontal tab bar; switch to the single desktop header at ≥1200px.
- **Data leakage into UI damages trust:** “0 loaded members” exposes pagination mechanics, and memory cards show author UIDs. Always show member-facing names, avatars, date/context, and human language such as “12 batchmates in this house.”
- **Empty, loading, offline, and error states are inconsistent:** every data-driven screen needs intentional, branded states with a recovery action. Curated launch content is required so the app does not open as a collection of empty containers.

## Launch Content Ownership

The Coordinator product owner is accountable for the staging and production launch set. Before a pilot invite, they must verify: six complete house records; display names and approved avatars where available; 10–20 vetted memories across at least one archival collection; current reunion status, venue/contact/schedule content; and current payment instructions. The app must still render useful sparse-data states, but launch is blocked if the required set is absent.

## Global Design System & Responsive Shell

- Define semantic tokens for canvas, surface, elevated surface, text, muted text, success, warning, danger, focus, overlay, and house colors. For each, provide light/dark values plus typography, radius, border, shadow, and interactive-state tokens. Retain the current green/gold palette, add accessible destructive/status colors, maintain 4.5:1 normal-text contrast, and provide visible focus treatment.
- Standardize components: primary/secondary/quiet/danger buttons; compact and feature cards; avatar; badge; metadata row; empty state; skeleton; toast; section heading; segmented control; searchable select; confirmation dialog.
- Prefer styled native file inputs and selects. Introduce a custom control only when it preserves native keyboard, mobile-picker, validation, and screen-reader behaviour and adds a demonstrated capability. Use descriptive labels, helper text, character counts where relevant, inline validation, upload progress, and clear success/error feedback.
- Use a 4/8px spacing scale, 44px minimum touch targets (48px for primary mobile actions), 16px minimum body text, and display typography reserved for page or campaign heroes—not ordinary forms. Status must never rely on colour alone.
- Breakpoints:
  - **Mobile (320–767):** 16px page gutters; one column; compact 64px header; five-item icon/text bottom nav; sticky primary action only when it advances the current task.
  - **Tablet (768–1199):** 24–32px gutters; two-column card grids; header with brand and utilities plus a dedicated horizontal page-tab row; forms capped at a comfortable reading width.
  - **Laptop/desktop (≥1200):** 1200px content container; full header navigation; 12-column grid; home/reunion can pair main content with a contextual side rail. Avoid enormous hero blocks with no action.
- Add motion only for navigation/state feedback; honor reduced-motion preferences. Ensure all overlays trap focus, Escape closes them, and toast announcements use appropriate live regions.

## Member Experience by Screen

- **Home (P0):** make it a useful dashboard, not a landing page. Lead with the current reunion state and one dominant CTA: RSVP if open, “view schedule” if confirmed, or “get notified” if not. Follow with exactly one secondary module—either a concise “what’s new” feed or recent memories. Batch-at-a-glance, milestones, and the optional archival storytelling strip are P2. Reconcile all reunion date copy from a single source of truth.
- **Houses and directory:** give every house a name, color/accent, crest/archival image, member count, and selected state. Put search and filters directly below the headline, show active filter chips and result count, and search the directory—not merely already loaded records. Present people as compact profile cards/rows with photo or initials, name, house, city, profession, and a clear profile affordance. Use an inviting zero-result state with “clear filters.”
- **Member profile:** elevate the avatar, name, house, city/profession, and shared-memory count into a profile header. Render social links with recognizable labels/icons and show safe contact/report options in an overflow menu. Keep private data visibility explicit.
- **Reunion:** retain a photo-backed, dark campaign hero but include date, city/venue status, countdown, RSVP status, and a clear RSVP CTA. Move RSVP above less urgent schedule/fund content. Render schedule as a chronological timeline with time, location, calendar action, and empty state. Turn attendance into small, privacy-safe social proof; make travel, accommodation, contacts, and maps scannable cards.
- **Reunion fund:** show progress against target, verified contributions, expenses, and balance as a transparent visual summary. Separate “Pay now” from “Submit payment proof”; make payment instructions, QR, UPI copy/open actions, security warning, claim status, and approved-expense receipts clear. Use confirmation/rejection status cards rather than a single generic notice.
- **Memories:** put browsing first. P0 includes a prominent “Share a memory” action; author name/avatar, date, caption, media grid/lightbox, reactions, comment count, tag chips, and contextual overflow; and progressive upload steps: choose media, add story/details, confirm sharing rights. Search, filter chips, and album carousel are P1. Keep moderation private and separated from normal browsing.
- **Account:** replace the long profile form with grouped sections: identity, professional/life details, school memories, links, photo, appearance, privacy. Use a sticky save bar only after edits, a profile completeness indicator, and an explicit preview. Present deletion as a danger-zone flow with a confirmation dialog, not alongside normal support actions.
- **Notifications:** replace text-only trigger with a bell icon, unread badge, timestamped items, and deep links to the relevant content. Opening the panel must not mark all messages read; offer “mark all read” explicitly. On mobile, use a full-height notification sheet.
- **Access, pending, denied, and sign-in:** create a branded, reassuring onboarding flow with a short explanation of privacy, expected approval timeline, request status, correction path, and coordinator contact. Avoid sparse generic auth cards.
- **Coordinator workspace:** do not expose operational tasks as one uninterrupted stack of forms. Use a coordinator dashboard with actionable counts, tabs for Requests, Reunion, Fund, Members, Archive moderation, and Announcements; use tables on desktop and cards on mobile. Destructive member actions need danger styling, explicit impact copy, reason capture, and a confirmation step.
- **Super-admin workspace:** keep it visually distinct as governance administration. Prioritize coordinator assignment, audit search/filtering, clear role/status badges, and irreversible-action confirmation; do not reuse member-facing campaign cards.

The Super Admin must remain separate from batch operations and private batch content. Use role-specific navigation and an explicit forbidden state rather than a visually distinct version of Coordinator tools.

## Content, Data, and Interface Changes

- Seed the curated launch set described in **Launch Content Ownership** and record the completion check in the launch runbook.
- Store or resolve display-ready author data for memories and comments; never render raw `authorUid` in the UI.
- Replace client wording and data contracts based on “loaded members” with server-backed directory result count and search/filter pagination. Define normalized searchable fields, permitted filters/sorts, Firestore indexes, cursor pagination, debounced query behaviour, and zero-result/permission/unavailable responses before implementation.
- Add member-facing metadata required by the layouts: profile avatar URL/version, display name, house presentation data, memory reaction/comment counts, notification destination, RSVP status, and payment-claim status. Preserve existing privacy rules: only approved members see batch data; only coordinators see sensitive payment evidence and moderation details.
- Define one reunion-status model that controls every date, CTA, announcement, and empty state across Home and Reunion. The allowed states are `announced`, `rsvp_open`, `rsvp_closed`, `confirmed`, `completed`, and `archived`; document the CTA, countdown, schedule, and notification behaviour for each. This prevents contradictions such as “date to be announced” beside a dated reunion.
- Define payment-claim recovery states: draft, submitted, under review, clarification required, verified, rejected, and resubmitted. Support duplicate-claim prevention, correction of UTR/payment details, failed-proof upload retry, coordinator clarification, and resubmission. Individual claims and evidence remain Coordinator-only.
- Define moderation interaction rules: report acknowledgement, reporter visibility, affected-member notice, removal state, and appeal path. These must match the privacy and moderation policy.
- Set media budgets: lazy-load feed media, require image thumbnails and video posters, preserve upload limits from the archive contract, and test lightbox/upload behaviour on slow networks. Never make a video download a prerequisite for browsing the feed.

## Acceptance & Validation

- Validate populated, empty, loading, offline, permission-denied, and retry states for every member and admin screen.
- Run visual regression checks at 375×812, 768×1024, 1024×768, 1280×800, and 1440×900. Confirm no horizontal overflow, hidden fixed-navigation content, truncated controls, or unusable form layout.
- Test keyboard-only navigation, focus restoration, dialogs/sheets, screen-reader labels, contrast, 200% zoom, reduced motion, non-colour status indicators, form error summaries, and contextual image alternatives. Where a historic image’s subject is unknown, use a concise contextual caption rather than inventing a description.
- Test core journeys: request access; find a batchmate; update profile; RSVP; pay/submit proof including correction/rejection; browse, upload, comment on, and report a memory; review coordinator requests/claims/moderation.
- Test iOS Safari and Android Chrome in browser and installed-PWA modes, including system text scaling, camera/photo picker flows, safe-area insets, slow/unstable networks, and interrupted-upload recovery.
- Success criteria: (1) a participant can identify the next relevant action within the first 375×812 viewport on Home/Reunion; (2) primary actions sit in the bottom 60% of that viewport or are persistently available without covering content; (3) no member-facing UI exposes implementation identifiers or internal loading terminology; (4) no critical control has horizontal scrolling, is obscured by safe areas/keyboard, or lacks an accessible name.

## Assumptions

- The redesign balances reunion participation and a sustainable year-round community.
- The visual direction is editorial heritage, not a generic enterprise dashboard or a casual social network.
- Launch includes curated member, archive, and reunion content; design must still handle sparse data gracefully.
- This is a product and UX direction document. It becomes implementation-ready only after the priority plan, data contracts, component specifications, content ownership, and measurable acceptance criteria in this document are agreed.
