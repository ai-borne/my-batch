export const PAYMENT_CLAIM_STATES = ['draft', 'submitted', 'under_review', 'clarification_required', 'verified', 'rejected', 'resubmitted'] as const
export type PaymentClaimState = typeof PAYMENT_CLAIM_STATES[number]
export type PaymentClaimPresentation = { canEdit: boolean; canSubmit: boolean; canResubmit: boolean; isFinal: boolean; copyKey: 'draft' | 'submitted' | 'underReview' | 'clarificationRequired' | 'verified' | 'rejected' | 'resubmitted' }

const PAYMENT_CLAIM_TRANSITIONS: Record<PaymentClaimState, readonly PaymentClaimState[]> = {
  draft: ['submitted'], submitted: ['under_review', 'clarification_required', 'verified', 'rejected'], under_review: ['clarification_required', 'verified', 'rejected'], clarification_required: ['resubmitted'], verified: [], rejected: ['resubmitted'], resubmitted: ['under_review', 'clarification_required', 'verified', 'rejected'],
}

const CLAIM_PRESENTATION: Record<PaymentClaimState, PaymentClaimPresentation> = {
  draft: { canEdit: true, canSubmit: true, canResubmit: false, isFinal: false, copyKey: 'draft' },
  submitted: { canEdit: false, canSubmit: false, canResubmit: false, isFinal: false, copyKey: 'submitted' },
  under_review: { canEdit: false, canSubmit: false, canResubmit: false, isFinal: false, copyKey: 'underReview' },
  clarification_required: { canEdit: true, canSubmit: false, canResubmit: true, isFinal: false, copyKey: 'clarificationRequired' },
  verified: { canEdit: false, canSubmit: false, canResubmit: false, isFinal: true, copyKey: 'verified' },
  rejected: { canEdit: true, canSubmit: false, canResubmit: true, isFinal: false, copyKey: 'rejected' },
  resubmitted: { canEdit: false, canSubmit: false, canResubmit: false, isFinal: false, copyKey: 'resubmitted' },
}

export function paymentClaimPresentation(state: PaymentClaimState | string | null | undefined): PaymentClaimPresentation {
  return CLAIM_PRESENTATION[(PAYMENT_CLAIM_STATES as readonly string[]).includes(state ?? '') ? state as PaymentClaimState : 'draft']
}

/** Maps legacy callable values to the one member-facing state vocabulary. */
export function paymentClaimState(state: string | null | undefined): PaymentClaimState {
  const aliases: Record<string, PaymentClaimState> = { underReview: 'under_review', clarificationRequired: 'clarification_required' }
  const candidate = aliases[state ?? ''] ?? state
  return (PAYMENT_CLAIM_STATES as readonly string[]).includes(candidate ?? '') ? candidate as PaymentClaimState : 'draft'
}

export function canTransitionPaymentClaim(from: PaymentClaimState, to: PaymentClaimState): boolean {
  return PAYMENT_CLAIM_TRANSITIONS[from].includes(to)
}
