import { FormEvent, useEffect, useState } from 'react'
import { COPY } from '../lib/copy'
import { AuditEvent, AuditFilters, AuditPage, auditTime } from './governance'

const initialFilters: AuditFilters = { action: '', actorUid: '', targetUid: '', from: '', to: '' }
type Props = { load: (filters: AuditFilters, pageToken?: string) => Promise<AuditPage>; refreshKey?: number }

export function AuditLog({ load, refreshKey = 0 }: Props) {
  const [filters, setFilters] = useState(initialFilters)
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [pageToken, setPageToken] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  async function fetchEvents(nextFilters = filters, token?: string, append = false) {
    setState('loading')
    try { const page = await load(nextFilters, token); setEvents((current) => append ? [...current, ...page.events] : page.events); setPageToken(page.nextPageToken); setState('ready') } catch { setState('error') }
  }
  useEffect(() => { void fetchEvents(initialFilters) }, [refreshKey])
  function filter(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void fetchEvents(filters) }
  return <section className="panel super-admin-section" aria-labelledby="audit-log-title">
    <p className="eyebrow">{COPY.superAdmin.auditLabel}</p><h2 id="audit-log-title">{COPY.superAdmin.auditTitle}</h2>
    <form className="super-admin-filters" onSubmit={filter}><label>{COPY.superAdmin.actionLabel}<select value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })}><option value="">{COPY.superAdmin.allActions}</option><option value="coordinator.assigned">coordinator.assigned</option><option value="coordinator.revoked">coordinator.revoked</option></select></label><label>{COPY.superAdmin.actorLabel}<input value={filters.actorUid} onChange={(event) => setFilters({ ...filters, actorUid: event.target.value })} /></label><label>{COPY.superAdmin.targetLabel}<input value={filters.targetUid} onChange={(event) => setFilters({ ...filters, targetUid: event.target.value })} /></label><label>{COPY.superAdmin.fromLabel}<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label><label>{COPY.superAdmin.toLabel}<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label><button type="submit">{COPY.superAdmin.applyFilters}</button></form>
    {state === 'loading' && <p role="status">{COPY.superAdmin.loadingAudit}</p>}
    {state === 'error' && <button onClick={() => void fetchEvents(filters)}>{COPY.superAdmin.retryAudit}</button>}
    {state === 'ready' && !events.length && <p>{COPY.superAdmin.auditEmpty}</p>}
    {state === 'ready' && events.map((event) => <article className="audit-event" key={event.id}><strong>{event.action}</strong><small>{auditTime(event.createdAt)}</small><p>{COPY.superAdmin.actor}: {event.actorUid} · {COPY.superAdmin.target}: {event.targetUid}</p><p>{COPY.superAdmin.reason}: {event.reason}</p></article>)}
    {state === 'ready' && pageToken && <button className="secondary-button" onClick={() => void fetchEvents(filters, pageToken, true)}>{COPY.superAdmin.loadMoreAudit}</button>}
  </section>
}
