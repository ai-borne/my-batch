import { HOUSES, PILOT_BATCH_ID } from './batchDefaults'
import type { Membership, MembershipStatus } from './types'

export { HOUSES, PILOT_BATCH_ID }
export type { Membership, MembershipStatus }


export function destinationFor(membership: Membership): '/' | '/request-access' | '/pending' | '/home' | '/access-denied' {
  if (membership.status === 'none') return '/request-access'
  if (membership.status === 'pending') return '/pending'
  if (membership.status === 'active') return '/home'
  return '/access-denied'
}
