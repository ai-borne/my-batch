import { describe, expect, it } from 'vitest'
import { COPY } from '../src/lib/copy'
import { APP_TIME_ZONE, HOUSES, PASSING_YEAR, PILOT_BATCH_ID } from '../src/lib/batchDefaults'
import { formatIndianDateTime } from '../src/lib/dateFormat'
import { isHouseId, isNonEmptyText, isPositivePaise } from '../src/lib/validators'

describe('Phase 0 shared foundation', () => {
  it('exposes application copy and locked business defaults from single sources', () => {
    expect(COPY.signIn).toBe('Continue with Google')
    expect(PILOT_BATCH_ID).toBe('sssatara-2002')
    expect(PASSING_YEAR).toBe(2002)
    expect(HOUSES).toHaveLength(6)
  })

  it('validates constrained business inputs before they reach a service boundary', () => {
    expect(isHouseId('shivaji')).toBe(true)
    expect(isHouseId('unknown')).toBe(false)
    expect(isNonEmptyText('  Ajinkyans ', 20)).toBe(true)
    expect(isNonEmptyText('   ', 20)).toBe(false)
    expect(isPositivePaise(1)).toBe(true)
    expect(isPositivePaise(0)).toBe(false)
  })

  it('formats timestamps in the agreed India time zone', () => {
    expect(APP_TIME_ZONE).toBe('Asia/Kolkata')
    expect(formatIndianDateTime(new Date('2027-01-01T00:00:00.000Z'))).toContain('5:30 am')
  })
})
