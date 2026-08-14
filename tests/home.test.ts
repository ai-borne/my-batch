import { describe, expect, it } from 'vitest'
import { aggregateHomeStats, countdownLabel, HOME_TIMELINE } from '../src/lib/home'
import { canAccessCoordinatorTools, navigationFor } from '../src/batch/navigation'

describe('Phase 2 Home data', () => {
  it('calculates the reunion countdown in whole calendar days', () => {
    expect(countdownLabel(new Date('2027-01-10T00:00:00.000Z'), new Date('2027-01-01T12:00:00.000Z'))).toBe('9 days')
    expect(countdownLabel(new Date('2027-01-01T00:00:00.000Z'), new Date('2027-01-01T12:00:00.000Z'))).toBe('Today')
  })

  it('aggregates only active members and their available batch profile locations', () => {
    expect(aggregateHomeStats(
      [{ status: 'active', houseId: 'shivaji' }, { status: 'pending', houseId: 'nehru' }, { status: 'active', houseId: 'shivaji' }],
      [{ city: 'Pune' }, { city: ' Pune ' }, { city: 'Mumbai' }],
    )).toEqual({ memberCount: 2, houseCount: 1, cityCount: 2 })
  })

  it('keeps the pilot journey ordered through the Silver Jubilee', () => {
    expect(HOME_TIMELINE.map((item) => item.year)).toEqual([1997, 2002, 2027])
  })
})

describe('Phase 2 navigation', () => {
  it('provides exactly the five required member destinations and reserves coordinator tools for Account', () => {
    expect(navigationFor('batchmate').map((item) => item.label)).toEqual(['Home', 'Houses', 'Reunion', 'Memories', 'Account'])
    expect(navigationFor('coordinator').at(-1)).toMatchObject({ label: 'Account', to: '/account' })
    expect(navigationFor('batchmate').map((item) => item.to)).not.toContain('/fund')
    expect(canAccessCoordinatorTools('batchmate')).toBe(false)
    expect(canAccessCoordinatorTools('coordinator')).toBe(true)
  })
})
