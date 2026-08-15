import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const [action, email, confirmation] = process.argv.slice(2)

if (!['grant', 'revoke'].includes(action) || !email || confirmation !== '--confirm-super-admin-claim') {
  throw new Error('Usage: node scripts/set-super-admin-claim.mjs <grant|revoke> <email> --confirm-super-admin-claim')
}

const app = getApps()[0] ?? initializeApp({ credential: applicationDefault() })
const auth = getAuth(app)
const user = await auth.getUserByEmail(email)
const claims = { ...(user.customClaims ?? {}) }

if (action === 'grant') claims.superAdmin = true
else delete claims.superAdmin

await auth.setCustomUserClaims(user.uid, claims)
console.info('Super Admin claim updated', { action, uid: user.uid, projectId: app.options.projectId ?? process.env.GCLOUD_PROJECT ?? 'inferred-by-credentials' })
