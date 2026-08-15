import { FieldPath, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { db, requireBatchId, requireDocumentId, requireRecentAuthentication, requireText, requireUid } from './shared.js'
import { limitCallable, secureCall } from './security.js'

const RETENTION_MONTHS = 24
const DEFAULT_PAGE_SIZE = 25
const MAXIMUM_PAGE_SIZE = 50

export function retentionUntil() { const date = new Date(); date.setMonth(date.getMonth() + RETENTION_MONTHS); return Timestamp.fromDate(date) }
export function requireSuperAdmin(auth: { token?: Record<string, unknown> } | undefined) { if (auth?.token?.superAdmin !== true) throw new HttpsError('permission-denied', 'Super Admin access is required.') }
function pageLimit(value: unknown) { if (value === undefined) return DEFAULT_PAGE_SIZE; if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > MAXIMUM_PAGE_SIZE) throw new HttpsError('invalid-argument', 'pageSize is invalid.'); return Number(value) }
function encodePageToken(value: Record<string, unknown>) { return Buffer.from(JSON.stringify(value)).toString('base64url') }
function decodePageToken(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.length > 500) throw new HttpsError('invalid-argument', 'pageToken is invalid.')
  try { const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw new Error('invalid'); return decoded as Record<string, unknown> } catch { throw new HttpsError('invalid-argument', 'pageToken is invalid.') }
}
function governanceError(operation: string, error: unknown): never { if (error instanceof HttpsError) console.warn('Governance request denied', { operation, code: error.code }); throw error }

export const assignCoordinator = secureCall(async (request) => {
  try {
    const { batchId, memberUid, action, reason } = request.data as { batchId?: unknown; memberUid?: unknown; action?: unknown; reason?: unknown }
    requireBatchId(batchId); requireDocumentId(memberUid, 'memberUid')
    if (!['assign', 'revoke'].includes(String(action))) throw new HttpsError('invalid-argument', 'A member and assign or revoke action are required.')
    const validatedReason = requireText(reason, 'reason', 500); const actorUid = requireUid(request.auth)
    requireRecentAuthentication(request.auth); requireSuperAdmin(request.auth)
    if (actorUid === memberUid) throw new HttpsError('failed-precondition', 'A Super Admin cannot assign themselves as Coordinator.')
    await limitCallable(batchId, actorUid, 'assignCoordinator')
    const changed = await db.runTransaction(async (transaction) => {
      const memberRef = db.doc(`batches/${batchId}/memberships/${memberUid}`); const member = await transaction.get(memberRef)
      if (!member.exists) throw new HttpsError('not-found', 'Membership was not found.')
      const roleBefore = member.data()?.role
      if (action === 'assign' && member.data()?.status !== 'active') throw new HttpsError('failed-precondition', 'Only active members can become Coordinators.')
      if ((action === 'assign' && roleBefore === 'coordinator') || (action === 'revoke' && roleBefore !== 'coordinator')) return false
      const roleAfter = action === 'assign' ? 'coordinator' : 'batchmate'
      transaction.update(memberRef, { role: roleAfter, ...(action === 'assign' ? { coordinatorAssignedBy: actorUid, coordinatorAssignedAt: FieldValue.serverTimestamp() } : { coordinatorRevokedBy: actorUid, coordinatorRevokedAt: FieldValue.serverTimestamp() }), updatedAt: FieldValue.serverTimestamp() })
      transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), { actorUid, targetUid: memberUid, batchId, action: action === 'assign' ? 'coordinator.assigned' : 'coordinator.revoked', outcome: 'success', reason: validatedReason, roleBefore, roleAfter, createdAt: FieldValue.serverTimestamp(), retentionUntil: retentionUntil() })
      return true
    })
    return { updated: changed }
  } catch (error) { return governanceError('assignCoordinator', error) }
})

