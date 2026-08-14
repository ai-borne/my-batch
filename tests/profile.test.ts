import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, loadTheme, profileValues } from '../src/lib/profile'

describe('Phase 3 profile validation', () => {
  it('accepts optional HTTPS social links while rejecting unsafe links', () => {
    expect(profileValues({ displayName: 'Member', linkedin: 'https://linkedin.com/in/member' }).socialLinks).toEqual({ linkedin: 'https://linkedin.com/in/member' })
    expect(() => profileValues({ displayName: 'Member', website: 'http://example.test' })).toThrow('website must be a valid HTTPS URL.')
  })
  it('requires a bounded display name', () => {
    expect(() => profileValues({ displayName: ' ' })).toThrow('Name is required.')
    expect(() => profileValues({ displayName: 'a'.repeat(101) })).toThrow('displayName is too long.')
  })
})

describe('Phase 3 theme preference', () => {
  beforeEach(() => localStorage.clear())
  it('persists the selected theme for later sessions', () => { applyTheme('dark'); expect(loadTheme()).toBe('dark'); expect(document.documentElement.dataset.theme).toBe('dark') })
})
