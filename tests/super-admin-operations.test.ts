import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const operations = readFileSync('guidelineDocs/SUPER-ADMIN-PHASE-5-OPERATIONS.md', 'utf8')
const review = readFileSync('guidelineDocs/SUPER-ADMIN-PHASE-5-SECURITY-REVIEW.md', 'utf8')
const provisioning = readFileSync('scripts/set-super-admin-claim.mjs', 'utf8')

describe('Super Admin Phase 5 release controls', () => {
  test('keeps Super Admin claim changes in an explicit, offline Admin SDK procedure', () => {
    expect(provisioning).toContain("['grant', 'revoke']")
    expect(provisioning).toContain("--confirm-super-admin-claim")
    expect(provisioning).toContain('getUserByEmail')
    expect(provisioning).toContain('setCustomUserClaims')
    expect(provisioning).toContain('delete claims.superAdmin')
    expect(operations).toContain('set-super-admin-claim.mjs')
    expect(operations).toContain('Force a fresh ID token')
  })

  test('documents the required governance incident, offboarding, audit, retention, rollback, and deployment gates', () => {
    for (const requiredSection of ['Incident response', 'Coordinator offboarding', 'Audit-log review and retention verification', 'Rollback', 'Deployment checks']) {
      expect(operations).toContain(requiredSection)
    }
    expect(operations).toContain('Never grant Super Admin through the browser')
  })

  test('records the least-privilege review and keeps unresolved release evidence blocking deployment', () => {
    expect(review).toContain('Firestore Rules deny every client')
    expect(review).toContain('enforced in production')
    expect(review).toContain('No unresolved high or critical code finding')
    expect(review).toContain('release blockers')
  })
})