export const listGovernanceMembers = secureCall(async (request) => {
  try {
    const { batchId, search, pageToken, pageSize: requestedPageSize } = request.data as Record<string, unknown>
    requireBatchId(batchId); requireSuperAdmin(request.auth); await limitCallable(batchId, requireUid(request.auth), 'listGovernanceMembers')
    if (search !== undefined && (typeof search !== 'string' || search.trim().length > 120)) throw new HttpsError('invalid-argument', 'search is invalid.')
    const cursor = decodePageToken(pageToken); if (cursor && typeof cursor.uid !== 'string') throw new HttpsError('invalid-argument', 'pageToken is invalid.')
    const limit = pageLimit(requestedPageSize); let memberQuery: FirebaseFirestore.Query = db.collection(`batches/${batchId}/memberships`).where('status', '==', 'active').orderBy(FieldPath.documentId()); if (cursor) memberQuery = memberQuery.startAfter(cursor.uid); const members = await memberQuery.limit(limit).get(); const needle = typeof search === 'string' ? search.trim().toLocaleLowerCase() : ''
    const entries = await Promise.all(members.docs.map(async (member) => {
      const [profile, user] = await Promise.all([db.doc(`batches/${batchId}/profiles/${member.id}`).get(), db.doc(`users/${member.id}`).get()]); const data = member.data(); const displayName = profile.data()?.displayName; const email = user.data()?.email
      const entry = { uid: member.id, role: data.role, memberCode: data.memberCode, ...(typeof displayName === 'string' ? { displayName } : {}), ...(typeof email === 'string' ? { email } : {}) }
      return !needle || [entry.displayName, entry.email, entry.memberCode].filter((value): value is string => typeof value === 'string').join(' ').toLocaleLowerCase().includes(needle) ? entry : undefined
    }))
    return { members: entries.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)), nextPageToken: members.size === limit ? encodePageToken({ uid: members.docs.at(-1)?.id }) : null }
  } catch (error) { return governanceError('listGovernanceMembers', error) }
})

export const listGovernanceAuditEvents = secureCall(async (request) => {
  try {
    const { batchId, action, actorUid, targetUid, from, to, pageToken, pageSize: requestedPageSize } = request.data as Record<string, unknown>
    requireBatchId(batchId); requireSuperAdmin(request.auth); await limitCallable(batchId, requireUid(request.auth), 'listGovernanceAuditEvents')
    if (action !== undefined) requireText(action, 'action', 120)
    for (const [field, value] of Object.entries({ actorUid, targetUid })) if (value !== undefined) requireDocumentId(value, field)
    const cursor = decodePageToken(pageToken); const limit = pageLimit(requestedPageSize)
    let query: FirebaseFirestore.Query = db.collection(`batches/${batchId}/auditEvents`)
    if (action !== undefined) query = query.where('action', '==', action); if (actorUid !== undefined) query = query.where('actorUid', '==', actorUid); if (targetUid !== undefined) query = query.where('targetUid', '==', targetUid)
    if (from !== undefined) { if (typeof from !== 'number') throw new HttpsError('invalid-argument', 'from is invalid.'); query = query.where('createdAt', '>=', Timestamp.fromMillis(from)) }
    if (to !== undefined) { if (typeof to !== 'number') throw new HttpsError('invalid-argument', 'to is invalid.'); query = query.where('createdAt', '<=', Timestamp.fromMillis(to)) }
    query = query.orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc')
    if (cursor && (typeof cursor.id !== 'string' || typeof cursor.createdAt !== 'number')) throw new HttpsError('invalid-argument', 'pageToken is invalid.')
    if (cursor) query = query.startAfter(Timestamp.fromMillis(cursor.createdAt as number), cursor.id)
    const events = await query.limit(limit).get(); const last = events.docs.at(-1); const lastCreatedAt = last?.data().createdAt
    return { events: events.docs.map((event) => ({ id: event.id, ...event.data() })), nextPageToken: events.size === limit && last && lastCreatedAt instanceof Timestamp ? encodePageToken({ id: last.id, createdAt: lastCreatedAt.toMillis() }) : null }
  } catch (error) { return governanceError('listGovernanceAuditEvents', error) }
})

export const executeAuditRetention = onSchedule('every day 03:30', async () => {
  let deleted = 0
  while (true) {
    const expired = await db.collectionGroup('auditEvents').where('retentionUntil', '<=', Timestamp.now()).limit(250).get()
    if (expired.empty) break
    const batch = db.batch(); expired.docs.forEach((event) => batch.delete(event.ref)); await batch.commit(); deleted += expired.size
  }
  console.info('Governance audit retention complete', { deleted, retentionMonths: RETENTION_MONTHS })
})
