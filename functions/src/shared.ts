import { getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'

if (!getApps().length) initializeApp()

export const db = getFirestore()
export const houseIds = new Set(['shivaji', 'nehru', 'karve', 'rana-pratap', 'shastri', 'tilak'])

export function requireUid(auth: { uid: string } | undefined) {
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in is required.')
  return auth.uid
}

export async function requireCoordinator(batchId: string, auth: { uid: string; token?: Record<string, unknown> } | undefined) {
  const uid = requireUid(auth)
  if (auth?.token?.superAdmin === true) throw new HttpsError('permission-denied', 'Super Admin accounts cannot access batch operations.')
  const membership = await db.doc(`batches/${batchId}/memberships/${uid}`).get()
  if (membership.data()?.status !== 'active' || membership.data()?.role !== 'coordinator') {
    throw new HttpsError('permission-denied', 'Coordinator access is required.')
  }
}

export async function requireActiveMember(batchId: string, uid: string) {
  const membership = await db.doc(`batches/${batchId}/memberships/${uid}`).get()
  if (membership.data()?.status !== 'active') throw new HttpsError('permission-denied', 'An active membership is required.')
}

export function requireBatchId(batchId: unknown): asserts batchId is string {
  if (typeof batchId !== 'string' || !batchId) throw new HttpsError('invalid-argument', 'batchId is required.')
}

export function requirePaise(value: unknown, field: string) {
  if (!Number.isInteger(value) || Number(value) <= 0 || Number(value) > 1_000_000_000) {
    throw new HttpsError('invalid-argument', `${field} must be a positive INR amount in paise.`)
  }
  return Number(value)
}

export function requireText(value: unknown, field: string, maximum: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
    throw new HttpsError('invalid-argument', `${field} is required and too long.`)
  }
  return value.trim()
}

export function requireRecentAuthentication(auth: { token?: Record<string, unknown> } | undefined) {
  const authTime = auth?.token?.auth_time
  if (typeof authTime !== 'number' || Timestamp.now().seconds - authTime > 300) {
    throw new HttpsError('failed-precondition', 'Please sign in again before performing this sensitive action.')
  }
}

export async function limitSensitiveOperation(uid: string, operation: string) {
  const rateLimitRef = db.doc(`rateLimits/${uid}-${operation}`)
  await db.runTransaction(async (transaction) => {
    const now = Timestamp.now()
    const current = await transaction.get(rateLimitRef)
    const data = current.data()
    const windowStartedAt = data?.windowStartedAt as Timestamp | undefined
    const inWindow = windowStartedAt && now.seconds - windowStartedAt.seconds < 60
    const count = inWindow ? Number(data?.count ?? 0) : 0
    if (count >= 10) throw new HttpsError('resource-exhausted', 'Too many sensitive requests. Please wait a minute and try again.')
    transaction.set(rateLimitRef, { uid, operation, count: count + 1, windowStartedAt: inWindow ? windowStartedAt : now, updatedAt: FieldValue.serverTimestamp() })
  })
}
