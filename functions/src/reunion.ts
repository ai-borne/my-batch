import { FieldValue } from "firebase-admin/firestore"
import { HttpsError } from "firebase-functions/v2/https"
import { db, requireActiveMember, requireBatchId, requireCoordinator, requireUid } from "./shared.js"
import { notify } from './notifications.js'
import { limitCallable, secureCall } from './security.js'

export const submitRsvp = secureCall(async (request) => {
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
  await limitCallable(batchId, uid, 'submitRsvp')
  const configRef = db.doc(`batches/${batchId}/reunion/config`)
  const rsvpRef = db.doc(`batches/${batchId}/rsvps/${uid}`)
  const attendanceRef = db.doc(`batches/${batchId}/reunion/attendance`)
  await db.runTransaction(async (transaction) => {
    const [config, existing, attendanceSummary] = await Promise.all([transaction.get(configRef), transaction.get(rsvpRef), transaction.get(attendanceRef)])
    const cutoff = config.data()?.rsvpCutoffAt?.toDate?.() as Date | undefined
    const reopened = existing.data()?.reopenedAt
    if (cutoff && cutoff <= new Date() && !reopened) throw new HttpsError('failed-precondition', 'The RSVP editing period has closed.')
    const previousAttendance = existing.data()?.attendance
    const summary = attendanceSummary.data() ?? {}
    const yes = Math.max(0, Number(summary.yes ?? 0) - (previousAttendance === 'yes' ? 1 : 0) + (attendance === 'yes' ? 1 : 0))
    const maybe = Math.max(0, Number(summary.maybe ?? 0) - (previousAttendance === 'maybe' ? 1 : 0) + (attendance === 'maybe' ? 1 : 0))
    transaction.set(rsvpRef, { uid, batchId, attendance, accompanyingAdults: adultCount, accompanyingChildren: childCount, foodPreference, hotelRequired, ...(miscellaneousDetails ? { miscellaneousDetails } : {}), reopenedAt: FieldValue.delete(), reopenedBy: FieldValue.delete(), submittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedBy: uid }, { merge: true })
    transaction.set(attendanceRef, { yes, maybe, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  })
  return { saved: true }
})

export const reopenRsvp = secureCall(async (request) => {
  const { batchId, memberUid } = request.data as { batchId?: unknown; memberUid?: unknown }
  requireBatchId(batchId)
  if (typeof memberUid !== 'string' || !memberUid) throw new HttpsError('invalid-argument', 'memberUid is required.')
  const actorUid = requireUid(request.auth)
  await requireCoordinator(batchId, request.auth)
  await limitCallable(batchId, actorUid, 'reopenRsvp')
  const changed = await db.runTransaction(async (transaction) => {
    const rsvpRef = db.doc(`batches/${batchId}/rsvps/${memberUid}`)
    const rsvp = await transaction.get(rsvpRef)
    if (rsvp.data()?.reopenedAt) return false
    transaction.set(rsvpRef, { uid: memberUid, batchId, reopenedBy: actorUid, reopenedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), { actorUid, action: 'rsvp.reopened', targetUid: memberUid, createdAt: FieldValue.serverTimestamp(), outcome: 'success' })
    return true
  })
  if (changed) await notify(batchId, memberUid, 'rsvp', 'RSVP reopened', 'A Coordinator reopened your RSVP so you can update it.')
  return { reopened: true, duplicate: !changed }
})
