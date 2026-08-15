import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore/lite'
import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { firebaseServices } from '../lib/firebase'
import { PILOT_BATCH_ID } from '../lib/membership'
import { aggregateHomeStats, countdownLabel, HOME_TIMELINE, type HomeMembership, type HomeProfile } from '../lib/home'
import { PAGE_SIZE } from '../lib/pagination'
import { COPY } from '../lib/copy'

type TimestampValue = { toDate: () => Date }
type HomePost = { id: string; caption?: string; authorName?: string; createdAt?: TimestampValue }
type HomeState = {
  reunionDate?: Date
  stats: { memberCount: number; houseCount: number; cityCount: number }
  posts: HomePost[]
  error?: 'permission' | 'unavailable'
}

const initialState: HomeState = { stats: { memberCount: 0, houseCount: 0, cityCount: 0 }, posts: [] }

function readableError(error: unknown): HomeState['error'] {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'permission-denied' ? 'permission' : 'unavailable'
}

export function HomePage() {
  const location = useLocation()
  const [state, setState] = useState<HomeState>(initialState)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const db = firebaseServices().db
        const [batch, memberships, profiles, posts] = await Promise.all([
          getDoc(doc(db, `batches/${PILOT_BATCH_ID}`)),
          getDocs(query(collection(db, `batches/${PILOT_BATCH_ID}/memberships`), limit(PAGE_SIZE))),
          getDocs(query(collection(db, `batches/${PILOT_BATCH_ID}/profiles`), limit(PAGE_SIZE))),
          getDocs(query(collection(db, `batches/${PILOT_BATCH_ID}/posts`), where('status', '==', 'visible'), orderBy('createdAt', 'desc'), limit(5))),
        ])
        if (!active) return
        const reunionStartDate = batch.data()?.reunionStartDate as TimestampValue | undefined
        setState({
          reunionDate: reunionStartDate?.toDate(),
          stats: aggregateHomeStats(memberships.docs.map((item) => item.data() as HomeMembership), profiles.docs.map((item) => item.data() as HomeProfile)),
          posts: posts.docs.map((item) => ({ id: item.id, ...item.data() } as HomePost)),
        })
      } catch (error) {
        if (active) setState((previous) => ({ ...previous, error: readableError(error) }))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  if (loading) return <section className="panel" aria-busy="true" role="status">Loading your batch home…</section>
  if (state.error === 'permission') return <section className="panel" role="alert"><h1>Home unavailable</h1><p className="muted">Your membership no longer permits this batch data. Please sign out and contact a Coordinator if this is unexpected.</p></section>
  if (state.error === 'unavailable') return <section className="panel" role="alert"><h1>Couldn’t load Home</h1><p className="muted">Check your connection and refresh to try again. No new private data is shown while this request is unavailable.</p></section>

  const reunionDate = state.reunionDate
  return <section className="page-stack">
    {location.state?.coordinatorAccessChanged && <p className="panel" role="status">{COPY.coordinator.accessChanged}</p>}
    <div className="home-intro"><p className="eyebrow">Sainik School Satara · 2002 Batch</p><h1>Our batch,<br /><em>still together.</em></h1></div>
    <section className="home-reunion" aria-labelledby="countdown-heading"><p className="eyebrow">Silver Jubilee reunion</p><h2 id="countdown-heading">{reunionDate ? countdownLabel(reunionDate) : 'Date to be announced'}</h2><p>{reunionDate ? 'until we return to Satara.' : 'Reunion details will appear here when confirmed.'}</p><Link className="button-link" to="/reunion">View reunion <span aria-hidden="true">→</span></Link></section>
    <section className="home-stats" aria-label="Batch statistics">
      <Stat value={state.stats.memberCount} label="members" />
      <Stat value={state.stats.houseCount} label="houses" />
      <Stat value={state.stats.cityCount} label="cities" />
    </section>
    <section className="panel"><div className="section-heading"><div><p className="eyebrow">Our journey</p><h2>From then to now</h2></div></div><ol className="timeline">{HOME_TIMELINE.map((item) => <li className="timeline-item" key={item.year}><span className="timeline-year">{item.year}</span><strong>{item.title}</strong><span>{item.detail}</span></li>)}</ol></section>
    <section aria-labelledby="memories-heading"><div className="section-heading"><div><p className="eyebrow">Private archive</p><h2 id="memories-heading">Latest memories</h2></div><Link className="text-link" to="/memories">All memories</Link></div>{state.posts.length ? <div className="recent-memories">{state.posts.map((post) => <article className="panel recent-memory" key={post.id}><strong>{post.authorName ?? 'Batchmate'}</strong><p className="muted">{post.caption || 'Shared a memory with the batch.'}</p></article>)}</div> : <div className="panel empty-state"><p className="muted">No memories yet. Be the first to share one.</p><Link className="text-link" to="/memories">Open Memories</Link></div>}</section>
  </section>
}

function Stat({ value, label }: { value: number; label: string }) { return <div className="panel"><strong>{value}</strong><span>{label}</span></div> }
