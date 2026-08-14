import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const projectId = 'demo-no-project'
let environment: RulesTestEnvironment
const db = (uid?: string) => uid ? environment.authenticatedContext(uid).firestore() : environment.unauthenticatedContext().firestore()
beforeAll(async () => { environment = await initializeTestEnvironment({ projectId, firestore: { rules: readFileSync('firestore.rules', 'utf8') }, storage: { rules: readFileSync('storage.rules', 'utf8') } }) })
beforeEach(async () => { await environment.clearFirestore(); await environment.clearStorage(); await environment.withSecurityRulesDisabled(async (context) => {
  const admin = context.firestore()
  await admin.doc('batches/batch-a').set({ name: 'A' }); await admin.doc('batches/batch-b').set({ name: 'B' })
  await admin.doc('batches/batch-a/memberships/member').set({ status: 'active', role: 'batchmate' })
  await admin.doc('batches/batch-a/memberships/coordinator').set({ status: 'active', role: 'coordinator' })
  await admin.doc('batches/batch-a/memberships/pending').set({ status: 'pending', role: 'batchmate' })
  await admin.doc('batches/batch-b/memberships/other-batch').set({ status: 'active', role: 'batchmate' })
  await admin.doc('batches/batch-a/profiles/member').set({ uid: 'member', displayName: 'Member' })
  await admin.doc('batches/batch-a/profiles/coordinator').set({ uid: 'coordinator', displayName: 'Coordinator' })
  await admin.doc('batches/batch-a/reunion/config').set({ rsvpCutoffAt: new Date('2027-01-01') })
  await admin.doc('batches/batch-a/paymentClaims/claim').set({ memberUid: 'member', utr: 'UTR' })
  await admin.doc('batches/batch-a/fundSummary/public').set({ collectedPaise: 10000, balancePaise: 10000 })
  await admin.doc('batches/batch-a/expenses/approved').set({ status: 'approved', category: 'Venue', amountPaise: 5000 })
  await admin.doc('batches/batch-a/expenses/draft').set({ status: 'draft', category: 'Venue', amountPaise: 5000 })
  await admin.doc('batches/batch-a/posts/visible').set({ authorUid: 'member', status: 'visible', caption: 'A memory' })
  await admin.doc('batches/batch-a/posts/hidden').set({ authorUid: 'member', status: 'hidden', caption: 'Hidden memory' })
  await admin.doc('batches/batch-a/posts/visible/comments/comment').set({ authorUid: 'member', body: 'Nice', status: 'visible' })
  await admin.doc('batches/batch-a/albums/visible').set({ authorUid: 'member', status: 'visible', title: 'Archive' })
}) })
afterAll(async () => { if (environment) await environment.cleanup() })
describe('private batch boundaries', () => {
  it('denies unauthenticated and pending reads', async () => { const anonymous = db(); const pending = db('pending'); await assertFails(anonymous.doc('batches/batch-a/profiles/member').get()); await assertFails(pending.doc('batches/batch-a/profiles/member').get()) })
  it('allows active members only within their batch', async () => { const member = db('member'); const otherBatch = db('other-batch'); await assertSucceeds(member.doc('batches/batch-a/profiles/member').get()); await assertFails(otherBatch.doc('batches/batch-a/profiles/member').get()) })
  it('keeps payment claims Coordinator-only', async () => { const member = db('member'); const coordinator = db('coordinator'); await assertFails(member.doc('batches/batch-a/paymentClaims/claim').get()); await assertSucceeds(coordinator.doc('batches/batch-a/paymentClaims/claim').get()) })
  it('exposes only aggregate finances and approved expenses to batchmates', async () => {
    const member = db('member')
    await assertSucceeds(member.doc('batches/batch-a/fundSummary/public').get())
    await assertSucceeds(member.doc('batches/batch-a/expenses/approved').get())
    await assertFails(member.doc('batches/batch-a/expenses/draft').get())
  })
  it('denies client writes to finance state and audit records', async () => {
    const member = db('member'); const coordinator = db('coordinator')
    await assertFails(member.doc('batches/batch-a/fundSummary/public').set({ collectedPaise: 999999 }))
    await assertFails(member.doc('batches/batch-a/paymentClaims/new').set({ status: 'verified' }))
    await assertFails(coordinator.doc('batches/batch-a/auditEvents/new').set({ action: 'finance.verified' }))
  })
  it('does not permit a client to grant a Coordinator role', async () => { const member = db('member'); await assertFails(member.doc('batches/batch-a/memberships/member').set({ status: 'active', role: 'coordinator' })) })
  it('lets a member edit only their own profile without changing their house', async () => {
    const member = db('member')
    await assertSucceeds(member.doc('batches/batch-a/profiles/member').update({ city: 'Pune' }))
    await assertFails(member.doc('batches/batch-a/profiles/member').update({ houseId: 'tilak' }))
    await assertFails(member.doc('batches/batch-a/profiles/coordinator').update({ city: 'Pune' }))
  })
  it('limits reunion configuration to Coordinators and RSVP writes to trusted functions', async () => {
    await assertFails(db('member').doc('batches/batch-a/reunion/config').update({ title: 'Changed' }))
    await assertSucceeds(db('coordinator').doc('batches/batch-a/reunion/config').update({ title: 'Silver Jubilee' }))
    await assertFails(db('member').doc('batches/batch-a/rsvps/member').set({ attendance: 'yes' }))
  })
  it('shows only visible archive content to active batch members', async () => {
    const member = db('member')
    await assertSucceeds(member.doc('batches/batch-a/posts/visible').get())
    await assertFails(member.doc('batches/batch-a/posts/hidden').get())
    await assertSucceeds(member.doc('batches/batch-a/posts/visible/comments/comment').get())
    await assertSucceeds(member.doc('batches/batch-a/albums/visible').get())
  })
  it('keeps reports and archive mutations behind trusted moderation operations', async () => {
    const member = db('member'); const coordinator = db('coordinator')
    await assertFails(member.doc('batches/batch-a/posts/new').set({ authorUid: 'member', status: 'visible' }))
    await assertFails(member.doc('batches/batch-a/reports/new').set({ targetType: 'post' }))
    await assertFails(member.doc('batches/batch-a/reports/new').get())
    await assertSucceeds(coordinator.doc('batches/batch-a/reports/new').get())
  })
  it('allows only an active post author to upload permitted archive media', async () => {
    const memberStorage = environment.authenticatedContext('member').storage()
    const otherStorage = environment.authenticatedContext('other-batch').storage()
    await assertSucceeds(memberStorage.ref('batches/batch-a/posts/visible/media/photo.jpg').putString('photo', 'raw', { contentType: 'image/jpeg' }))
    await assertFails(otherStorage.ref('batches/batch-a/posts/visible/media/photo.jpg').putString('photo', 'raw', { contentType: 'image/jpeg' }))
    await assertFails(memberStorage.ref('batches/batch-a/posts/visible/media/file.pdf').putString('pdf', 'raw', { contentType: 'application/pdf' }))
  })
})
