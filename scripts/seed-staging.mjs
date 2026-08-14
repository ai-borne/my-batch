import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const confirmation = process.argv.includes('--confirm-demo-seed')
const deploymentEnvironment = process.env.AJINKYANS_DEPLOYMENT_ENV
const projectId = process.env.AJINKYANS_STAGING_PROJECT_ID
const batchId = process.env.AJINKYANS_STAGING_BATCH_ID

if (!confirmation || deploymentEnvironment !== 'staging' || !projectId || !batchId) {
  throw new Error('Set AJINKYANS_DEPLOYMENT_ENV=staging, AJINKYANS_STAGING_PROJECT_ID, and AJINKYANS_STAGING_BATCH_ID, then pass --confirm-demo-seed.')
}
if (!/staging/i.test(projectId)) throw new Error('Refusing to seed: AJINKYANS_STAGING_PROJECT_ID must identify the staging project.')

initializeApp({ credential: applicationDefault(), projectId })
const db = getFirestore()
const members = ['Aarav Deshmukh', 'Bharat Jadhav', 'Chaitanya Kulkarni', 'Devendra Patil', 'Eknath Shinde', 'Farhan Shaikh', 'Girish Joshi', 'Harish Bhosale', 'Irfan Khan', 'Jitendra More', 'Kunal Pawar', 'Lokesh Raut']
const houses = ['shivaji', 'nehru', 'karve', 'rana-pratap', 'shastri', 'tilak']
const batch = db.batch()

batch.set(db.doc(`batches/${batchId}`), { name: 'Ajinkyans 2002 — Staging Demo', isDemo: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
members.forEach((displayName, index) => {
  const uid = `demo-member-${index + 1}`
  const houseId = houses[index % houses.length]
  batch.set(db.doc(`batches/${batchId}/memberships/${uid}`), { uid, batchId, role: 'batchmate', status: 'active', houseId, isDemo: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  batch.set(db.doc(`batches/${batchId}/profiles/${uid}`), { uid, displayName, houseId, isDemo: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
})
batch.set(db.doc(`batches/${batchId}/reunion/config`), { title: 'Silver Jubilee Reunion', isDemo: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
await batch.commit()
console.log(`Seeded ${members.length} synthetic members into staging batch ${batchId}.`)
