import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const requiredFiles = [
  'guidelineDocs/AJINKYANS-PHASE-7-OPERATIONS.md',
  'guidelineDocs/AJINKYANS-PHASE-7-SECURITY-REVIEW.md',
  'scripts/seed-staging.mjs',
  'src/lib/firebase.ts',
]
const requiredPhrases = [
  'AJINKYANS_DEPLOYMENT_ENV',
  'confirm-demo-seed',
  'VITE_RECAPTCHA_ENTERPRISE_SITE_KEY',
  'isolated restore',
  'high or critical',
]

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
const trackedContents = await Promise.all(trackedFiles.map(async (file) => ({ file, content: await readFile(file, 'utf8') })))
const combined = trackedContents.map(({ content }) => content).join('\n')
const failures = []

for (const file of requiredFiles) {
  if (!trackedFiles.includes(file)) failures.push(`Required release-control file is not tracked: ${file}`)
}
for (const phrase of requiredPhrases) {
  if (!combined.includes(phrase)) failures.push(`Release-control evidence is missing: ${phrase}`)
}
if (trackedFiles.some((file) => file === '.firebaserc' || (/^\.env(?:\.|$)/.test(file) && file !== '.env.example'))) {
  failures.push('Tracked Firebase project aliases or environment files are prohibited.')
}
if (/(?:BEGIN (?:RSA |EC )?PRIVATE KEY|"type"\s*:\s*"service_account")/.test(combined)) {
  failures.push('A private key or service-account credential appears to be tracked.')
}

if (failures.length) throw new Error(failures.join('\n'))
console.log(`Release controls passed for ${trackedFiles.length} tracked files. Operational evidence remains a private staging gate.`)
