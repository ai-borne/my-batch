export const REUNION_STATUSES = ['announced', 'rsvp_open', 'rsvp_closed', 'confirmed', 'completed', 'archived'] as const
export type ReunionStatus = typeof REUNION_STATUSES[number]
export type ReunionPresentation = { cta: 'getNotified' | 'rsvp' | 'viewDetails' | 'viewSchedule' | 'viewMemories'; showCountdown: boolean; showSchedule: boolean; showRsvp: boolean; showDetails: boolean; notifyMembers: boolean; emptyCopyKey: 'announced' | 'rsvpClosed' | 'completed' | 'archived' | null }

export const REUNION_PRESENTATION: Record<ReunionStatus, ReunionPresentation> = {
  announced: { cta: 'getNotified', showCountdown: false, showSchedule: false, showRsvp: false, showDetails: false, notifyMembers: true, emptyCopyKey: 'announced' },
  rsvp_open: { cta: 'rsvp', showCountdown: true, showSchedule: false, showRsvp: true, showDetails: false, notifyMembers: true, emptyCopyKey: null },
  rsvp_closed: { cta: 'viewDetails', showCountdown: true, showSchedule: false, showRsvp: false, showDetails: true, notifyMembers: false, emptyCopyKey: 'rsvpClosed' },
  confirmed: { cta: 'viewSchedule', showCountdown: true, showSchedule: true, showRsvp: false, showDetails: true, notifyMembers: true, emptyCopyKey: null },
  completed: { cta: 'viewMemories', showCountdown: false, showSchedule: true, showRsvp: false, showDetails: true, notifyMembers: false, emptyCopyKey: 'completed' },
  archived: { cta: 'viewMemories', showCountdown: false, showSchedule: true, showRsvp: false, showDetails: true, notifyMembers: false, emptyCopyKey: 'archived' },
}

export function reunionPresentation(status: ReunionStatus | string | null | undefined): ReunionPresentation {
  return REUNION_PRESENTATION[(REUNION_STATUSES as readonly string[]).includes(status ?? '') ? status as ReunionStatus : 'announced']
}
