#!/usr/bin/env node
/**
 * seed-production.mjs — seed demo data into the production Firebase project.
 *
 * This is a DELIBERATE, explicit action. It writes synthetic demo data
 * (reunion config, RSVP, cost dashboard, directory members) into the target
 * project so you can see the working website. It is NOT the same as the
 * staging seed — it targets production and requires a confirmation flag.
 *
 * Usage:
 *   AJINKYANS_PRODUCTION_PROJECT_ID=my-batch-0001 \
 *   AJINKYANS_PRODUCTION_BATCH_ID=sssatara-2002 \
 *   node scripts/seed-production.mjs --confirm-demo-seed
 *
 * Safety guards:
 *   - Requires --confirm-demo-seed
 *   - Requires AJINKYANS_PRODUCTION_PROJECT_ID and AJINKYANS_PRODUCTION_BATCH_ID
 *   - Refuses to run against a project whose ID contains "staging" (to avoid
 *     accidentally seeding the wrong environment)
 *
 * NOTE: This writes synthetic demo data. Do NOT run this against a project
 * that holds real member data. Real production data must be imported
 * privately per AJINKYANS-PHASE-5-LAUNCH-RUNBOOK.md.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'

const confirmation = process.argv.includes('--confirm-demo-seed')
const projectId = process.env.AJINKYANS_PRODUCTION_PROJECT_ID
const batchId = process.env.AJINKYANS_PRODUCTION_BATCH_ID
const memberCount = 50
const listFixtureCount = 30
const notificationOwnerUid = 'demo-member-01'

if (!confirmation || !projectId || !batchId) {
  throw new Error('Set AJINKYANS_PRODUCTION_PROJECT_ID and AJINKYANS_PRODUCTION_BATCH_ID, then pass --confirm-demo-seed.')
}
if (/staging/i.test(projectId)) throw new Error('Refusing to seed: this script targets production, not staging.')

const app = initializeApp({ credential: applicationDefault(), projectId })
const db = getFirestore()
const batch = db.batch()
const houses = ['shivaji', 'nehru', 'karve', 'rana-pratap', 'shastri', 'tilak']
const reunionStartDate = new Date('2027-01-10T00:00:00.000Z')
const rsvpCutoffAt = new Date('2027-01-05T00:00:00.000Z')
const fixtureTime = (offset) => Timestamp.fromMillis(Date.UTC(2026, 0, 1) + offset * 60_000)
const scheduleEvents = [
  { id: 'kickoff', title: 'Welcome and check-in', location: 'Main auditorium', startsAtMinutes: 0, endsAtMinutes: 90 },
  { id: 'campus-walk', title: 'Campus memory walk', location: 'School grounds', startsAtMinutes: 120, endsAtMinutes: 240 },
  { id: 'dinner', title: 'Silver Jubilee dinner', location: 'Reunion lawn', startsAtMinutes: 360, endsAtMinutes: 540 },
]
const reunionContacts = [
  { id: 'convener', name: 'Coordinator convener', role: 'Convening Coordinator', phone: '9000000000' },
  { id: 'finance', name: 'Coordinator finance', role: 'Fund contact', phone: '9000000001' },
]

batch.set(db.doc(`batches/${batchId}`), { name: 'Ajinkyans 2002 — Demo', isDemo: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
Array.from({ length: memberCount }, (_, index) => index).forEach((index) => {
  const uid = `demo-member-${String(index + 1).padStart(2, '0')}`
  const houseId = houses[index % houses.length]
  batch.set(db.doc(`batches/${batchId}/memberships/${uid}`), { uid, batchId, role: 'batchmate', status: 'active', houseId, isDemo: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  batch.set(db.doc(`batches/${batchId}/profiles/${uid}`), { uid, displayName: `Demo Member ${String(index + 1).padStart(2, '0')}`, houseId, isDemo: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  // Populate the directory directly so the Houses page shows members immediately.
  batch.set(db.doc(`batches/${batchId}/directoryMembers/${uid}`), { uid, displayName: `Demo Member ${String(index + 1).padStart(2, '0')}`, houseId, city: 'Pune', profession: 'Engineer', avatarPath: null, directoryDisplayName: `demo member ${String(index + 1).padStart(2, '0')}`, directoryHouseId: houseId, directoryCity: 'pune', directoryProfession: 'engineer', isDemo: true }, { merge: true })
})
batch.set(db.doc(`batches/${batchId}/reunion/config`), { status: 'confirmed', title: 'Silver Jubilee Reunion', reunionStartDate: Timestamp.fromDate(reunionStartDate), rsvpCutoffAt: Timestamp.fromDate(rsvpCutoffAt), venue: 'Sainik School Satara', venueMapUrl: 'https://maps.google.com/?q=Satara', accommodation: 'On-campus hostels available for those who reserve in advance.', logistics: 'Arrival is from 0900 hrs; parking is available inside the school grounds.', instructions: 'Carry a government photo ID for campus entry.', isDemo: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
batch.set(db.doc(`batches/${batchId}/reunion/attendance`), { yes: 38, maybe: 12 }, { merge: true })
scheduleEvents.forEach((event, index) => {
  const startsAt = new Date(reunionStartDate.getTime() + event.startsAtMinutes * 60_000)
  const endsAt = new Date(reunionStartDate.getTime() + event.endsAtMinutes * 60_000)
  batch.set(db.doc(`batches/${batchId}/reunionSchedule/${event.id}`), { title: event.title, location: event.location, startsAt: Timestamp.fromDate(startsAt), endsAt: Timestamp.fromDate(endsAt), sortOrder: index, isDemo: true, createdAt: fixtureTime(index), updatedAt: fixtureTime(index) }, { merge: true })
})
reunionContacts.forEach((contact, index) => {
  batch.set(db.doc(`batches/${batchId}/reunionContacts/${contact.id}`), { name: contact.name, role: contact.role, phone: `+91 ${contact.phone}`, isDemo: true, createdAt: fixtureTime(index), updatedAt: fixtureTime(index) }, { merge: true })
})
batch.set(db.doc(`batches/${batchId}/paymentConfig/current`), { currency: 'INR', upiId: 'ajinkyans-demo@upi', accountLabel: 'Reunion collection', defaultFamilyAmountPaise: 3000000, targetPaise: 5000000, contributionHeads: ['Reunion contribution'], qrStoragePath: null, updatedBy: 'demo-coordinator', updatedAt: new Date() }, { merge: true })
batch.set(db.doc(`batches/${batchId}/fundSummary/public`), { collectedPaise: 3800000, expensePaise: 500000, balancePaise: 3300000, contributingFamilies: 38, targetPaise: 5000000, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
Array.from({ length: listFixtureCount }, (_, index) => index).forEach((index) => {
  const item = String(index + 1).padStart(2, '0')
  const uid = `demo-member-${String((index % memberCount) + 1).padStart(2, '0')}`
  const createdAt = fixtureTime(index)
  batch.set(db.doc(`batches/${batchId}/posts/demo-post-${item}`), { authorUid: uid, caption: `Synthetic archive item ${item}`, media: [], status: 'visible', isDemo: true, createdAt, updatedAt: createdAt })
  batch.set(db.doc(`batches/${batchId}/posts/demo-post-01/comments/demo-comment-${item}`), { authorUid: uid, body: `Synthetic archive comment ${item}`, status: 'visible', isDemo: true, createdAt, updatedAt: createdAt })
  batch.set(db.doc(`batches/${batchId}/notifications/${notificationOwnerUid}/items/demo-notification-${item}`), { kind: 'announcement', title: `Synthetic notification ${item}`, body: 'Demo fixture.', isDemo: true, createdAt })
  batch.set(db.doc(`batches/${batchId}/expenses/demo-expense-${item}`), { category: 'venue', amountPaise: 10000 + index, vendor: 'Synthetic vendor', expenseDate: createdAt.toDate(), status: 'approved', isDemo: true, createdAt, updatedAt: createdAt })
  batch.set(db.doc(`batches/${batchId}/paymentClaims/demo-claim-${item}`), { memberUid: uid, amountPaise: 10000 + index, contributionHead: 'reunion', status: 'verified', isDemo: true, submittedAt: createdAt, createdAt, updatedAt: createdAt })
  batch.set(db.doc(`batches/${batchId}/accessRequests/demo-request-${item}`), { uid: `demo-pending-${item}`, batchId, displayName: `Synthetic Request ${item}`, houseId: houses[index % houses.length], passingYear: 2002, status: 'pending', isDemo: true, createdAt, updatedAt: createdAt })
  batch.set(db.doc(`batches/${batchId}/reports/demo-report-${item}`), { reporterUid: uid, targetType: 'post', targetId: `demo-post-${item}`, category: 'other', status: 'open', isDemo: true, createdAt, updatedAt: createdAt })
})
await batch.commit()
console.log(`Seeded synthetic production fixtures: ${memberCount} members and ${listFixtureCount} records for each paginated list.`)
await db.terminate()
await app.delete()
process.exit(0)