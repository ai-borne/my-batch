import { deleteApp, initializeApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'
import { getAuth as getAdminAuth } from 'firebase-admin/auth'
import { getApps, initializeApp as initializeAdminApp } from 'firebase-admin/app'
import { Timestamp, getFirestore } from 'firebase-admin/firestore'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

const projectId = 'demo-no-project'
const batchId = 'bootstrap-batch'
const adminApp = getApps().length ? getApps()[0] : initializeAdminApp({ projectId })
const adminDb = getFirestore(adminApp)
const clients: ReturnType<typeof initializeApp>[] = []
let sequence = 0

async function signIn(label: string) {
  const app = initializeApp({ apiKey: 'test', authDomain: 'test.invalid', projectId, appId: `bootstrap-${label}-${++sequence}` }, `bootstrap-${label}-${sequence}`)
  clients.push(app)
  const auth = getAuth(app)
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'}`, { disableWarnings: true })
  await createUserWithEmailAndPassword(auth, `${label}-${sequence}@example.test`, 'password-123')
  const functions = getFunctions(app)
  connectFunctionsEmulator(functions, '127.0.0.1', Number(process.env.AJINKYANS_FUNCTIONS_EMULATOR_PORT ?? '5001'))
  return { auth, call: <T>(name: string, data: Record<string, unknown>) => httpsCallable<Record<string, unknown>, T>(functions, name)({ requestId: `request-${++sequence}`, ...data }) }
}

async function makeSuperAdmin(client: Awaited<ReturnType<typeof signIn>>) {
  await getAdminAuth(adminApp).setCustomUserClaims(client.auth.currentUser!.uid, { superAdmin: true })
  await client.auth.currentUser!.getIdToken(true)
}

async function pending(uid: string, values: Partial<Record<string, unknown>> = {}) {
  await adminDb.doc(`batches/${batchId}/accessRequests/${uid}`).set({ uid, status: 'pending', displayName: 'Candidate', houseId: 'tilak', rollNumber: `roll-${uid.slice(0, 8)}`, passingYear: 2002, createdAt: Timestamp.fromMillis(1_000), ...values })
}

beforeEach(async () => { await adminDb.recursiveDelete(adminDb.collection('batches').doc(batchId)); await adminDb.doc(`batches/${batchId}`).set({ name: 'Bootstrap batch' }) })
afterAll(async () => { await Promise.all(clients.map(deleteApp)) })

describe('Coordinator bootstrap callables', () => {
  it('approves one pending applicant as Coordinator with all membership records and retention-bound audit data', async () => {
    const admin = await signIn('admin'); const candidate = await signIn('candidate'); await makeSuperAdmin(admin)
    const adminUid = admin.auth.currentUser!.uid; const candidateUid = candidate.auth.currentUser!.uid
    await pending(candidateUid, { displayName: 'First Candidate', rollNumber: 'BOOT-100' })

    const result = await admin.call<{ approved: boolean; membershipUid: string }>('bootstrapCoordinator', { batchId, requestId: candidateUid, reason: 'No active Coordinator is available.', operationId: 'bootstrap-100' })

    expect(result.data).toEqual({ approved: true, membershipUid: candidateUid })
    expect((await adminDb.doc(`batches/${batchId}/memberships/${candidateUid}`).get()).data()).toMatchObject({ uid: candidateUid, status: 'active', role: 'coordinator', memberCode: 'bootstrap-batch-boot-100', approvedBy: adminUid })
    expect((await adminDb.doc(`batches/${batchId}/profiles/${candidateUid}`).get()).data()).toMatchObject({ uid: candidateUid, displayName: 'First Candidate' })
    expect((await adminDb.doc(`batches/${batchId}/memberCodes/bootstrap-batch-boot-100`).get()).data()).toMatchObject({ uid: candidateUid, rollNumber: 'BOOT-100' })
    expect((await adminDb.doc(`batches/${batchId}/accessRequests/${candidateUid}`).get()).data()).toMatchObject({ status: 'approved', approvedBy: adminUid })
    const audits = await adminDb.collection(`batches/${batchId}/auditEvents`).where('action', '==', 'membership.bootstrapCoordinatorApproved').get()
    expect(audits.docs.map((doc) => doc.data())).toEqual([expect.objectContaining({ actorUid: adminUid, targetUid: candidateUid, batchId, outcome: 'success', roleBefore: 'pending', roleAfter: 'coordinator', reason: 'No active Coordinator is available.', retentionUntil: expect.any(Timestamp) })])
  })

  it('denies non-admins, self-targeting, malformed input, duplicates, and recovery after a Coordinator exists', async () => {
    const admin = await signIn('admin-denials'); const candidate = await signIn('candidate-denials'); const member = await signIn('member-denials'); await makeSuperAdmin(admin)
    await pending(candidate.auth.currentUser!.uid, { rollNumber: 'DUP-100' })
    await pending(admin.auth.currentUser!.uid, { rollNumber: 'SELF-100' })
    await adminDb.doc(`batches/${batchId}/memberCodes/bootstrap-batch-dup-100`).set({ uid: member.auth.currentUser!.uid })
    await expect(member.call('bootstrapCoordinator', { batchId, requestId: candidate.auth.currentUser!.uid, reason: 'Recovery', operationId: 'member-op' })).rejects.toMatchObject({ code: 'functions/permission-denied' })
    await expect(admin.call('bootstrapCoordinator', { batchId, requestId: admin.auth.currentUser!.uid, reason: 'Recovery', operationId: 'self-op' })).rejects.toMatchObject({ code: 'functions/failed-precondition' })
    await expect(admin.call('bootstrapCoordinator', { batchId, requestId: candidate.auth.currentUser!.uid, reason: '', operationId: 'bad op!' })).rejects.toMatchObject({ code: 'functions/invalid-argument' })
    await expect(admin.call('bootstrapCoordinator', { batchId, requestId: candidate.auth.currentUser!.uid, reason: 'Recovery', operationId: 'duplicate-op' })).rejects.toMatchObject({ code: 'functions/already-exists' })
    await adminDb.doc(`batches/${batchId}/memberships/existing`).set({ uid: 'existing', status: 'active', role: 'coordinator' })
    await expect(admin.call('listBootstrapCandidates', { batchId })).rejects.toMatchObject({ code: 'functions/failed-precondition' })
    await expect(admin.call('bootstrapCoordinator', { batchId, requestId: candidate.auth.currentUser!.uid, reason: 'Recovery', operationId: 'after-existing' })).rejects.toMatchObject({ code: 'functions/failed-precondition' })
  })

  it('is idempotent after a successful but unacknowledged result and allows existing active-member appointment during recovery', async () => {
    const admin = await signIn('admin-retry'); const candidate = await signIn('candidate-retry'); const active = await signIn('active-retry'); await makeSuperAdmin(admin)
    await pending(candidate.auth.currentUser!.uid, { rollNumber: 'RETRY-100' })
    const data = { batchId, requestId: candidate.auth.currentUser!.uid, reason: 'Recovery', operationId: 'retry-100' }
    await admin.call('bootstrapCoordinator', data)
    await expect(admin.call('bootstrapCoordinator', data)).resolves.toMatchObject({ data: { approved: true, membershipUid: candidate.auth.currentUser!.uid } })
    expect((await adminDb.collection(`batches/${batchId}/auditEvents`).where('action', '==', 'membership.bootstrapCoordinatorApproved').get()).size).toBe(1)
    await adminDb.doc(`batches/${batchId}/memberships/${active.auth.currentUser!.uid}`).set({ uid: active.auth.currentUser!.uid, status: 'active', role: 'batchmate' })
    await admin.call('assignCoordinator', { batchId, memberUid: active.auth.currentUser!.uid, action: 'assign', reason: 'Existing member recovery remains supported.' })
    expect((await adminDb.doc(`batches/${batchId}/memberships/${active.auth.currentUser!.uid}`).get()).data()).toMatchObject({ role: 'coordinator' })
  })

  it('offers stable minimal candidate pages and exactly one concurrent bootstrap success', async () => {
    const adminOne = await signIn('admin-one'); const adminTwo = await signIn('admin-two'); const first = await signIn('first'); const second = await signIn('second'); await makeSuperAdmin(adminOne); await makeSuperAdmin(adminTwo)
    await pending(first.auth.currentUser!.uid, { displayName: 'A', rollNumber: 'PAGE-1', createdAt: Timestamp.fromMillis(1_000) }); await pending(second.auth.currentUser!.uid, { displayName: 'B', rollNumber: 'PAGE-2', createdAt: Timestamp.fromMillis(1_000) })
    const pageOne = await adminOne.call<{ candidates: Array<{ requestId: string; displayName: string; rollNumber: string; houseId: string | null }>; nextPageToken: string | null }>('listBootstrapCandidates', { batchId, pageSize: 1 })
    expect(pageOne.data.candidates[0]).toEqual({
      requestId: expect.any(String),
      displayName: expect.any(String),
      rollNumber: expect.any(String),
      houseId: 'tilak',
    })
    const pageTwo = await adminOne.call<{ candidates: Array<{ requestId: string }>; nextPageToken: string | null }>('listBootstrapCandidates', { batchId, pageSize: 1, pageToken: pageOne.data.nextPageToken })
    expect(pageTwo.data.candidates[0].requestId).not.toBe(pageOne.data.candidates[0].requestId)
    await expect(adminOne.call('listBootstrapCandidates', { batchId, pageToken: 'not-a-token' })).rejects.toMatchObject({ code: 'functions/invalid-argument' })
    const attempts = await Promise.allSettled([
      adminOne.call('bootstrapCoordinator', { batchId, requestId: first.auth.currentUser!.uid, reason: 'Recovery', operationId: 'concurrent-one' }),
      adminTwo.call('bootstrapCoordinator', { batchId, requestId: second.auth.currentUser!.uid, reason: 'Recovery', operationId: 'concurrent-two' }),
    ])
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1)
    expect(attempts.filter((attempt) => attempt.status === 'rejected').map((attempt) => (attempt as PromiseRejectedResult).reason.code)).toEqual(['functions/failed-precondition'])
    expect((await adminDb.collection(`batches/${batchId}/memberships`).where('status', '==', 'active').where('role', '==', 'coordinator').get()).size).toBe(1)
    expect((await adminDb.collection(`batches/${batchId}/auditEvents`).where('action', '==', 'membership.bootstrapCoordinatorApproved').get()).size).toBe(1)
  })

  it('gives the bootstrap-created Coordinator immediate access to approve the remaining pending queue', async () => {
    const admin = await signIn('admin-coordinator-tools'); const coordinator = await signIn('new-coordinator'); const nextApplicant = await signIn('next-applicant'); await makeSuperAdmin(admin)
    const coordinatorUid = coordinator.auth.currentUser!.uid; const nextApplicantUid = nextApplicant.auth.currentUser!.uid
    await pending(coordinatorUid, { rollNumber: 'COORD-100' })
    await pending(nextApplicantUid, { rollNumber: 'NEXT-100' })

    await admin.call('bootstrapCoordinator', { batchId, requestId: coordinatorUid, reason: 'Restore membership review coverage.', operationId: 'coordinator-tools' })
    await expect(coordinator.call('approveMembership', { batchId, requestId: nextApplicantUid })).resolves.toMatchObject({ data: { approved: true } })
    expect((await adminDb.doc(`batches/${batchId}/memberships/${nextApplicantUid}`).get()).data()).toMatchObject({ status: 'active', role: 'batchmate', approvedBy: coordinatorUid })
  })

  it('limits high-impact bootstrap attempts per Super Admin', async () => {
    const admin = await signIn('admin-limit'); const first = await signIn('limit-first'); const second = await signIn('limit-second'); const third = await signIn('limit-third'); await makeSuperAdmin(admin)
    await pending(first.auth.currentUser!.uid); await pending(second.auth.currentUser!.uid); await pending(third.auth.currentUser!.uid)
    await admin.call('bootstrapCoordinator', { batchId, requestId: first.auth.currentUser!.uid, reason: 'Recovery', operationId: 'limit-one' })
    await expect(admin.call('bootstrapCoordinator', { batchId, requestId: second.auth.currentUser!.uid, reason: 'Recovery', operationId: 'limit-two' })).rejects.toMatchObject({ code: 'functions/failed-precondition' })
    await expect(admin.call('bootstrapCoordinator', { batchId, requestId: third.auth.currentUser!.uid, reason: 'Recovery', operationId: 'limit-three' })).rejects.toMatchObject({ code: 'functions/resource-exhausted' })
  })
})
