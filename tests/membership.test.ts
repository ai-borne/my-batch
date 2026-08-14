import { describe, expect, it } from 'vitest'
import { destinationFor } from '../src/lib/membership'

describe('membership routing', () => {
  it('keeps a pending user away from private batch routes', () => expect(destinationFor({ status: 'pending' })).toBe('/pending'))
  it('allows only active members into the private batch home', () => expect(destinationFor({ status: 'active' })).toBe('/home'))
  it('does not treat a missing membership as batch access', () => expect(destinationFor({ status: 'none' })).toBe('/request-access'))
  it('removes suspended and removed members from private routes', () => {
    expect(destinationFor({ status: 'suspended' })).toBe('/access-denied')
    expect(destinationFor({ status: 'removed' })).toBe('/access-denied')
  })
})
