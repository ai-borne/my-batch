import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'

const confirmation = process.argv.includes('--confirm-demo-seed')
const deploymentEnvironment = process.env.AJINKYANS_DEPLOYMENT_ENV
const projectId = process.env.AJINKYANS_STAGING_PROJECT_ID
const batchId = process.env.AJINKYANS_STAGING_BATCH_ID
const memberCount = 50
const listFixtureCount = 30
const notificationOwnerUid = 'demo-member-01'

if (!confirmation || deploymentEnvironment !== 'staging' || !projectId || !batchId) {
  throw new Error('Set AJINKYANS_DEPLOYMENT_ENV=staging, AJINKYANS_STAGING_PROJECT_ID, and AJINKYANS_STAGING_BATCH_ID, then pass --confirm-demo-seed.')
}
if (!/staging/i.test(projectId)) throw new Error('Refusing to seed: AJINKYANS_STAGING_PROJECT_ID must identify the staging project.')

const app = initializeApp({ credential: applicationDefault(), projectId })
const db = getFirestore()
const houses = ['shivaji', 'nehru', 'karve', 'rana-pratap', 'shastri', 'tilak']
const batch = db.batch()
const fixtureTime = (offset) => Timestamp.fromMillis(Date.UTC(2026, 0, 1) + offset * 60_000)

batch.set(db.doc(`batches/${batchId}`), { name: 'Ajinkyans 2002 — Staging Demo', isDemo: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
Array.from({ length: memberCount }, (_, index) => index).forEach((index) => {
  const uid = `demo-member-${String(index + 1).padStart(2, '0')}`
  const houseId = houses[index % houses.length]
  batch.set(db.doc(`batches/${batchId}/memberships/${uid}`), { uid, batchId, role: 'batchmate', status: 'active', houseId, isDemo: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  batch.set(db.doc(`batches/${batchId}/profiles/${uid}`), { uid, displayName: `Demo Member ${String(index + 1).padStart(2, '0')}`, houseId, isDemo: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
})
batch.set(db.doc(`batches/${batchId}/reunion/config`), { title: 'Silver Jubilee Reunion', isDemo: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
Array.from({ length: listFixtureCount }, (_, index) => index).forEach((index) => {
  const item = String(index + 1).padStart(2, '0')
  const uid = `demo-member-${String((index % memberCount) + 1).padStart(2, '0')}`
  const createdAt = fixtureTime(index)
  batch.set(db.doc(`batches/${batchId}/posts/demo-post-${item}`), { authorUid: uid, caption: `Synthetic archive item ${item}`, media: [], status: 'visible', isDemo: true, createdAt, updatedAt: createdAt })
  batch.set(db.doc(`batches/${batchId}/posts/demo-post-01/comments/demo-comment-${item}`), { authorUid: uid, body: `Synthetic archive comment ${item}`, status: 'visible', isDemo: true, createdAt, updatedAt: createdAt })
  batch.set(db.doc(`batches/${batchId}/notifications/${notificationOwnerUid}/items/demo-notification-${item}`), { kind: 'announcement', title: `Synthetic notification ${item}`, body: 'Staging-only fixture.', isDemo: true, createdAt })
  batch.set(db.doc(`batches/${batchId}/expenses/demo-expense-${item}`), { category: 'venue', amountPaise: 10000 + index, vendor: 'Synthetic vendor', expenseDate: createdAt.toDate(), status: 'approved', isDemo: true, createdAt, updatedAt: createdAt })
  batch.set(db.doc(`batches/${batchId}/paymentClaims/demo-claim-${item}`), { memberUid: uid, amountPaise: 10000 + index, contributionHead: 'reunion', status: 'verified', isDemo: true, submittedAt: createdAt, createdAt, updatedAt: createdAt })
  batch.set(db.doc(`batches/${batchId}/accessRequests/demo-request-${item}`), { uid: `demo-pending-${item}`, batchId, displayName: `Synthetic Request ${item}`, houseId: houses[index % houses.length], passingYear: 2002, status: 'pending', isDemo: true, createdAt, updatedAt: createdAt })
  batch.set(db.doc(`batches/${batchId}/reports/demo-report-${item}`), { reporterUid: uid, targetType: 'post', targetId: `demo-post-${item}`, category: 'other', status: 'open', isDemo: true, createdAt, updatedAt: createdAt })
})
await batch.commit()
console.log(`Seeded synthetic staging fixtures: ${memberCount} members and ${listFixtureCount} records for each paginated list.`)
await db.terminate()
await app.delete()
process.exit(0)
