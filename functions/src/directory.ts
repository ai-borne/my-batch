import { FieldPath } from 'firebase-admin/firestore'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { db, requireActiveMember, requireBatchId, requireUid } from './shared.js'
import { limitCallable, secureCall } from './security.js'

const houses = [
  { id: 'shivaji', name: 'Shivaji', group: 'Junior', accent: 'shivaji', crestLabel: 'S' },
  { id: 'nehru', name: 'Nehru', group: 'Junior', accent: 'nehru', crestLabel: 'N' },
  { id: 'karve', name: 'Karve', group: 'Senior', accent: 'karve', crestLabel: 'K' },
  { id: 'rana-pratap', name: 'Rana Pratap', group: 'Senior', accent: 'rana-pratap', crestLabel: 'R' },
  { id: 'shastri', name: 'Shastri', group: 'Senior', accent: 'shastri', crestLabel: 'S' },
  { id: 'tilak', name: 'Tilak', group: 'Senior', accent: 'tilak', crestLabel: 'T' },
] as const
const filters = new Set(['house', 'city', 'profession'])
const sorts = new Set(['displayName', 'house'])
type Cursor = { displayName: string; uid: string; houseId?: string }

function text(value: unknown, maximum = 100) {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.trim().length > maximum) throw new HttpsError('invalid-argument', 'Directory query is invalid.')
  return value.trim().toLocaleLowerCase() || undefined
}

function input(data: Record<string, unknown>) {
  const search = text(data.search); const requestedFilters = data.filters
  if (requestedFilters !== undefined && (!requestedFilters || typeof requestedFilters !== 'object' || Array.isArray(requestedFilters))) throw new HttpsError('invalid-argument', 'Directory filters are invalid.')
  const normalizedFilters = Object.fromEntries(Object.entries(requestedFilters ?? {}).flatMap(([key, value]) => {
    if (!filters.has(key)) throw new HttpsError('invalid-argument', 'Directory filters are invalid.')
    const normalized = text(value); return normalized ? [[key, normalized]] : []
  })) as Partial<Record<'house' | 'city' | 'profession', string>>
  if (Object.keys(normalizedFilters).length > 1) throw new HttpsError('invalid-argument', 'Choose one directory filter at a time.')
  const requestedSort = data.sort === undefined ? 'displayName' : data.sort
  if (typeof requestedSort !== 'string' || !sorts.has(requestedSort)) throw new HttpsError('invalid-argument', 'Directory sort is invalid.')
  const sort = search || Object.keys(normalizedFilters).length ? 'displayName' : requestedSort
  const limit = data.limit === undefined ? 25 : data.limit
  if (!Number.isInteger(limit) || Number(limit) < 1 || Number(limit) > 50) throw new HttpsError('invalid-argument', 'Directory limit is invalid.')
  const cursor = data.cursor
  if (cursor !== undefined && (!cursor || typeof cursor !== 'object' || Array.isArray(cursor) || typeof (cursor as Cursor).displayName !== 'string' || typeof (cursor as Cursor).uid !== 'string' || ((cursor as Cursor).houseId !== undefined && typeof (cursor as Cursor).houseId !== 'string'))) throw new HttpsError('invalid-argument', 'Directory cursor is invalid.')
  return { search, filters: normalizedFilters, sort, limit: Number(limit), cursor: cursor as Cursor | undefined }
}

