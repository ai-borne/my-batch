import { FormEvent, useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore/lite'
import { httpsCallable } from 'firebase/functions'
import { firebaseServices } from '../lib/firebase'
import { PILOT_BATCH_ID } from '../lib/membership'
import { useAuth } from '../auth/AuthProvider'

type Reunion = { title?: string; venue?: string; instructions?: string; rsvpCutoffAt?: { toDate: () => Date } }
type Rsvp = { attendance?: string; accompanyingAdults?: number; accompanyingChildren?: number; foodPreference?: string; hotelRequired?: boolean; miscellaneousDetails?: string }

export function ReunionPage() {
  const { user } = useAuth(); const [config, setConfig] = useState<Reunion>({}); const [rsvp, setRsvp] = useState<Rsvp>({ attendance: 'maybe', accompanyingAdults: 0, accompanyingChildren: 0, foodPreference: 'notSpecified', hotelRequired: false }); const [notice, setNotice] = useState('')
  useEffect(() => { const db = firebaseServices().db; void Promise.all([getDoc(doc(db, `batches/${PILOT_BATCH_ID}/reunion/config`)), user && getDoc(doc(db, `batches/${PILOT_BATCH_ID}/rsvps/${user.uid}`))]).then(([reunion, ownRsvp]) => { setConfig(reunion.data() ?? {}); if (ownRsvp?.exists()) setRsvp(ownRsvp.data()) }) }, [user])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget)
    try { await httpsCallable(firebaseServices().functions, 'submitRsvp')({ batchId: PILOT_BATCH_ID, attendance: values.get('attendance'), accompanyingAdults: Number(values.get('adults')), accompanyingChildren: Number(values.get('children')), foodPreference: values.get('food'), hotelRequired: values.get('hotel') === 'on', miscellaneousDetails: values.get('details') }); setNotice('RSVP saved.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to save RSVP.') }
  }
  const cutoff = config.rsvpCutoffAt?.toDate()
  return <section className="page-stack"><div className="hero-card"><div className="hero-content"><p className="eyebrow">January 2027</p><h1>{config.title ?? 'Silver Jubilee Reunion'}</h1><p className="hero-caption">{config.venue ?? 'Venue details will be announced shortly.'}</p></div></div><div className="panel"><h2>RSVP</h2><p className="muted">{cutoff ? `Please respond by ${cutoff.toLocaleDateString('en-IN')}.` : 'Please let the Coordinators know your plans.'}</p><form className="form-stack" key={JSON.stringify(rsvp)} onSubmit={submit}><label>Will you attend?<select name="attendance" defaultValue={rsvp.attendance}><option value="yes">Yes</option><option value="maybe">Maybe</option><option value="no">No</option></select></label><div className="field-row"><label>Accompanying adults<input name="adults" type="number" min="0" defaultValue={rsvp.accompanyingAdults} /></label><label>Children<input name="children" type="number" min="0" defaultValue={rsvp.accompanyingChildren} /></label></div><label>Food preference<select name="food" defaultValue={rsvp.foodPreference}><option value="notSpecified">Not specified</option><option value="vegetarian">Vegetarian</option><option value="nonVegetarian">Non-vegetarian</option></select></label><label className="check-label"><input name="hotel" type="checkbox" defaultChecked={rsvp.hotelRequired} /> I need accommodation</label><label>Anything else?<textarea name="details" maxLength={1000} defaultValue={rsvp.miscellaneousDetails} /></label><button type="submit">Save RSVP</button>{notice && <p role="status">{notice}</p>}</form></div>{config.instructions && <article className="panel"><h2>Instructions</h2><p className="muted">{config.instructions}</p></article>}</section>
}
