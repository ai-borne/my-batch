import { FormEvent, useState } from 'react'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore/lite'
import { useNavigate } from 'react-router-dom'
import { firebaseServices } from '../lib/firebase'
import { HOUSES, PASSING_YEAR, PILOT_BATCH_ID } from '../lib/batchDefaults'
import { useAuth } from './AuthProvider'
export function AccessRequest() {
  const { user, refreshMembership } = useAuth(); const navigate = useNavigate(); const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!user) return; const values = new FormData(event.currentTarget)
    try { await setDoc(doc(firebaseServices().db, `batches/${PILOT_BATCH_ID}/accessRequests/${user.uid}`), { uid: user.uid, batchId: PILOT_BATCH_ID, displayName: values.get('name'), houseId: values.get('house'), passingYear: PASSING_YEAR, status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }); await refreshMembership(); navigate('/pending', { replace: true }) } catch { setError('Your request could not be submitted. Please try again.') }
  }
  return <main className="auth-card"><p className="eyebrow">Ajinkyans 2002</p><h1>Request batch access</h1><p>Access is private to approved batch members.</p><form onSubmit={submit}><label>Name<input name="name" defaultValue={user?.displayName ?? ''} required maxLength={100} /></label><label>House<select name="house" required defaultValue=""><option value="" disabled>Select your house</option>{HOUSES.map((house) => <option key={house.id} value={house.id}>{house.name}</option>)}</select></label><button type="submit">Submit request</button>{error && <p role="alert">{error}</p>}</form></main>
}
