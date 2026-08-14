import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const seedScript = readFileSync('scripts/seed-staging.mjs', 'utf8')
const firebaseClient = readFileSync('src/lib/firebase.ts', 'utf8')
const operations = readFileSync('guidelineDocs/AJINKYANS-PHASE-7-OPERATIONS.md', 'utf8')
const securityReview = readFileSync('guidelineDocs/AJINKYANS-PHASE-7-SECURITY-REVIEW.md', 'utf8')
const baseline = readFileSync('guidelineDocs/AJINKYANS-GS-0-BASELINE.md', 'utf8')
const ci = readFileSync('.github/workflows/ci.yml', 'utf8')
const rootPackage = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> }

describe('Phase 7 release controls', () => {
  test('guards synthetic seeding behind explicit staging-only inputs', () => {
    expect(seedScript).toContain("deploymentEnvironment !== 'staging'")
    expect(seedScript).toContain("/staging/i.test(projectId)")
    expect(seedScript).toContain('--confirm-demo-seed')
  })

  test('requires App Check for production clients and records the private operational gates', () => {
    expect(firebaseClient).toContain('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY')
    expect(firebaseClient).toContain('initializeAppCheck')
    expect(firebaseClient).toContain('VITE_FIREBASE_FIRESTORE_EMULATOR_PORT')
    expect(readFileSync('scripts/run-e2e-server.mjs', 'utf8')).toContain('AJINKYANS_E2E_EMULATOR_CONFIG')
    expect(operations).toContain('isolated restore')
    expect(operations).toContain('Deliver and acknowledge a non-production alert')
    expect(operations).toContain('private operator record')
  })

  test('makes unresolved high and critical findings a release blocker', () => {
    expect(securityReview).toContain('No unresolved high or critical finding')
    expect(securityReview).toContain('Blocked pending private staging evidence')
  })

  test('records a repeatable GS-0 baseline and requires every release check in CI', () => {
    expect(baseline).toContain('22.16.0')
    expect(baseline).toContain('two consecutive successful')
    for (const command of ['npm run build', 'npm test', 'npm run test:coverage', 'npm run test:architecture', 'npm run release:controls', 'npm run test:rules', 'npm run test:functions', 'npm run test:e2e', 'npm audit --omit=dev --audit-level=high']) expect(ci).toContain(command)
    expect([...Object.values(rootPackage.dependencies), ...Object.values(rootPackage.devDependencies)]).not.toContain('latest')
  })
})