export const listDirectoryMembers = secureCall(async (request) => {
  const { batchId, ...data } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await requireActiveMember(batchId, uid); await limitCallable(batchId, uid, 'listDirectoryMembers')
  const queryInput = input(data); let profiles: FirebaseFirestore.Query = db.collection(`batches/${batchId}/directoryMembers`)
  const fieldByFilter = { house: 'directoryHouseId', city: 'directoryCity', profession: 'directoryProfession' } as const
  for (const [filter, value] of Object.entries(queryInput.filters)) profiles = profiles.where(fieldByFilter[filter as keyof typeof fieldByFilter], '==', value)
  if (queryInput.search) profiles = profiles.where('directoryDisplayName', '>=', queryInput.search).where('directoryDisplayName', '<', `${queryInput.search}\uf8ff`)
  profiles = queryInput.sort === 'house' ? profiles.orderBy('directoryHouseId').orderBy('directoryDisplayName').orderBy(FieldPath.documentId()) : profiles.orderBy('directoryDisplayName').orderBy(FieldPath.documentId())
  if (queryInput.cursor) profiles = queryInput.sort === 'house' ? profiles.startAfter(queryInput.cursor.houseId ?? '', queryInput.cursor.displayName, queryInput.cursor.uid) : profiles.startAfter(queryInput.cursor.displayName, queryInput.cursor.uid)
  const page = await profiles.limit(queryInput.limit + 1).get(); const visible = page.docs.slice(0, queryInput.limit)
  const last = visible.at(-1)
  return {
    members: visible.map((profile) => {
      const data = profile.data()
      return { uid: profile.id, displayName: typeof data.displayName === 'string' && data.displayName.trim() ? data.displayName : 'Batchmate', houseId: typeof data.houseId === 'string' ? data.houseId : null, city: typeof data.city === 'string' ? data.city : null, profession: typeof data.profession === 'string' ? data.profession : null, avatarPath: typeof data.avatarPath === 'string' ? data.avatarPath : null }
    }),
    nextCursor: page.size > queryInput.limit && last ? { displayName: String(last.data().directoryDisplayName), uid: last.id, ...(queryInput.sort === 'house' ? { houseId: String(last.data().directoryHouseId ?? '') } : {}) } : null,
    hasMore: page.size > queryInput.limit,
  }
})

export const listDirectoryHouses = secureCall(async (request) => {
  const { batchId } = request.data as { batchId?: unknown }
  requireBatchId(batchId); const uid = requireUid(request.auth); await requireActiveMember(batchId, uid); await limitCallable(batchId, uid, 'listDirectoryHouses')
  const counts = await Promise.all(houses.map(async (house) => ({ id: house.id, memberCount: (await db.collection(`batches/${batchId}/directoryMembers`).where('directoryHouseId', '==', house.id).count().get()).data().count })))
  return { houses: houses.map((house) => ({ ...house, memberCount: counts.find((count) => count.id === house.id)?.memberCount ?? 0 })) }
})

async function syncDirectoryMember(batchId: string, uid: string) {
  const target = db.doc(`batches/${batchId}/directoryMembers/${uid}`); const profile = await db.doc(`batches/${batchId}/profiles/${uid}`).get()
  if (!profile.exists) { await target.delete(); return }
  const membership = await db.doc(`batches/${batchId}/memberships/${uid}`).get()
  if (membership.data()?.status !== 'active') { await target.delete(); return }
  const data = profile.data() ?? {}; const displayName = typeof data.displayName === 'string' && data.displayName.trim() ? data.displayName.trim() : 'Batchmate'
  await target.set({ uid, displayName, houseId: typeof data.houseId === 'string' ? data.houseId : null, city: typeof data.city === 'string' ? data.city : null, profession: typeof data.profession === 'string' ? data.profession : null, avatarPath: typeof data.avatarPath === 'string' ? data.avatarPath : null, directoryDisplayName: displayName.toLocaleLowerCase(), directoryHouseId: typeof data.houseId === 'string' ? data.houseId : null, directoryCity: typeof data.city === 'string' ? data.city.trim().toLocaleLowerCase() || null : null, directoryProfession: typeof data.profession === 'string' ? data.profession.trim().toLocaleLowerCase() || null : null })
}

export const syncDirectoryProfile = onDocumentWritten('batches/{batchId}/profiles/{uid}', async (event) => {
  await syncDirectoryMember(event.params.batchId, event.params.uid)
})

export const syncDirectoryMembership = onDocumentWritten('batches/{batchId}/memberships/{uid}', async (event) => {
  await syncDirectoryMember(event.params.batchId, event.params.uid)
})
