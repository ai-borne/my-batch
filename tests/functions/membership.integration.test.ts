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

describe('Phase 4 finance callables', () => {
  it('derives the public fund only from verified claims and approved expenses', async () => {
    const coordinator = await signIn('finance-coordinator@example.test')
    const member = await signIn('finance-member@example.test')
    const coordinatorUid = coordinator.auth.currentUser!.uid
    const memberUid = member.auth.currentUser!.uid
    await adminDb.doc(`batches/${batchId}/memberships/${coordinatorUid}`).set({ uid: coordinatorUid, status: 'active', role: 'coordinator' })
    await adminDb.doc(`batches/${batchId}/memberships/${memberUid}`).set({ uid: memberUid, status: 'active', role: 'batchmate' })
    await adminDb.doc(`batches/${batchId}/paymentConfig/current`).set({ contributionHeads: ['Reunion contribution'], targetPaise: 50000 })

    const submitted = await member.call<{ claimId: string }>('submitPaymentClaim', { batchId, amountPaise: 12000, utr: 'UTR-001', paymentDate: '2027-01-06', contributionHead: 'Reunion contribution' })
    await coordinator.call('reviewPaymentClaim', { batchId, claimId: submitted.data.claimId, status: 'verified' })
    const expense = await coordinator.call<{ expenseId: string }>('saveExpense', { batchId, category: 'venue', amountPaise: 3000, vendor: 'Venue Ltd', expenseDate: '2027-01-06' })
    await coordinator.call('reviewExpense', { batchId, expenseId: expense.data.expenseId, status: 'approved' })

    expect((await adminDb.doc(`batches/${batchId}/fundSummary/public`).get()).data()).toMatchObject({ targetPaise: 50000, collectedPaise: 12000, expensePaise: 3000, balancePaise: 9000, verifiedFamilyCount: 1, verifiedPaymentCount: 1 })
    expect((await adminDb.doc(`batches/${batchId}/paymentClaims/${submitted.data.claimId}`).get()).data()).toMatchObject({ status: 'verified', retentionUntil: expect.anything() })
    expect((await adminDb.doc(`batches/${batchId}/expenses/${expense.data.expenseId}`).get()).data()).toMatchObject({ status: 'approved', retentionUntil: expect.anything() })
  })

  it('rejects unconfigured contribution heads and non-Coordinator finance review', async () => {
    const coordinator = await signIn('finance-two-coordinator@example.test')
    const member = await signIn('finance-two-member@example.test')
    const coordinatorUid = coordinator.auth.currentUser!.uid
    const memberUid = member.auth.currentUser!.uid
    await adminDb.doc(`batches/${batchId}/memberships/${coordinatorUid}`).set({ uid: coordinatorUid, status: 'active', role: 'coordinator' })
    await adminDb.doc(`batches/${batchId}/memberships/${memberUid}`).set({ uid: memberUid, status: 'active', role: 'batchmate' })
    await adminDb.doc(`batches/${batchId}/paymentConfig/current`).set({ contributionHeads: ['Reunion contribution'] })
    await expect(member.call('submitPaymentClaim', { batchId, amountPaise: 100, utr: 'UTR-002', paymentDate: '2027-01-06', contributionHead: 'Forged head' })).rejects.toMatchObject({ code: 'functions/invalid-argument' })
    await expect(member.call('saveExpense', { batchId, category: 'venue', amountPaise: 100, vendor: 'X', expenseDate: '2027-01-06' })).rejects.toMatchObject({ code: 'functions/permission-denied' })
  })
})

