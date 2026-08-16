import { useCallback, useEffect, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { Link } from 'react-router-dom'
import { COPY } from '../lib/copy'
import { type DirectoryHouse, type DirectoryMember, type DirectoryQuery, type DirectoryResult, normalizeDirectoryQuery } from '../lib/directory'
import { firebaseServices } from '../lib/firebase'
import { PILOT_BATCH_ID } from '../lib/membership'
import { Avatar, EmptyState, ErrorState, Skeleton } from '../ui/Primitives'

type DirectoryState = 'loading' | 'ready' | 'empty' | 'offline' | 'denied' | 'error'
const initialQuery: DirectoryQuery = { limit: 25, sort: 'displayName' }

function failureState(error: unknown): DirectoryState {
  if (!navigator.onLine) return 'offline'
  return typeof error === 'object' && error !== null && 'code' in error && String(error.code).includes('permission-denied') ? 'denied' : 'error'
}

export function HousesPage() {
  const [query, setQuery] = useState(initialQuery); const [members, setMembers] = useState<DirectoryMember[]>([]); const [houses, setHouses] = useState<DirectoryHouse[]>([]); const [nextCursor, setNextCursor] = useState<DirectoryResult['nextCursor']>(null); const [state, setState] = useState<DirectoryState>('loading')
  const load = useCallback(async (next: DirectoryQuery, append = false) => {
    const normalized = normalizeDirectoryQuery(next); setState('loading')
    const request = { batchId: PILOT_BATCH_ID, limit: normalized.limit, sort: normalized.sort, ...(normalized.search ? { search: normalized.search } : {}), ...(Object.keys(normalized.filters ?? {}).length ? { filters: normalized.filters } : {}), ...(normalized.cursor ? { cursor: normalized.cursor } : {}) }
    try { const result = await httpsCallable<typeof request, DirectoryResult>(firebaseServices().functions, 'listDirectoryMembers')(request); setMembers((current) => append ? [...current, ...result.data.members] : result.data.members); setNextCursor(result.data.nextCursor); setState(result.data.members.length || append ? 'ready' : 'empty') } catch (error) { if (!append) setMembers([]); setState(failureState(error)) }
  }, [])
  useEffect(() => { void load(initialQuery); void httpsCallable<{ batchId: string }, { houses: DirectoryHouse[] }>(firebaseServices().functions, 'listDirectoryHouses')({ batchId: PILOT_BATCH_ID }).then((result) => setHouses(result.data.houses)).catch(() => setHouses([])) }, [load])
  function apply(next: DirectoryQuery) { const normalized = normalizeDirectoryQuery(next); setQuery(normalized); void load(normalized) }
  function filter(key: 'house' | 'city' | 'profession', value: string) { apply({ ...query, cursor: undefined, filters: value ? { [key]: value } : {} }) }
  function selectHouse(houseId: string) { filter('house', query.filters?.house === houseId ? '' : houseId) }
  const fallback = state === 'empty' ? <EmptyState title={COPY.directory.emptyTitle}><p>{COPY.directory.emptyBody}</p><button onClick={() => apply(initialQuery)}>{COPY.directory.clearFilters}</button></EmptyState> : state === 'offline' ? <ErrorState title={COPY.directory.offlineTitle}><p>{COPY.directory.offlineBody}</p><button onClick={() => void load(query)}>{COPY.directory.retry}</button></ErrorState> : state === 'denied' ? <ErrorState title={COPY.directory.deniedTitle}><p>{COPY.directory.deniedBody}</p></ErrorState> : state === 'error' ? <ErrorState title={COPY.directory.failedTitle}><p>{COPY.directory.failedBody}</p><button onClick={() => void load(query)}>{COPY.directory.retry}</button></ErrorState> : null
  return <section className="page-stack"><div><p className="eyebrow">{COPY.directory.eyebrow}</p><h1>{COPY.directory.title}</h1><p className="muted">{COPY.directory.intro}</p></div><div className="house-grid" aria-label={COPY.directory.eyebrow}>{houses.map((house) => <button className={`panel house-card house-card--${house.accent}`} type="button" key={house.id} onClick={() => selectHouse(house.id)} aria-pressed={query.filters?.house === house.id}><span className="house-crest" aria-hidden="true">{house.crestLabel}</span><p className="eyebrow">{house.group}</p><h2>{house.name}</h2><p className="muted">{COPY.directory.houseCount(house.memberCount)}</p></button>)}</div><div className="panel form-stack"><label>{COPY.directory.searchLabel}<input value={query.search ?? ''} onChange={(event) => apply({ ...query, cursor: undefined, search: event.target.value })} placeholder={COPY.directory.searchPlaceholder} /></label><div className="directory-filters"><label>{COPY.directory.cityLabel}<input value={query.filters?.city ?? ''} onChange={(event) => filter('city', event.target.value)} /></label><label>{COPY.directory.professionLabel}<input value={query.filters?.profession ?? ''} onChange={(event) => filter('profession', event.target.value)} /></label><label>{COPY.directory.sortLabel}<select value={query.sort} onChange={(event) => apply({ ...query, cursor: undefined, sort: event.target.value as DirectoryQuery['sort'] })}><option value="displayName">{COPY.directory.sortName}</option><option value="house">{COPY.directory.sortHouse}</option></select></label></div>{(query.search || Object.values(query.filters ?? {}).some(Boolean)) && <button className="secondary-button" type="button" onClick={() => apply(initialQuery)}>{COPY.directory.clearFilters}</button>}<p className="muted" aria-live="polite">{COPY.directory.memberCount(members.length)}</p>{state === 'loading' && <Skeleton label={COPY.directory.loading} />}{fallback}{state === 'ready' && <div className="directory">{members.map((member) => <Link key={member.uid} to={`/members/${member.uid}`} className="member-row" aria-label={`View ${member.displayName}'s profile`}><Avatar name={member.displayName} /><span><strong>{member.displayName}</strong><small>{[houses.find((house) => house.id === member.houseId)?.name, member.city, member.profession].filter(Boolean).join(' · ')}</small></span></Link>)}{nextCursor && <button type="button" onClick={() => void load({ ...query, cursor: nextCursor }, true)}>{COPY.directory.loadMore}</button>}</div>}</div></section>
}
