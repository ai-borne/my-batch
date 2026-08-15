import { describe, expect, it } from 'vitest'
import { canAccessMemberFlow, canAccessSuperAdminRoute, destinationForSession, hasSuperAdminClaim, shouldLoadMemberSession } from '../src/lib/authorization'

describe('Super Admin authorization routing', () => {
  it('recognizes only a boolean Firebase ID-token Super Admin claim', () => {
    expect(hasSuperAdminClaim({ superAdmin: true })).toBe(true)
    expect(hasSuperAdminClaim({ superAdmin: 'true' })).toBe(false)
    expect(hasSuperAdminClaim({ role: 'superAdmin' })).toBe(false)
  })

  it('sends a claimed Super Admin to the isolated console without a membership', () => {
    expect(destinationForSession(true, { status: 'none' })).toBe('/super-admin')
  })

  it('denies Super Admin access to member and request-access flows', () => {
    expect(canAccessMemberFlow(true)).toBe(false)
    expect(destinationForSession(true, { status: 'active', role: 'coordinator' })).toBe('/super-admin')
  })

  it('does not initialise member records for a Super Admin session', () => {
    expect(shouldLoadMemberSession(true)).toBe(false)
    expect(shouldLoadMemberSession(false)).toBe(true)
  })

  it('allows only a signed-in claimed Super Admin to access the console', () => {
    expect(canAccessSuperAdminRoute(true, true)).toBe(true)
    expect(canAccessSuperAdminRoute(true, false)).toBe(false)
    expect(canAccessSuperAdminRoute(false, true)).toBe(false)
  })
})
