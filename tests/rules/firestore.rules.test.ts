import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const projectId = 'ajinkyans-phase-1-rules'
let environment: RulesTestEnvironment
const db = (uid?: string) => uid ? environment.authenticatedContext(uid).firestore() : environment.unauthenticatedContext().firestore()
beforeAll(async () => { environment = await initializeTestEnvironment({ projectId, firestore: { rules: readFileSync('firestore.rules', 'utf8') } }) })
beforeEach(async () => { await environment.clearFirestore(); await environment.withSecurityRulesDisabled(async (context) => {
  const admin = context.firestore()
  await admin.doc('batches/batch-a').set({ name: 'A' }); await admin.doc('batches/batch-b').set({ name: 'B' })
  await admin.doc('batches/batch-a/memberships/member').set({ status: 'active', role: 'batchmate' })
  await admin.doc('batches/batch-a/memberships/coordinator').set({ status: 'active', role: 'coordinator' })
  await admin.doc('batches/batch-a/memberships/pending').set({ status: 'pending', role: 'batchmate' })
  await admin.doc('batches/batch-b/memberships/other-batch').set({ status: 'active', role: 'batchmate' })
  await admin.doc('batches/batch-a/profiles/member').set({ uid: 'member', displayName: 'Member' })
  await admin.doc('batches/batch-a/paymentClaims/claim').set({ memberUid: 'member', utr: 'UTR' })
}) })
afterAll(async () => { if (environment) await environment.cleanup() })
describe('private batch boundaries', () => {
  it('denies unauthenticated and pending reads', async () => { const anonymous = db(); const pending = db('pending'); await assertFails(anonymous.doc('batches/batch-a/profiles/member').get()); await assertFails(pending.doc('batches/batch-a/profiles/member').get()) })
  it('allows active members only within their batch', async () => { const member = db('member'); const otherBatch = db('other-batch'); await assertSucceeds(member.doc('batches/batch-a/profiles/member').get()); await assertFails(otherBatch.doc('batches/batch-a/profiles/member').get()) })
  it('keeps payment claims Coordinator-only', async () => { const member = db('member'); const coordinator = db('coordinator'); await assertFails(member.doc('batches/batch-a/paymentClaims/claim').get()); await assertSucceeds(coordinator.doc('batches/batch-a/paymentClaims/claim').get()) })
  it('does not permit a client to grant a Coordinator role', async () => { const member = db('member'); await assertFails(member.doc('batches/batch-a/memberships/member').set({ status: 'active', role: 'coordinator' })) })
})
