import type { Membership } from './membership'
import { destinationFor } from './membership'

export function hasSuperAdminClaim(claims: Record<string, unknown>): boolean {
  return claims.superAdmin === true
}

export function destinationForSession(isSuperAdmin: boolean, membership: Membership): '/super-admin' | ReturnType<typeof destinationFor> {
  return isSuperAdmin ? '/super-admin' : destinationFor(membership)
}

export function canAccessSuperAdminRoute(isSignedIn: boolean, isSuperAdmin: boolean): boolean {
  return isSignedIn && isSuperAdmin
}

export function canAccessMemberFlow(isSuperAdmin: boolean): boolean {
  return !isSuperAdmin
}

export function shouldLoadMemberSession(isSuperAdmin: boolean): boolean {
  return !isSuperAdmin
}

export function isPermissionDenied(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error
    && ['permission-denied', 'functions/permission-denied'].includes(String((error as { code?: unknown }).code))
}
