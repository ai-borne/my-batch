import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, query } from 'firebase/firestore/lite'
import { Link } from 'react-router-dom'
import { firebaseServices } from '../lib/firebase'
import { HOUSES, PILOT_BATCH_ID } from '../lib/membership'

type Profile = { uid: string; displayName: string; city?: string; profession?: string; houseId?: string }
export function HousesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]); const [search, setSearch] = useState(''); const [houseId, setHouseId] = useState('')
  useEffect(() => { void getDocs(query(collection(firebaseServices().db, `batches/${PILOT_BATCH_ID}/profiles`))).then((result) => setProfiles(result.docs.map((item) => item.data() as Profile))) }, [])
  const filtered = useMemo(() => profiles.filter((profile) => (!houseId || profile.houseId === houseId) && `${profile.displayName} ${profile.city ?? ''} ${profile.profession ?? ''}`.toLowerCase().includes(search.toLowerCase())), [profiles, search, houseId])
  return <section className="page-stack"><div><p className="eyebrow">Our houses</p><h1>Find your <em>brothers.</em></h1><p className="muted">The six houses that shaped the batch.</p></div><div className="house-grid">{HOUSES.map((house) => <button className="panel house-card" type="button" key={house.id} onClick={() => setHouseId(houseId === house.id ? '' : house.id)} aria-pressed={houseId === house.id}><p className="eyebrow">{house.group}</p><h2>{house.name}</h2><p className="muted">{profiles.filter((profile) => profile.houseId === house.id).length} members</p></button>)}</div><div className="panel form-stack"><label>Search the directory<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, city, or profession" /></label><label>Filter by house<select value={houseId} onChange={(event) => setHouseId(event.target.value)}><option value="">All houses</option>{HOUSES.map((house) => <option key={house.id} value={house.id}>{house.name}</option>)}</select></label><div className="directory">{filtered.map((profile) => <Link key={profile.uid} to={`/members/${profile.uid}`} className="member-row" aria-label={`View ${profile.displayName}'s profile`}><span className="avatar">{profile.displayName.slice(0, 2).toUpperCase()}</span><span><strong>{profile.displayName}</strong><small>{HOUSES.find((house) => house.id === profile.houseId)?.name ?? 'House not assigned'}{profile.city ? ` · ${profile.city}` : ''}</small></span></Link>)}{!filtered.length && <p className="muted">No members found.</p>}</div></div></section>
}
