import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import './admin.js'

export const db = getFirestore()
export const houseIds = new Set(['shivaji', 'nehru', 'karve', 'rana-pratap', 'shastri', 'tilak'])

export function requireUid(auth: { uid: string } | undefined) {
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in is required.')
  return auth.uid
}

export async function requireCoordinator(batchId: string, uid: string) {
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
