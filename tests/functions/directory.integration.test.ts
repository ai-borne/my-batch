import { deleteApp, initializeApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'
import { getApps, initializeApp as initializeAdminApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const projectId = 'demo-no-project'; const batchId = 'batch-directory'; const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'; const functionsPort = Number(process.env.AJINKYANS_FUNCTIONS_EMULATOR_PORT ?? '5001')
const admin = getApps().length ? getApps()[0] : initializeAdminApp({ projectId }); const db = getFirestore(admin); const clients: ReturnType<typeof initializeApp>[] = []
async function member(email: string) {
  const app = initializeApp({ apiKey: 'test', authDomain: 'test.invalid', projectId, appId: `directory-${email}` }, `directory-${email}`); clients.push(app)
  const auth = getAuth(app); connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true }); await createUserWithEmailAndPassword(auth, email, 'password-123')
  const functions = getFunctions(app); connectFunctionsEmulator(functions, '127.0.0.1', functionsPort)
  return { auth, call: <T>(name: string, data: unknown) => httpsCallable<unknown, T>(functions, name)(data) }
}
beforeAll(() => { process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080' })
beforeEach(async () => { await db.recursiveDelete(db.collection('batches').doc(batchId)) })
afterAll(async () => { await Promise.all(clients.map(deleteApp)) })

describe('UX-3 private directory callables', () => {
  it('returns only bounded redacted directory projections with stable cursors and house counts', async () => {
    const caller = await member('directory-caller@example.test'); const uid = caller.auth.currentUser!.uid
    await db.doc(`batches/${batchId}/memberships/${uid}`).set({ status: 'active', role: 'batchmate' })
    for (const [id, displayName, houseId] of [['a', 'Aman', 'tilak'], ['b', 'Bharat', 'tilak'], ['c', 'Chandra', 'nehru']] as const) await db.doc(`batches/${batchId}/directoryMembers/${id}`).set({ uid: id, displayName, houseId, city: 'Pune', profession: 'Engineer', avatarPath: null, directoryDisplayName: displayName.toLocaleLowerCase(), directoryHouseId: houseId, directoryCity: 'pune', directoryProfession: 'engineer', privateAbout: 'not returned' })
    const data = await caller.call<{ members: Array<{ uid: string; displayName: string; privateAbout?: string }>; nextCursor: { displayName: string; uid: string } | null; hasMore: boolean; houses: Array<{ id: string; memberCount: number }> }>('listDirectory', { batchId, limit: 2 })
    expect(data.data.members).toEqual([{ uid: 'a', displayName: 'Aman', houseId: 'tilak', city: 'Pune', profession: 'Engineer', avatarPath: null }, { uid: 'b', displayName: 'Bharat', houseId: 'tilak', city: 'Pune', profession: 'Engineer', avatarPath: null }])
    expect(data.data.members[0]).not.toHaveProperty('privateAbout'); expect(data.data.hasMore).toBe(true)
    expect(data.data.houses).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'tilak', memberCount: 2 }), expect.objectContaining({ id: 'nehru', memberCount: 1 })]))
    const second = await caller.call<{ members: Array<{ uid: string }> }>('listDirectory', { batchId, limit: 2, cursor: data.data.nextCursor })
    expect(second.data.members).toEqual([expect.objectContaining({ uid: 'c' })])
    expect(second.data.houses).toBeUndefined()
  })

  it('denies non-members and rejects unbounded or unsupported query inputs', async () => {
    const outsider = await member('directory-outsider@example.test'); await db.doc(`batches/batch-other/memberships/${outsider.auth.currentUser!.uid}`).set({ status: 'active', role: 'batchmate' })
    await expect(outsider.call('listDirectory', { batchId })).rejects.toMatchObject({ code: 'functions/permission-denied' })
    const active = await member('directory-active@example.test'); await db.doc(`batches/${batchId}/memberships/${active.auth.currentUser!.uid}`).set({ status: 'active', role: 'batchmate' })
    await expect(active.call('listDirectory', { batchId, limit: 51 })).rejects.toMatchObject({ code: 'functions/invalid-argument' })
    await expect(active.call('listDirectory', { batchId, filters: { privateField: 'x' } })).rejects.toMatchObject({ code: 'functions/invalid-argument' })
    await expect(active.call('listDirectory', { batchId, filters: { city: 'pune', profession: 'engineer' } })).rejects.toMatchObject({ code: 'functions/invalid-argument' })
  })
})
