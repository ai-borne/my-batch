# Ajinkyans — Pilot Privacy, Consent, Retention, and Moderation Policy

This policy applies to the Ajinkyans 2002 pilot. It converts the agreed product decisions into operating rules. It is informed by the NIST Privacy Framework, OWASP ASVS access-control/file-upload guidance, and storage-limitation practice. It is not legal advice or a certification of compliance; the Super Admin should obtain an India-specific legal review before a wider public rollout.

## 1. Publication model

- Approved members may publish photos, videos, captions, comments, and likes immediately.
- No Coordinator pre-approval is required for ordinary posts or comments.
- Coordinators review reports, flagged content, takedown requests, and suspected policy violations.
- Public unauthenticated users cannot view member profiles, RSVP data, posts, comments, payment data, or private media.

## 2. Data minimization and purpose

- Collect only fields needed for identity, batch membership, reunion planning, archive operation, moderation, or payment reconciliation.
- Do not collect passwords, UPI PINs, bank passwords, card data, CVVs, or unrelated identity documents.
- UTRs, payment screenshots, and individual payment records are Coordinator-only.
- Use RSVP data for reunion planning and attendance visibility; do not use it for advertising or unrelated profiling.
- Use uploaded media for the private batch archive and moderation; do not sell, publish, or train external models on it.
- Do not add facial recognition or automated identity inference to the pilot.

## 3. Member consent and content rights

Before submitting media, the member must confirm that:

- they have the right to share the media or are acting with the owner’s permission;
- the media is appropriate for the private Ajinkyans batch community;
- they understand that approved batch members can view the post;
- they will not upload private financial documents, credentials, or another person’s sensitive personal information without permission.

People tags are optional and must be user-entered. A tagged person may request correction or removal. The uploader retains ownership of their content; Ajinkyans receives only the limited permission needed to store, display, and moderate it inside the batch.

## 4. Prohibited content

Coordinators may hide/remove content or suspend access for:

- harassment, bullying, threats, hate, discrimination, or targeted abuse;
- sexual exploitation, sexual content involving minors, or non-consensual intimate material;
- doxxing, credentials, UPI PINs, bank/card information, or sensitive payment evidence;
- impersonation, fraud, scams, spam, malware, or malicious links;
- unlawful content or content submitted without the necessary rights/consent;
- content that creates a credible safety risk or materially disrupts the community.

## 5. Reporting and moderation workflow

1. A batch member reports a post, comment, profile, or user with a category and optional explanation.
2. The item remains visible by default unless an automated safety rule or Coordinator temporarily hides it.
3. A Coordinator records a decision: dismiss, warn, hide, remove, restrict, suspend, or escalate.
4. The affected member receives a concise reason where safe and appropriate.
5. A member may appeal a removal or suspension to the Super Admin through the published WhatsApp support route.
6. Coordinator actions create an immutable audit event without copying sensitive media into the log.

Pilot response targets:

- urgent safety, credential, or intimate-content report: acknowledge within 4 hours;
- ordinary report: acknowledge within 1 business day and decide within 3 business days;
- confirmed prohibited content: hide/remove as soon as practical after review.

## 6. Takedown and correction

- The uploader may delete their own post, subject to a short-lived audit record.
- A person depicted or identified in media may request correction, untagging, or removal through a Coordinator.
- Coordinators may remove content that violates this policy or lacks consent.
- Payment evidence, reports, and audit records may be retained after content removal when needed for reconciliation, security, or dispute handling.
- Deleted media must be removed from active Storage paths and derivatives within 30 days, unless a documented hold applies.

## 7. Retention and deletion

These are pilot operating periods and must be reviewed before wider launch:

| Data | Pilot retention rule |
|---|---|
| Active member profile and RSVP | While membership is active; delete/anonymize within 30 days of an approved deletion request unless a documented hold applies. |
| Rejected access request | Delete within 90 days of rejection. |
| Memories/posts/comments | Until the uploader/member requests deletion, a Coordinator removes it, or the batch archive is closed. |
| Moderation reports and decisions | 2 years after closure, then delete or anonymize. |
| Payment claims, UTRs, screenshots, and reconciliation audit | 7 years after the reunion, subject to legal/accounting review, then securely delete. |
| Approved expense and receipt records | 7 years after the reunion, subject to legal/accounting review, then securely delete. |
| Aggregate, non-identifying statistics | May be retained for product reporting if individuals cannot reasonably be reconstructed. |

Run an annual retention review. Deletion must remove active documents, Storage objects, thumbnails, exports, and cached derivatives where applicable.

## 8. Security controls

- Enforce least privilege with server-side Firestore and Storage rules.
- Keep all private data batch-scoped and exclude it from public indexing.
- Validate file type, file size, duration, and Storage path on upload; process media outside the web root.
- Rate-limit sign-in, access requests, reports, comments, uploads, and payment submissions.
- Log access-control failures and material Coordinator actions without logging secrets or raw payment evidence.
- Encrypt data in transit and use Firebase-managed encryption at rest.
- Maintain staging/production separation and never use real payment evidence in development.
- Provide account/session revocation and reauthentication for sensitive Coordinator operations.

## 9. Member notice

The app must show a concise privacy notice before membership activation and media/payment submission. It must identify what is collected, why it is collected, who can see it, how to request correction/removal, and the WhatsApp route for Coordinator support.

## Reference guidance

- NIST Privacy Framework: https://www.nist.gov/privacy-framework/privacy-framework
- OWASP Application Security Verification Standard: https://owasp.org/www-project-application-security-verification-standard/
- ICO storage limitation guidance: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles-a-guide-to-the-data-protection-principles/storage-limitation/

