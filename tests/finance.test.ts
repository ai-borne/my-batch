import { describe, expect, it } from 'vitest'
import { EXPENSE_CATEGORIES, fundTotals, ledgerCsv } from '../src/lib/finance'
import { canTransitionPaymentClaim, paymentClaimPresentation, paymentClaimState } from '../src/lib/paymentClaim'
import { calendarEventIcs } from '../src/lib/calendar'

describe('Phase 4 finance contracts', () => {
  it('derives member-visible totals from verified payments and approved expenses only', () => {
    expect(fundTotals([{ status: 'verified', amountPaise: 10000, memberUid: 'a' }, { status: 'submitted', amountPaise: 5000, memberUid: 'b' }, { status: 'verified', amountPaise: 2000, memberUid: 'a' }], [{ status: 'approved', amountPaise: 3000 }, { status: 'draft', amountPaise: 9000 }], 50000)).toEqual({ targetPaise: 50000, collectedPaise: 12000, expensePaise: 3000, balancePaise: 9000, verifiedFamilyCount: 1, verifiedPaymentCount: 2 })
  })
  it('uses a fixed, escaped CSV ledger schema so exports remain reconcilable', () => {
    expect(ledgerCsv([{ recordType: 'expense', recordId: 'e1', status: 'approved', amountPaise: 2500, vendor: 'A "quoted", vendor' }])).toBe('recordType,recordId,status,amountPaise,contributionHead,category,vendor,memberUid,transactionDate\n"expense","e1","approved","2500","","","A ""quoted"", vendor","",""')
  })
  it('limits expenses to the approved operational taxonomy', () => expect(EXPENSE_CATEGORIES).toContain('venue'))
  it('exports a portable, newline-safe calendar event', () => {
    expect(calendarEventIcs({ id: 'event-1', title: 'Welcome\nDinner', location: 'Satara, India', startsAt: new Date('2027-01-06T12:00:00.000Z') })).toContain('SUMMARY:Welcome Dinner')
  })
  it('maps persisted claim states into recoverable member actions without accepting unknown states', () => {
    expect(paymentClaimState('underReview')).toBe('under_review')
    expect(paymentClaimState('clarificationRequired')).toBe('clarification_required')
    expect(paymentClaimPresentation(paymentClaimState('rejected')).canResubmit).toBe(true)
    expect(canTransitionPaymentClaim('clarification_required', 'resubmitted')).toBe(true)
    expect(paymentClaimState('unexpected')).toBe('draft')
  })
})
