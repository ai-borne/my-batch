import { httpsCallable } from 'firebase/functions'
import { firebaseServices } from '../lib/firebase'
import { PILOT_BATCH_ID } from '../lib/membership'
import { COPY } from '../lib/copy'

export type GovernanceMember = { uid: string; role?: string; displayName?: string; email?: string; memberCode?: string }
type AuditTimestamp = { toMillis?: () => number; seconds?: number; nanoseconds?: number; _seconds?: number; _nanoseconds?: number }
export type AuditEvent = { id: string; action: string; actorUid: string; targetUid: string; reason: string; outcome?: string; roleBefore?: string; roleAfter?: string; createdAt?: number | AuditTimestamp }
export type MemberPage = { members: GovernanceMember[]; nextPageToken: string | null }
export type AuditPage = { events: AuditEvent[]; nextPageToken: string | null }
export type AuditFilters = { action: string; actorUid: string; targetUid: string; from: string; to: string }

function call<T>(name: string, data: Record<string, unknown>) {
  const payload = Object.fromEntries(Object.entries({ batchId: PILOT_BATCH_ID, requestId: crypto.randomUUID(), ...data }).filter(([, value]) => value !== undefined))
  return httpsCallable<Record<string, unknown>, T>(firebaseServices().functions, name)(payload)
}

function timestamp(value: string, endOfDay = false) {
  if (!value) return undefined
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`)
  return Number.isNaN(date.getTime()) ? undefined : date.getTime()
}

export async function listGovernanceMembers({ search = '', pageToken }: { search?: string; pageToken?: string }) {
  const result = await call<MemberPage>('listGovernanceMembers', { search: search.trim() || undefined, pageToken })
  return result.data
}

export async function listGovernanceAuditEvents(filters: AuditFilters, pageToken?: string) {
  const result = await call<AuditPage>('listGovernanceAuditEvents', {
    action: filters.action || undefined,
    actorUid: filters.actorUid.trim() || undefined,
    targetUid: filters.targetUid.trim() || undefined,
    from: timestamp(filters.from),
    to: timestamp(filters.to, true),
    pageToken,
  })
  return result.data
}

export async function assignCoordinator({ memberUid, action, reason }: { memberUid: string; action: 'assign' | 'revoke'; reason: string }) {
  const result = await call<{ updated: boolean }>('assignCoordinator', { memberUid, action, reason })
  return result.data
}

export function auditTime(value: AuditEvent['createdAt']) {
  const seconds = value && typeof value !== 'number' ? (value.seconds ?? value._seconds) : undefined
  const nanoseconds = value && typeof value !== 'number' ? (value.nanoseconds ?? value._nanoseconds ?? 0) : 0
  const milliseconds = typeof value === 'number' ? value : typeof value?.toMillis === 'function' ? value.toMillis() : typeof seconds === 'number' ? seconds * 1_000 + Math.floor(nanoseconds / 1_000_000) : undefined
  return milliseconds ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(milliseconds) : COPY.superAdmin.timestampPending
}
