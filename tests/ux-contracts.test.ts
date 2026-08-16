import { describe, expect, it } from 'vitest'
import { directorySearchFields, normalizeDirectoryQuery } from '../src/lib/directory'
import { canTransitionPaymentClaim, paymentClaimPresentation, PAYMENT_CLAIM_STATES } from '../src/lib/paymentClaim'
import { REUNION_PRESENTATION, REUNION_STATUSES, reunionPresentation } from '../src/lib/reunionState'
import { reunionStatus, validatedMapUrl } from '../src/lib/reunion'

describe('UX-0 state contracts', () => {
  it('maps every defined reunion state to a single permissible member presentation and safely falls back', () => {
    expect(Object.keys(REUNION_PRESENTATION)).toEqual(REUNION_STATUSES)
    expect(REUNION_STATUSES.map(reunionPresentation)).toEqual([
      expect.objectContaining({ cta: 'getNotified', showRsvp: false, showSchedule: false, showDetails: false }),
      expect.objectContaining({ cta: 'rsvp', showRsvp: true, showSchedule: false, showDetails: false }),
      expect.objectContaining({ cta: 'viewDetails', showRsvp: false, showSchedule: false, showDetails: true }),
      expect.objectContaining({ cta: 'viewSchedule', showRsvp: false, showSchedule: true, showDetails: true }),
      expect.objectContaining({ cta: 'viewMemories', showRsvp: false, showSchedule: true, showDetails: true }),
      expect.objectContaining({ cta: 'viewMemories', showRsvp: false, showSchedule: true, showDetails: true }),
    ])
    expect(reunionPresentation('unknown')).toEqual(REUNION_PRESENTATION.announced)
  })

  it('uses the config status as the only Home and Reunion state source and permits only secure map actions', () => {
    expect(reunionStatus({ status: 'confirmed' })).toBe('confirmed')
    expect(reunionStatus({})).toBe('announced')
    expect(validatedMapUrl('https://maps.example.test/venue')).toBe('https://maps.example.test/venue')
    expect(validatedMapUrl('javascript:alert(1)')).toBeNull()
  })

  it('defines a recovery presentation for every payment state and treats an unknown state as a safe draft', () => {
    expect(PAYMENT_CLAIM_STATES.map(paymentClaimPresentation).every((state) => state.copyKey)).toBe(true)
    expect(paymentClaimPresentation('rejected')).toMatchObject({ canEdit: true, canResubmit: true })
    expect(paymentClaimPresentation('invalid')).toEqual(paymentClaimPresentation('draft'))
    expect(canTransitionPaymentClaim('clarification_required', 'resubmitted')).toBe(true)
    expect(canTransitionPaymentClaim('verified', 'rejected')).toBe(false)
  })

  it('normalizes only permitted directory filters before a server query is made', () => {
    expect(normalizeDirectoryQuery({ search: '  Ajin KyaNs ', filters: { house: ' Tilak ', city: ' Pune ', profession: '  ', unknown: 'ignore' } as never, sort: 'invalid' as never, limit: 20 })).toEqual({ search: 'ajin kyans', filters: { house: 'tilak', city: 'pune' }, sort: 'displayName', limit: 20 })
    expect(normalizeDirectoryQuery({ limit: 99 })).toMatchObject({ limit: 50, sort: 'displayName' })
    expect(directorySearchFields({ displayName: ' Ajinkya Rao ', city: ' Pune ', profession: ' Engineer ', houseId: 'tilak' })).toEqual({ directoryDisplayName: 'ajinkya rao', directoryCity: 'pune', directoryProfession: 'engineer', directoryHouseId: 'tilak' })
  })
})
