import { describe, expect, it } from 'vitest'
import { normalizeDirectoryQuery } from '../src/lib/directory'
import { canTransitionPaymentClaim, paymentClaimPresentation, PAYMENT_CLAIM_STATES } from '../src/lib/paymentClaim'
import { REUNION_PRESENTATION, REUNION_STATUSES, reunionPresentation } from '../src/lib/reunionState'

describe('UX-0 state contracts', () => {
  it('maps every defined reunion state to a single permissible member presentation and safely falls back', () => {
    expect(Object.keys(REUNION_PRESENTATION)).toEqual(REUNION_STATUSES)
    expect(reunionPresentation('rsvp_open')).toMatchObject({ cta: 'rsvp', showCountdown: true, showSchedule: false })
    expect(reunionPresentation('unknown')).toEqual(REUNION_PRESENTATION.announced)
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
  })
})
