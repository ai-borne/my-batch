import { FieldValue } from "firebase-admin/firestore"
import { HttpsError, onCall } from "firebase-functions/v2/https"
import { db, requireActiveMember, requireBatchId, requireCoordinator, requireUid } from "./shared.js"

export const submitRsvp = onCall(async (request) => {
  const { batchId, attendance, accompanyingAdults, accompanyingChildren, foodPreference, hotelRequired, miscellaneousDetails } = request.data as Record<string, unknown>
  requireBatchId(batchId)
  const adultCount = typeof accompanyingAdults === 'number' ? accompanyingAdults : Number.NaN
  const childCount = typeof accompanyingChildren === 'number' ? accompanyingChildren : Number.NaN
  if (!['yes', 'no', 'maybe'].includes(String(attendance)) || !['vegetarian', 'nonVegetarian', 'notSpecified'].includes(String(foodPreference)) || typeof hotelRequired !== 'boolean' || !Number.isInteger(adultCount) || !Number.isInteger(childCount) || adultCount < 0 || childCount < 0) {
    throw new HttpsError('invalid-argument', 'RSVP details are invalid.')
  }
  if (miscellaneousDetails !== undefined && (typeof miscellaneousDetails !== 'string' || miscellaneousDetails.length > 1000)) throw new HttpsError('invalid-argument', 'Miscellaneous details are invalid.')
  const uid = requireUid(request.auth)
  await requireActiveMember(batchId, uid)
  const configRef = db.doc(`batches/${batchId}/reunion/config`)
  const rsvpRef = db.doc(`batches/${batchId}/rsvps/${uid}`)
  await db.runTransaction(async (transaction) => {
    const [config, existing] = await Promise.all([transaction.get(configRef), transaction.get(rsvpRef)])
    const cutoff = config.data()?.rsvpCutoffAt?.toDate?.() as Date | undefined
    const reopened = existing.data()?.reopenedAt
    if (cutoff && cutoff <= new Date() && !reopened) throw new HttpsError('failed-precondition', 'The RSVP editing period has closed.')
    transaction.set(rsvpRef, { uid, batchId, attendance, accompanyingAdults: adultCount, accompanyingChildren: childCount, foodPreference, hotelRequired, ...(miscellaneousDetails ? { miscellaneousDetails } : {}), reopenedAt: FieldValue.delete(), reopenedBy: FieldValue.delete(), submittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedBy: uid }, { merge: true })
  })
  return { saved: true }
})

export const reopenRsvp = onCall(async (request) => {
  const { batchId, memberUid } = request.data as { batchId?: unknown; memberUid?: unknown }
  requireBatchId(batchId)
  if (typeof memberUid !== 'string' || !memberUid) throw new HttpsError('invalid-argument', 'memberUid is required.')
  const actorUid = requireUid(request.auth)
  await requireCoordinator(batchId, actorUid)
  await db.runTransaction(async (transaction) => {
    const rsvpRef = db.doc(`batches/${batchId}/rsvps/${memberUid}`)
    transaction.set(rsvpRef, { uid: memberUid, batchId, reopenedBy: actorUid, reopenedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), { actorUid, action: 'rsvp.reopened', targetUid: memberUid, createdAt: FieldValue.serverTimestamp(), outcome: 'success' })
  })
  return { reopened: true }
})
