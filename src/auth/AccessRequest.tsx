import { FormEvent, useEffect, useState } from 'react'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore/lite'
import { useNavigate } from 'react-router-dom'
import { firebaseServices } from '../lib/firebase'
import { HOUSES, PASSING_YEAR, PILOT_BATCH_ID } from '../lib/batchDefaults'
import { useAuth } from './AuthProvider'
export function AccessRequest() {
  const { user, refreshMembership } = useAuth(); const navigate = useNavigate(); const [error, setError] = useState(''); const [request, setRequest] = useState<{ displayName?: string; houseId?: string; status?: string; rejectionReason?: string } | null>(null)
  useEffect(() => { if (!user) return; void getDoc(doc(firebaseServices().db, `batches/${PILOT_BATCH_ID}/accessRequests/${user.uid}`)).then((snapshot) => setRequest(snapshot.exists() ? snapshot.data() : null)) }, [user])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!user) return; const values = new FormData(event.currentTarget)
    try { const isResubmission = request?.status === 'rejected'; await setDoc(doc(firebaseServices().db, `batches/${PILOT_BATCH_ID}/accessRequests/${user.uid}`), { ...(isResubmission ? { resubmittedAt: serverTimestamp() } : { uid: user.uid, batchId: PILOT_BATCH_ID, passingYear: PASSING_YEAR, createdAt: serverTimestamp() }), displayName: values.get('name'), houseId: values.get('house'), status: 'pending', updatedAt: serverTimestamp() }, { merge: true }); await refreshMembership(); navigate('/pending', { replace: true }) } catch { setError('Your request could not be submitted. Please try again.') }
  }
  return <main className="auth-card"><p className="eyebrow">Ajinkyans 2002</p><h1>Request batch access</h1><p>Access is private to approved batch members.</p>{request?.status === 'rejected' && <p role="alert">Your previous request needs correction: {request.rejectionReason}. Update the details below and resubmit.</p>}<form onSubmit={submit}><label>Name<input name="name" defaultValue={request?.displayName ?? user?.displayName ?? ''} required maxLength={100} /></label><label>House<select name="house" required defaultValue={request?.houseId ?? ''}><option value="" disabled>Select your house</option>{HOUSES.map((house) => <option key={house.id} value={house.id}>{house.name}</option>)}</select></label><button type="submit">{request?.status === 'rejected' ? 'Correct and resubmit' : 'Submit request'}</button>{error && <p role="alert">{error}</p>}</form></main>
}
