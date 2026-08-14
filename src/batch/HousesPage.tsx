import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, query } from 'firebase/firestore/lite'
import { firebaseServices } from '../lib/firebase'
import { HOUSES, PILOT_BATCH_ID } from '../lib/membership'

type Profile = { uid: string; displayName: string; city?: string; profession?: string; houseId?: string }
export function HousesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]); const [search, setSearch] = useState('')
  useEffect(() => { void getDocs(query(collection(firebaseServices().db, `batches/${PILOT_BATCH_ID}/profiles`))).then((result) => setProfiles(result.docs.map((item) => item.data() as Profile))) }, [])
  const filtered = useMemo(() => profiles.filter((profile) => profile.displayName.toLowerCase().includes(search.toLowerCase())), [profiles, search])
  return <section className="page-stack"><div><p className="eyebrow">Our houses</p><h1>Find your <em>brothers.</em></h1><p className="muted">The six houses that shaped the batch.</p></div><div className="house-grid">{HOUSES.map((house) => <article className="panel house-card" key={house.id}><p className="eyebrow">{house.group}</p><h2>{house.name}</h2><p className="muted">{profiles.filter((profile) => profile.houseId === house.id).length} members</p></article>)}</div><div className="panel"><label>Search the directory<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" /></label><div className="directory">{filtered.map((profile) => <div key={profile.uid} className="member-row"><span className="avatar">{profile.displayName.slice(0, 2).toUpperCase()}</span><span><strong>{profile.displayName}</strong><small>{HOUSES.find((house) => house.id === profile.houseId)?.name ?? 'House not assigned'}{profile.city ? ` · ${profile.city}` : ''}</small></span></div>)}{!filtered.length && <p className="muted">No members found.</p>}</div></div></section>
}
