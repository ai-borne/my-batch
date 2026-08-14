import { deleteApp, initializeApp } from 'firebase/app'
import { Auth, connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'
import { initializeApp as initializeAdminApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const projectId = 'demo-no-project'
const batchId = 'batch-a'
const adminApp = getApps().length ? getApps()[0] : initializeAdminApp({ projectId })
const adminDb = getFirestore(adminApp)
const clients: ReturnType<typeof initializeApp>[] = []

async function signIn(email: string) {
  const app = initializeApp({ apiKey: 'test', authDomain: 'test.invalid', projectId, appId: `test-${email}` }, `client-${email}`)
  clients.push(app)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  await createUserWithEmailAndPassword(auth, email, 'password-123')
  const functions = getFunctions(app)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  return { auth, call: <T>(name: string, data: unknown) => httpsCallable<unknown, T>(functions, name)(data) }
}

beforeAll(() => { process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080' })
beforeEach(async () => { await adminDb.recursiveDelete(adminDb.collection('batches').doc(batchId)); await adminDb.doc(`batches/${batchId}`).set({ name: 'Batch A' }) })
afterAll(async () => { await Promise.all(clients.map(deleteApp)) })

describe('membership callables', () => {
  it('approves a pending request and writes an immutable audit event', async () => {
    const coordinator = await signIn('coordinator@example.test')
    const requester = await signIn('requester@example.test')
    const coordinatorUid = coordinator.auth.currentUser!.uid
    const requesterUid = requester.auth.currentUser!.uid
    await adminDb.doc(`batches/${batchId}/memberships/${coordinatorUid}`).set({ uid: coordinatorUid, status: 'active', role: 'coordinator' })
    await adminDb.doc(`batches/${batchId}/accessRequests/${requesterUid}`).set({ uid: requesterUid, status: 'pending', displayName: 'Requester', houseId: 'tilak', passingYear: 2002 })

    await coordinator.call('approveMembership', { batchId, requestId: requesterUid })

    await expect(adminDb.doc(`batches/${batchId}/memberships/${requesterUid}`).get()).resolves.toMatchObject({ exists: true })
    expect((await adminDb.doc(`batches/${batchId}/memberships/${requesterUid}`).get()).data()).toMatchObject({ uid: requesterUid, status: 'active', role: 'batchmate', approvedBy: coordinatorUid })
    const audits = await adminDb.collection(`batches/${batchId}/auditEvents`).where('action', '==', 'membership.approved').get()
    expect(audits.docs.map((item) => item.data())).toEqual(expect.arrayContaining([expect.objectContaining({ actorUid: coordinatorUid, targetUid: requesterUid, batchId, outcome: 'success' })]))
  })

  it('rejects pending requests but prevents a batchmate or cross-batch Coordinator from changing membership', async () => {
    const coordinator = await signIn('coordinator-two@example.test')
    const requester = await signIn('requester-two@example.test')
    const otherCoordinator = await signIn('other-coordinator@example.test')
    const coordinatorUid = coordinator.auth.currentUser!.uid
    const requesterUid = requester.auth.currentUser!.uid
    const otherCoordinatorUid = otherCoordinator.auth.currentUser!.uid
    await adminDb.doc(`batches/${batchId}/memberships/${coordinatorUid}`).set({ uid: coordinatorUid, status: 'active', role: 'coordinator' })
    await adminDb.doc(`batches/batch-b/memberships/${otherCoordinatorUid}`).set({ uid: otherCoordinatorUid, status: 'active', role: 'coordinator' })
    await adminDb.doc(`batches/${batchId}/accessRequests/${requesterUid}`).set({ uid: requesterUid, status: 'pending', displayName: 'Requester', houseId: 'tilak', passingYear: 2002 })

    await coordinator.call('rejectMembership', { batchId, requestId: requesterUid, reason: 'Use your full name.' })
    expect((await adminDb.doc(`batches/${batchId}/accessRequests/${requesterUid}`).get()).data()).toMatchObject({ status: 'rejected', rejectedBy: coordinatorUid, rejectionReason: 'Use your full name.' })
    await expect(requester.call('manageMembership', { batchId, memberUid: requesterUid, action: 'suspend' })).rejects.toMatchObject({ code: 'functions/permission-denied' })
    await expect(otherCoordinator.call('manageMembership', { batchId, memberUid: requesterUid, action: 'suspend' })).rejects.toMatchObject({ code: 'functions/permission-denied' })
  })
})
