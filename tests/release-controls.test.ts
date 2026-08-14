import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const seedScript = readFileSync('scripts/seed-staging.mjs', 'utf8')
const firebaseClient = readFileSync('src/lib/firebase.ts', 'utf8')
const operations = readFileSync('guidelineDocs/AJINKYANS-PHASE-7-OPERATIONS.md', 'utf8')
const securityReview = readFileSync('guidelineDocs/AJINKYANS-PHASE-7-SECURITY-REVIEW.md', 'utf8')

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
    expect(readFileSync('playwright.config.ts', 'utf8')).toContain('AJINKYANS_E2E_EMULATOR_CONFIG')
    expect(operations).toContain('isolated restore')
    expect(operations).toContain('Deliver and acknowledge a non-production alert')
    expect(operations).toContain('private operator record')
  })

  test('makes unresolved high and critical findings a release blocker', () => {
    expect(securityReview).toContain('No unresolved high or critical finding')
    expect(securityReview).toContain('Blocked pending private staging evidence')
  })
})
