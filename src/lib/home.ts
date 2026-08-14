import { DAY_MS } from './time'

export type HomeMembership = { status?: string; houseId?: string | null }
export type HomeProfile = { city?: string | null }

export const HOME_TIMELINE = [
  { year: 1997, title: 'Joined school', detail: 'The Ajinkyans journey began at Sainik School Satara.' },
  { year: 2002, title: 'Passed out', detail: 'One batch, carrying the brotherhood forward.' },
  { year: 2027, title: 'Silver Jubilee', detail: 'Returning to Satara for our reunion.' },
] as const

export function countdownLabel(target: Date, now = new Date()): string {
  const days = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / DAY_MS))
  return days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'}`
}

export function aggregateHomeStats(memberships: HomeMembership[], profiles: HomeProfile[]) {
  const activeMembers = memberships.filter((member) => member.status === 'active')
  const houseCount = new Set(activeMembers.map((member) => member.houseId).filter(Boolean)).size
  const cityCount = new Set(profiles.map((profile) => profile.city?.trim().toLocaleLowerCase()).filter(Boolean)).size
  return { memberCount: activeMembers.length, houseCount, cityCount }
}
