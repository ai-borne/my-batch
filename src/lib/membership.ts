export const PILOT_BATCH_ID = 'batch-2002-3711'

export type MembershipStatus = 'none' | 'pending' | 'active' | 'suspended' | 'removed'
export type Membership = { status: MembershipStatus; role?: 'batchmate' | 'coordinator' }

export function destinationFor(membership: Membership): '/' | '/request-access' | '/pending' | '/home' | '/access-denied' {
  if (membership.status === 'none') return '/request-access'
  if (membership.status === 'pending') return '/pending'
  if (membership.status === 'active') return '/home'
  return '/access-denied'
}
