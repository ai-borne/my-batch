import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const deploymentEnvironment = process.env.AJINKYANS_DEPLOYMENT_ENV
const projectId = process.env.AJINKYANS_STAGING_PROJECT_ID
const batchId = process.env.AJINKYANS_STAGING_BATCH_ID
const pageSize = 25

if (deploymentEnvironment !== 'staging' || !projectId || !batchId) throw new Error('Set AJINKYANS_DEPLOYMENT_ENV=staging, AJINKYANS_STAGING_PROJECT_ID, and AJINKYANS_STAGING_BATCH_ID.')
if (!/staging/i.test(projectId)) throw new Error('Refusing to verify: AJINKYANS_STAGING_PROJECT_ID must identify the staging project.')

const app = initializeApp({ credential: applicationDefault(), projectId })
const db = getFirestore()
const collection = (name) => db.collection(`batches/${batchId}/${name}`)
const queries = [
  ['profiles', () => collection('profiles').orderBy('displayName')],
  ['posts', () => collection('posts').where('status', '==', 'visible').orderBy('createdAt', 'desc')],
  ['comments', () => db.collection(`batches/${batchId}/posts/demo-post-01/comments`).where('status', '==', 'visible').orderBy('createdAt', 'desc')],
  ['notifications', () => db.collection(`batches/${batchId}/notifications/demo-member-01/items`).orderBy('createdAt', 'desc')],
  ['approved expenses', () => collection('expenses').where('status', '==', 'approved').orderBy('expenseDate', 'desc')],
  ['payment claims', () => collection('paymentClaims').orderBy('submittedAt', 'desc')],
  ['memberships', () => collection('memberships').orderBy('updatedAt', 'desc')],
  ['access requests', () => collection('accessRequests').where('status', '==', 'pending').orderBy('createdAt', 'desc')],
  ['reports', () => collection('reports').where('status', '==', 'open').orderBy('createdAt', 'desc')],
]

for (const [label, createQuery] of queries) {
  const first = await createQuery().limit(pageSize).get()
  if (first.size !== pageSize || !first.docs.at(-1)) throw new Error(`${label}: expected a full first page of synthetic records.`)
  const next = await createQuery().startAfter(first.docs.at(-1)).limit(pageSize).get()
  if (!next.size) throw new Error(`${label}: expected a non-empty continuation page.`)
  console.log(`${label}: firstPage=${first.size} continuationPage=${next.size}`)
}
await db.terminate()
await app.delete()
process.exit(0)
