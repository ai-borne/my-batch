import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore/lite'
import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { COPY } from '../lib/copy'
import { firebaseServices } from '../lib/firebase'
import { PILOT_BATCH_ID } from '../lib/membership'
import { countdownLabel } from '../lib/home'
import { type ReunionConfig, reunionStatus } from '../lib/reunion'
import { reunionPresentation } from '../lib/reunionState'

type HomePost = { id: string; caption?: string; authorName?: string }
type HomeState = { config: ReunionConfig; posts: HomePost[]; error?: 'permission' | 'unavailable' }
const initialState: HomeState = { config: {}, posts: [] }

function readableError(error: unknown): HomeState['error'] {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'permission-denied' ? 'permission' : 'unavailable'
}

export function HomePage() {
  const location = useLocation(); const [state, setState] = useState<HomeState>(initialState); const [loading, setLoading] = useState(true); const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const db = firebaseServices().db
        const [reunion, posts] = await Promise.all([
          getDoc(doc(db, `batches/${PILOT_BATCH_ID}/reunion/config`)),
          getDocs(query(collection(db, `batches/${PILOT_BATCH_ID}/posts`), where('status', '==', 'visible'), orderBy('createdAt', 'desc'), limit(5))),
        ])
        if (active) setState({ config: reunion.data() ?? {}, posts: posts.docs.map((item) => ({ id: item.id, ...item.data() } as HomePost)) })
      } catch (error) { if (active) setState((previous) => ({ ...previous, error: readableError(error) })) } finally { if (active) setLoading(false) }
    }
    void load(); return () => { active = false }
  }, [attempt])
  if (loading) return <section className="panel" aria-busy="true" role="status">Loading your batch home…</section>
  if (state.error) return <section className="panel" role="alert"><h1>{state.error === 'permission' ? COPY.reunion.permissionTitle : COPY.reunion.unavailableTitle}</h1><p className="muted">{state.error === 'permission' ? COPY.reunion.permissionBody : COPY.reunion.unavailableBody}</p>{state.error === 'unavailable' && <button type="button" onClick={() => setAttempt((value) => value + 1)}>{COPY.reunion.retry}</button>}</section>
  const presentation = reunionPresentation(reunionStatus(state.config)); const startDate = state.config.reunionStartDate?.toDate(); const title = state.config.title ?? COPY.reunion.homeFallbackTitle
  const action = presentation.cta === 'rsvp' ? COPY.reunion.rsvp : presentation.cta === 'viewDetails' ? COPY.reunion.viewDetails : presentation.cta === 'viewSchedule' ? COPY.reunion.viewSchedule : presentation.cta === 'viewMemories' ? COPY.reunion.viewMemories : COPY.reunion.getNotified
  const actionTo = presentation.cta === 'viewMemories' ? '/memories' : '/reunion'
  return <section className="page-stack">
    {location.state?.coordinatorAccessChanged && <p className="panel" role="status">{COPY.coordinator.accessChanged}</p>}
    <div className="home-intro"><p className="eyebrow">{COPY.batchName}</p><h1>Our batch,<br /><em>still together.</em></h1></div>
    <section className="home-reunion" aria-labelledby="reunion-heading"><p className="eyebrow">{COPY.reunion.homeEyebrow}</p><h2 id="reunion-heading">{presentation.showCountdown && startDate ? countdownLabel(startDate) : title}</h2><p>{presentation.emptyCopyKey ? COPY.reunion[presentation.emptyCopyKey] : presentation.showCountdown && startDate ? COPY.reunion.homeCountdownSuffix : title}</p><Link className="button-link" to={actionTo}>{action} <span aria-hidden="true">→</span></Link></section>
    <section aria-labelledby="memories-heading"><div className="section-heading"><div><p className="eyebrow">Private archive</p><h2 id="memories-heading">Latest memories</h2></div><Link className="text-link" to="/memories">All memories</Link></div>{state.posts.length ? <div className="recent-memories">{state.posts.map((post) => <article className="panel recent-memory" key={post.id}><strong>{post.authorName ?? 'Batchmate'}</strong><p className="muted">{post.caption || 'Shared a memory with the batch.'}</p></article>)}</div> : <div className="panel empty-state"><p className="muted">No memories yet. Be the first to share one.</p><Link className="text-link" to="/memories">Open Memories</Link></div>}</section>
  </section>
}
