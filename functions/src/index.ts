import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

initializeApp()

const db = getFirestore()

function requireUid(auth: { uid: string } | undefined) {
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in is required.')
  return auth.uid
}

async function requireCoordinator(batchId: string, uid: string) {
  const membership = await db.doc(`batches/${batchId}/memberships/${uid}`).get()
  if (membership.data()?.status !== 'active' || membership.data()?.role !== 'coordinator') {
    throw new HttpsError('permission-denied', 'Coordinator access is required.')
  }
}

export const approveMembership = onCall(async (request) => {
  const { batchId, requestId } = request.data as { batchId?: string; requestId?: string }
  if (!batchId || !requestId) throw new HttpsError('invalid-argument', 'batchId and requestId are required.')

  const coordinatorUid = requireUid(request.auth)
  await requireCoordinator(batchId, coordinatorUid)
  const requestRef = db.doc(`batches/${batchId}/accessRequests/${requestId}`)

  await db.runTransaction(async (transaction) => {
    const accessRequest = await transaction.get(requestRef)
    if (!accessRequest.exists || accessRequest.data()?.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'The access request is not pending.')
    }
    const { uid, displayName, houseId, passingYear } = accessRequest.data() as Record<string, unknown>
    if (typeof uid !== 'string' || typeof displayName !== 'string' || typeof passingYear !== 'number') {
      throw new HttpsError('invalid-argument', 'The access request has invalid identity fields.')
    }

    const membershipRef = db.doc(`batches/${batchId}/memberships/${uid}`)
    const profileRef = db.doc(`batches/${batchId}/profiles/${uid}`)
    transaction.set(membershipRef, {
      uid, batchId, role: 'batchmate', status: 'active', houseId: typeof houseId === 'string' ? houseId : null,
      approvedBy: coordinatorUid, approvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    transaction.set(profileRef, { uid, displayName, houseId: typeof houseId === 'string' ? houseId : null, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    transaction.update(requestRef, { status: 'approved', approvedBy: coordinatorUid, approvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), {
      actorUid: coordinatorUid, action: 'membership.approved', targetUid: uid, createdAt: FieldValue.serverTimestamp(), outcome: 'success',
    })
  })

  return { approved: true }
})
