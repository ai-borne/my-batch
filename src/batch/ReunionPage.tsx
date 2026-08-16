import { FormEvent, useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore/lite'
import { httpsCallable } from 'firebase/functions'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { calendarEventIcs } from '../lib/calendar'
import { COPY } from '../lib/copy'
import { formatIndianDate } from '../lib/dateFormat'
import { firebaseServices } from '../lib/firebase'
import { PILOT_BATCH_ID } from '../lib/membership'
import { type AttendanceSummary, type ReunionConfig, type Rsvp, reunionStatus, validatedMapUrl } from '../lib/reunion'
import { reunionPresentation } from '../lib/reunionState'

type ScheduleEvent = { id: string; title: string; startsAt?: { toDate: () => Date }; endsAt?: { toDate: () => Date }; location?: string }
type Contact = { id: string; name: string; role?: string; phone?: string }
type State = { config: ReunionConfig; rsvp: Rsvp; attendance: AttendanceSummary; schedule: ScheduleEvent[]; contacts: Contact[]; error?: 'permission' | 'unavailable' }
const initialState: State = { config: {}, rsvp: { attendance: 'maybe', accompanyingAdults: 0, accompanyingChildren: 0, foodPreference: 'notSpecified', hotelRequired: false }, attendance: {}, schedule: [], contacts: [] }

function readableError(error: unknown): State['error'] { return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'permission-denied' ? 'permission' : 'unavailable' }

export function ReunionPage() {
  const { user } = useAuth(); const [state, setState] = useState<State>(initialState); const [loading, setLoading] = useState(true); const [attempt, setAttempt] = useState(0); const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const db = firebaseServices().db
        const [config, ownRsvp, attendance, events, contacts] = await Promise.all([
          getDoc(doc(db, `batches/${PILOT_BATCH_ID}/reunion/config`)),
          user ? getDoc(doc(db, `batches/${PILOT_BATCH_ID}/rsvps/${user.uid}`)) : Promise.resolve(null),
          getDoc(doc(db, `batches/${PILOT_BATCH_ID}/reunion/attendance`)),
          getDocs(query(collection(db, `batches/${PILOT_BATCH_ID}/reunionSchedule`), orderBy('startsAt'), limit(25))),
          getDocs(query(collection(db, `batches/${PILOT_BATCH_ID}/reunionContacts`), orderBy('name'), limit(25))),
        ])
        if (active) setState({ config: config.data() ?? {}, rsvp: ownRsvp?.exists() ? ownRsvp.data() as Rsvp : initialState.rsvp, attendance: attendance.data() ?? {}, schedule: events.docs.map((item) => ({ id: item.id, ...item.data() } as ScheduleEvent)), contacts: contacts.docs.map((item) => ({ id: item.id, ...item.data() } as Contact)) })
      } catch (error) { if (active) setState((previous) => ({ ...previous, error: readableError(error) })) } finally { if (active) setLoading(false) }
    }
    void load(); return () => { active = false }
  }, [attempt, user])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget)
    try { await httpsCallable(firebaseServices().functions, 'submitRsvp')({ batchId: PILOT_BATCH_ID, attendance: values.get('attendance'), accompanyingAdults: Number(values.get('adults')), accompanyingChildren: Number(values.get('children')), foodPreference: values.get('food'), hotelRequired: values.get('hotel') === 'on', miscellaneousDetails: values.get('details') }); setNotice(COPY.reunion.rsvpSaved); setAttempt((value) => value + 1) } catch { setNotice(COPY.reunion.rsvpFailed) }
  }
  function downloadCalendar(event: ScheduleEvent) {
    if (!event.startsAt) return
    const body = calendarEventIcs({ ...event, startsAt: event.startsAt.toDate(), endsAt: event.endsAt?.toDate() }); const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar' })); const link = document.createElement('a'); link.href = url; link.download = 'ajinkyans-reunion.ics'; link.click(); URL.revokeObjectURL(url)
  }
  if (loading) return <section className="panel" aria-busy="true" role="status">Loading reunion…</section>
  if (state.error) return <section className="panel" role="alert"><h1>{state.error === 'permission' ? COPY.reunion.permissionTitle : COPY.reunion.unavailableTitle}</h1><p className="muted">{state.error === 'permission' ? COPY.reunion.permissionBody : COPY.reunion.unavailableBody}</p>{state.error === 'unavailable' && <button type="button" onClick={() => setAttempt((value) => value + 1)}>{COPY.reunion.retry}</button>}</section>
  const presentation = reunionPresentation(reunionStatus(state.config)); const cutoff = state.config.rsvpCutoffAt?.toDate(); const mapUrl = validatedMapUrl(state.config.venueMapUrl)
  return <section className="page-stack"><div className="hero-card"><div className="hero-content"><p className="eyebrow">{COPY.reunion.homeEyebrow}</p><h1>{state.config.title ?? COPY.reunion.homeFallbackTitle}</h1><p className="hero-caption">{presentation.emptyCopyKey ? COPY.reunion[presentation.emptyCopyKey] : state.config.venue ?? COPY.reunion.announced}</p></div></div>
    {presentation.showRsvp && <RsvpForm rsvp={state.rsvp} cutoff={cutoff} notice={notice} onSubmit={submit} />}
    {presentation.showDetails && <><section className="panel"><h2>Who’s coming</h2><p className="muted">{COPY.reunion.attendance(state.attendance.yes ?? 0, state.attendance.maybe ?? 0)}</p></section><section className="panel"><h2>{COPY.reunion.fundTitle}</h2><p className="muted">{COPY.reunion.fundBody}</p><Link className="text-link" to="/reunion/fund">{COPY.reunion.fundAction}</Link></section>{mapUrl && <section className="panel"><h2>{COPY.reunion.venueTitle}</h2><a className="text-link" href={mapUrl} target="_blank" rel="noreferrer">{COPY.reunion.directions}</a>{state.config.logistics && <p className="muted">{state.config.logistics}</p>}</section>}{state.config.accommodation && <section className="panel"><h2>Accommodation</h2><p className="muted">{state.config.accommodation}</p></section>}{state.config.instructions && <article className="panel"><h2>Instructions</h2><p className="muted">{state.config.instructions}</p></article>}</>}
    {presentation.showSchedule && <section className="panel"><h2>{COPY.reunion.schedule}</h2>{state.schedule.map((event) => <div className="member-row" key={event.id}><span><strong>{event.title}</strong><small>{event.startsAt ? formatIndianDate(event.startsAt.toDate()) : 'Time to be announced'}{event.location ? ` · ${event.location}` : ''}</small></span><button type="button" onClick={() => downloadCalendar(event)} disabled={!event.startsAt}>{COPY.reunion.calendar}</button></div>)}{!state.schedule.length && <p className="muted">{COPY.reunion.scheduleEmpty}</p>}</section>}
    {presentation.showDetails && state.contacts.length > 0 && <section className="panel"><h2>Contacts</h2>{state.contacts.map((contact) => <p key={contact.id}><strong>{contact.name}</strong>{contact.role ? ` · ${contact.role}` : ''}{contact.phone ? ` · ${contact.phone}` : ''}</p>)}</section>}
  </section>
}

