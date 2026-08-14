import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AccessRequest } from './auth/AccessRequest'
import { useAuth } from './auth/AuthProvider'
import { BatchShell } from './batch/BatchShell'
import { destinationFor } from './lib/membership'

const CoordinatorPage = lazy(async () => ({ default: (await import('./batch/CoordinatorPage')).CoordinatorPage }))
const HousesPage = lazy(async () => ({ default: (await import('./batch/HousesPage')).HousesPage }))
const ProfilePage = lazy(async () => ({ default: (await import('./batch/ProfilePage')).ProfilePage }))
const ReunionPage = lazy(async () => ({ default: (await import('./batch/ReunionPage')).ReunionPage }))
const FinancePage = lazy(async () => ({ default: (await import('./batch/FinancePage')).FinancePage }))
const MemoriesPage = lazy(async () => ({ default: (await import('./batch/MemoriesPage')).MemoriesPage }))

function Landing() { const { signIn } = useAuth(); return <main className="auth-card"><p className="eyebrow">Sainik School Satara · 2002 Batch</p><h1>25 years. One brotherhood.</h1><p>Our memories, preserved—privately for approved members.</p><button onClick={() => void signIn()}>Continue with Google</button></main> }
function Pending() { return <main className="auth-card"><h1>Approval pending</h1><p>A Coordinator will review your request. Private batch data remains unavailable until approval.</p></main> }
function Denied() { return <main className="auth-card"><h1>Access unavailable</h1><p>Your batch access is not active. Please contact a Coordinator on WhatsApp.</p></main> }
function Home() { return <section className="page-stack"><div className="hero-card"><div className="hero-content"><p className="eyebrow">Sainik School Satara · 2002 Batch</p><h1>One batch.<br /><em>One home.</em></h1><p className="hero-caption">Silver Jubilee Reunion · January 2027</p></div></div><div className="panel"><h2>Welcome back</h2><p className="muted">Use the directory to reconnect and the reunion hub to confirm your plans.</p></div></section> }
function Protected() { const { user, membership, loading } = useAuth(); if (loading) return <main className="auth-card">Loading secure session…</main>; if (!user || !membership) return <Navigate to="/" replace />; const destination = destinationFor(membership); return destination === '/home' ? <BatchShell /> : <Navigate to={destination} replace /> }
function CoordinatorOnly() { const { membership } = useAuth(); return membership?.role === 'coordinator' ? <CoordinatorPage /> : <Navigate to="/home" replace /> }
function SignedInOnly({ children }: { children: React.ReactNode }) { const { user, loading } = useAuth(); if (loading) return <main className="auth-card">Loading secure session…</main>; return user ? children : <Navigate to="/" replace /> }
export default function App() {
  return <Suspense fallback={<main className="auth-card" role="status">Loading secure screen…</main>}><Routes><Route path="/" element={<Landing />} /><Route path="/request-access" element={<SignedInOnly><AccessRequest /></SignedInOnly>} /><Route path="/pending" element={<SignedInOnly><Pending /></SignedInOnly>} /><Route path="/access-denied" element={<SignedInOnly><Denied /></SignedInOnly>} /><Route element={<Protected />}><Route path="/home" element={<Home />} /><Route path="/houses" element={<HousesPage />} /><Route path="/reunion" element={<ReunionPage />} /><Route path="/memories" element={<MemoriesPage />} /><Route path="/fund" element={<FinancePage />} /><Route path="/account" element={<ProfilePage />} /><Route path="/admin" element={<CoordinatorOnly />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></Suspense>
}