describe('Phase 5 archive callables', () => {
  it('enforces consent and persists bounded optional post metadata for active members', async () => {
    const member = await signIn('archive-member@example.test')
    const uid = member.auth.currentUser!.uid
    await adminDb.doc(`batches/${batchId}/memberships/${uid}`).set({ uid, status: 'active', role: 'batchmate' })

    await expect(member.call('createPost', { batchId, caption: 'School trip', consentConfirmed: false })).rejects.toMatchObject({ code: 'functions/failed-precondition' })
    const created = await member.call<{ postId: string }>('createPost', { batchId, caption: 'School trip', peopleTags: ['Aman', 'Aman'], year: 2002, category: 'trips', consentConfirmed: true })
    expect((await adminDb.doc(`batches/${batchId}/posts/${created.data.postId}`).get()).data()).toMatchObject({ authorUid: uid, caption: 'School trip', peopleTags: ['Aman'], year: 2002, category: 'trips', status: 'visible' })
    await expect(member.call('createPost', { batchId, consentConfirmed: true, category: 'forged' })).rejects.toMatchObject({ code: 'functions/invalid-argument' })
  })

  it('keeps moderation coordinator-only and writes an auditable removed state', async () => {
    const coordinator = await signIn('archive-coordinator@example.test')
    const member = await signIn('archive-reporter@example.test')
    const coordinatorUid = coordinator.auth.currentUser!.uid; const memberUid = member.auth.currentUser!.uid
    await adminDb.doc(`batches/${batchId}/memberships/${coordinatorUid}`).set({ uid: coordinatorUid, status: 'active', role: 'coordinator' })
    await adminDb.doc(`batches/${batchId}/memberships/${memberUid}`).set({ uid: memberUid, status: 'active', role: 'batchmate' })
    await adminDb.doc(`batches/${batchId}/posts/post-a`).set({ authorUid: memberUid, status: 'visible' })
    const report = await member.call<{ reportId: string }>('reportArchiveContent', { batchId, targetType: 'post', targetId: 'post-a', category: 'privacy' })
    await expect(member.call('moderateArchiveContent', { batchId, reportId: report.data.reportId, action: 'remove' })).rejects.toMatchObject({ code: 'functions/permission-denied' })
    await coordinator.call('moderateArchiveContent', { batchId, reportId: report.data.reportId, action: 'hide', reason: 'Needs review' })
    expect((await adminDb.doc(`batches/${batchId}/posts/post-a`).get()).data()).toMatchObject({ status: 'hidden', moderatedBy: coordinatorUid })
    expect((await adminDb.doc(`batches/${batchId}/reports/${report.data.reportId}`).get()).data()).toMatchObject({ status: 'resolved', resolution: 'hide' })
    const audits = await adminDb.collection(`batches/${batchId}/auditEvents`).where('action', '==', 'moderation.hide').get()
    expect(audits.docs.map((doc) => doc.data())).toEqual(expect.arrayContaining([expect.objectContaining({ actorUid: coordinatorUid, targetId: 'post-a' })]))
  })
})

describe('Phase 6 notification callables', () => {
  it('delivers announcements and payment outcomes only to the affected active members', async () => {
    const coordinator = await signIn('notification-coordinator@example.test')
    const member = await signIn('notification-member@example.test')
    const coordinatorUid = coordinator.auth.currentUser!.uid; const memberUid = member.auth.currentUser!.uid
    await adminDb.doc(`batches/${batchId}/memberships/${coordinatorUid}`).set({ uid: coordinatorUid, status: 'active', role: 'coordinator' })
    await adminDb.doc(`batches/${batchId}/memberships/${memberUid}`).set({ uid: memberUid, status: 'active', role: 'batchmate' })
    await coordinator.call('publishAnnouncement', { batchId, title: 'Venue confirmed', body: 'Meet at 10am.' })
    const announcements = await adminDb.collection(`batches/${batchId}/notifications/${memberUid}/items`).where('kind', '==', 'announcement').get()
    expect(announcements.docs.map((item) => item.data())).toEqual(expect.arrayContaining([expect.objectContaining({ title: 'Venue confirmed', body: 'Meet at 10am.' })]))
    await adminDb.doc(`batches/${batchId}/paymentClaims/claim`).set({ memberUid, status: 'submitted', amountPaise: 100 })
    await coordinator.call('reviewPaymentClaim', { batchId, claimId: 'claim', status: 'rejected' })
    const payments = await adminDb.collection(`batches/${batchId}/notifications/${memberUid}/items`).where('kind', '==', 'payment').get()
    expect(payments.docs.map((item) => item.data())).toEqual(expect.arrayContaining([expect.objectContaining({ title: 'Payment rejected' })]))
  })

  it('does not let a member acknowledge someone else’s notifications', async () => {
    const member = await signIn('notification-self@example.test')
    const other = await signIn('notification-other@example.test')
    const memberUid = member.auth.currentUser!.uid; const otherUid = other.auth.currentUser!.uid
    await adminDb.doc(`batches/${batchId}/memberships/${memberUid}`).set({ uid: memberUid, status: 'active', role: 'batchmate' })
    await adminDb.doc(`batches/${batchId}/memberships/${otherUid}`).set({ uid: otherUid, status: 'active', role: 'batchmate' })
    await adminDb.doc(`batches/${batchId}/notifications/${memberUid}/items/own`).set({ title: 'Own', body: 'Body', kind: 'rsvp' })
    await member.call('markNotificationsRead', { batchId, notificationIds: ['own'] })
    expect((await adminDb.doc(`batches/${batchId}/notifications/${memberUid}/items/own`).get()).data()?.readAt).toBeDefined()
    await expect(other.call('markNotificationsRead', { batchId, notificationIds: ['own'] })).rejects.toMatchObject({ code: 'functions/internal' })
  })
})
