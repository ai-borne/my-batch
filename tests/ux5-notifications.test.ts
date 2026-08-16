import { describe, expect, test } from 'vitest'
import { isNotificationDestination, notificationTimestamp, unreadCount } from '../src/lib/notifications'
import { hasProfileChanges } from '../src/lib/profile'

describe('UX-5 notification destinations stay batch-scoped and safe', () => {
  test('accepts only known member destinations and an optional item id', () => {
    expect(isNotificationDestination({ pathname: '/reunion' })).toBe(true)
    expect(isNotificationDestination({ pathname: '/memories', itemId: 'post-1' })).toBe(true)
    expect(isNotificationDestination({ pathname: '/fund' })).toBe(false)
    expect(isNotificationDestination({ pathname: '/home', itemId: 7 })).toBe(false)
    expect(isNotificationDestination(null)).toBe(false)
    expect(isNotificationDestination({})).toBe(false)
  })
})

describe('UX-5 notification read semantics', () => {
  test('counts unacknowledged notifications without altering them', () => {
    const items = [
      { id: 'a', title: 'A', body: 'B', kind: 'announcement' as const },
      { id: 'b', title: 'C', body: 'D', kind: 'payment' as const, readAt: { toDate: () => new Date() } },
    ]
    expect(unreadCount(items)).toBe(1)
    expect(items[0]).not.toHaveProperty('readAt')
  })

  test('labels the same-day time and a recent date without exposing an exact timestamp', () => {
    const now = new Date('2027-01-06T12:00:00')
    expect(notificationTimestamp({ toDate: () => new Date('2027-01-06T09:30:00') }, now)).toBe('9:30 am')
    expect(notificationTimestamp({ toDate: () => new Date('2027-01-04T09:30:00') }, now)).toContain('Jan')
    expect(notificationTimestamp(undefined)).toBeUndefined()
  })
})

describe('UX-5 account dirty-state detection', () => {
  const base = { uid: 'u', displayName: 'Sameer', city: 'Pune', socialLinks: { linkedin: 'https://linkedin.com/in/sameer' } }
  test('is clean when nothing changed and dirty after a single edit', () => {
    expect(hasProfileChanges(base, { displayName: 'Sameer', city: 'Pune', linkedin: 'https://linkedin.com/in/sameer' })).toBe(false)
    expect(hasProfileChanges(base, { displayName: 'Sameer Khan', city: 'Pune', linkedin: 'https://linkedin.com/in/sameer' })).toBe(true)
  })
  test('detects link changes as an edit', () => {
    expect(hasProfileChanges(base, { displayName: 'Sameer', city: 'Pune', linkedin: '' })).toBe(true)
  })
})