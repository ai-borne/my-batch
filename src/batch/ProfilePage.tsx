import { FormEvent, useEffect, useState } from 'react'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore/lite'
import { firebaseServices } from '../lib/firebase'
import { PILOT_BATCH_ID } from '../lib/membership'
import { useAuth } from '../auth/AuthProvider'
import { Link } from 'react-router-dom'
import { canAccessCoordinatorTools } from './navigation'

type Profile = { displayName?: string; city?: string; profession?: string; about?: string; favouriteSchoolMemory?: string; teacherOrActivity?: string }
const fields: Array<[keyof Profile, string, number]> = [['displayName', 'Name', 100], ['city', 'City', 100], ['profession', 'Profession', 100], ['about', 'About', 500], ['favouriteSchoolMemory', 'Favourite school memory', 500], ['teacherOrActivity', 'Favourite teacher or activity', 150]]

export function ProfilePage() {
  const { user, membership } = useAuth(); const [profile, setProfile] = useState<Profile>({}); const [notice, setNotice] = useState('')
  useEffect(() => { if (user) void getDoc(doc(firebaseServices().db, `batches/${PILOT_BATCH_ID}/profiles/${user.uid}`)).then((snapshot) => setProfile(snapshot.data() ?? {})) }, [user])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!user) return
    const values = new FormData(event.currentTarget); const next = Object.fromEntries(fields.map(([key]) => [key, String(values.get(key) ?? '').trim()])) as Profile
    await setDoc(doc(firebaseServices().db, `batches/${PILOT_BATCH_ID}/profiles/${user.uid}`), { uid: user.uid, ...next, updatedAt: serverTimestamp() }, { merge: true })
    setProfile(next); setNotice('Profile saved.')
  }
  return <section className="page-stack"><div><p className="eyebrow">Account</p><h1>Your profile</h1><p className="muted">Your profile is visible only to approved batch members.</p></div><form className="panel form-stack" key={JSON.stringify(profile)} onSubmit={save}>{fields.map(([key, label, max]) => <label key={key}>{label}{key === 'about' || key === 'favouriteSchoolMemory' ? <textarea name={key} defaultValue={profile[key]} maxLength={max} /> : <input name={key} defaultValue={profile[key]} maxLength={max} required={key === 'displayName'} />}</label>)}<button type="submit">Save profile</button>{notice && <p role="status">{notice}</p>}</form>{canAccessCoordinatorTools(membership?.role) && <section className="panel"><h2>Coordinator tools</h2><p className="muted">Manage batch operations, access requests, and reunion settings.</p><Link className="text-link" to="/account/coordinator">Open Coordinator tools</Link></section>}</section>
}
