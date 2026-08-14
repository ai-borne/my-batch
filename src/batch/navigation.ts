import type { MembershipRole } from '../lib/types'

export type NavigationItem = { to: string; label: string }

const MEMBER_NAVIGATION: readonly NavigationItem[] = [
  { to: '/home', label: 'Home' },
  { to: '/houses', label: 'Houses' },
  { to: '/reunion', label: 'Reunion' },
  { to: '/memories', label: 'Memories' },
  { to: '/account', label: 'Account' },
]

export function navigationFor(_role?: MembershipRole): readonly NavigationItem[] {
  return MEMBER_NAVIGATION
}

export function canAccessCoordinatorTools(role?: MembershipRole): boolean {
  return role === 'coordinator'
}
