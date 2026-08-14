import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { OfflineNotice } from '../src/app/Resilience'
import { unreadCount } from '../src/lib/notifications'

const onlineDescriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), 'onLine')

afterEach(() => {
  delete (navigator as Navigator & { onLine?: boolean }).onLine
  if (onlineDescriptor) Object.defineProperty(Object.getPrototypeOf(navigator), 'onLine', onlineDescriptor)
})

test('counts only notifications that have not been acknowledged', () => {
  expect(unreadCount([{ id: 'new', title: 'New', body: 'Body', kind: 'announcement' }, { id: 'read', title: 'Read', body: 'Body', kind: 'payment', readAt: { toDate: () => new Date() } }])).toBe(1)
})

describe('offline resilience', () => {
  test('explains that offline mode does not expose new private data', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    render(<OfflineNotice />)
    expect(screen.getByRole('status')).toHaveTextContent('private data will refresh when you reconnect')
  })
})
