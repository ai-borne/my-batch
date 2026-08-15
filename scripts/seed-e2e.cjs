const { getApps, initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')

async function seedE2E() {
  const app = getApps().length ? getApps()[0] : initializeApp({ projectId: 'demo-no-project' })
  const auth = getAuth(app)
  const db = getFirestore(app)
  const batchId = 'sssatara-2002'
  const now = new Date()
  const users = [
    ['coordinator', 'coordinator@example.test'],
    ['member', 'member@example.test'],
    ['pending', 'pending@example.test'],
    ['rejected', 'rejected@example.test'],
    ['suspended', 'suspended@example.test'],
  ]
  for (const [uid, email] of users) {
    try { await auth.getUser(uid) } catch { await auth.createUser({ uid, email, password: 'password-123' }) }
  }
  await db.doc(`batches/${batchId}`).set({ name: 'Ajinkyans 2002' })
  await db.doc(`batches/${batchId}/memberships/coordinator`).set({ uid: 'coordinator', status: 'active', role: 'coordinator' })
  await db.doc(`batches/${batchId}/memberships/member`).set({ uid: 'member', status: 'active', role: 'batchmate' })
  await db.doc(`batches/${batchId}/memberships/pending`).set({ uid: 'pending', status: 'pending', role: 'batchmate' })
  await db.doc(`batches/${batchId}/memberships/suspended`).set({ uid: 'suspended', status: 'suspended', role: 'batchmate' })
  await db.doc(`batches/${batchId}/accessRequests/pending`).set({ uid: 'pending', batchId, displayName: 'Pending Member', houseId: 'tilak', rollNumber: 'PENDING-1', passingYear: 2002, status: 'pending', createdAt: now, updatedAt: now })
  await db.doc(`batches/${batchId}/accessRequests/rejected`).set({ uid: 'rejected', batchId, displayName: 'Rejected Member', houseId: 'tilak', rollNumber: 'REJECTED-1', passingYear: 2002, status: 'rejected', rejectionReason: 'Use your full name.', rejectedBy: 'coordinator', createdAt: now, updatedAt: now })
  await db.doc(`batches/${batchId}/paymentConfig/current`).set({ currency: 'INR', upiId: 'collection@upi', accountLabel: 'Reunion collection', defaultFamilyAmountPaise: 3000000, targetPaise: 5000000, contributionHeads: ['Reunion contribution'], qrStoragePath: `batches/${batchId}/reunion/qr/placeholder.png`, updatedBy: 'coordinator', updatedAt: new Date() })
  await db.doc(`batches/${batchId}/posts/archive-post`).set({ authorUid: 'member', caption: 'Archive test memory', media: [], status: 'visible', createdAt: new Date(), updatedAt: new Date() })
  await db.doc(`batches/${batchId}/notifications/member/items/welcome`).set({ kind: 'announcement', title: 'Welcome back', body: 'Reunion updates appear here.', createdAt: new Date() })
}

module.exports = { seedE2E }

if (require.main === module) void seedE2E()