function RsvpForm({ rsvp, cutoff, notice, onSubmit }: { rsvp: Rsvp; cutoff?: Date; notice: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <section className="panel"><h2>{COPY.reunion.rsvpTitle}</h2><p className="muted">{cutoff ? COPY.reunion.rsvpCutoff(formatIndianDate(cutoff)) : COPY.reunion.rsvpPrompt}</p><form className="form-stack" key={JSON.stringify(rsvp)} onSubmit={onSubmit}><label>Will you attend?<select name="attendance" defaultValue={rsvp.attendance}><option value="yes">Yes</option><option value="maybe">Maybe</option><option value="no">No</option></select></label><div className="field-row"><label>Accompanying adults<input name="adults" type="number" min="0" defaultValue={rsvp.accompanyingAdults} /></label><label>Children<input name="children" type="number" min="0" defaultValue={rsvp.accompanyingChildren} /></label></div><label>Food preference<select name="food" defaultValue={rsvp.foodPreference}><option value="notSpecified">Not specified</option><option value="vegetarian">Vegetarian</option><option value="nonVegetarian">Non-vegetarian</option></select></label><label className="check-label"><input name="hotel" type="checkbox" defaultChecked={rsvp.hotelRequired} /> I need accommodation</label><label>Anything else?<textarea name="details" maxLength={1000} defaultValue={rsvp.miscellaneousDetails} /></label><button type="submit">{COPY.reunion.saveRsvp}</button>{notice && <p role="status">{notice}</p>}</form></section>
}
