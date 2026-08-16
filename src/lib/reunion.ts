import { reunionPresentation, type ReunionStatus } from './reunionState'

export type TimestampValue = { toDate: () => Date }
export type ReunionConfig = { status?: ReunionStatus; title?: string; venue?: string; venueMapUrl?: string; accommodation?: string; logistics?: string; instructions?: string; reunionStartDate?: TimestampValue; rsvpCutoffAt?: TimestampValue }
export type AttendanceSummary = { yes?: number; maybe?: number }
export type Rsvp = { attendance?: string; accompanyingAdults?: number; accompanyingChildren?: number; foodPreference?: string; hotelRequired?: boolean; miscellaneousDetails?: string }

export function reunionStatus(config: ReunionConfig): ReunionStatus { return config.status ?? 'announced' }
export function validatedMapUrl(value: string | undefined): string | null {
  if (!value) return null
  try { const url = new URL(value); return url.protocol === 'https:' ? url.toString() : null } catch { return null }
}
