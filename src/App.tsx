import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AccessRequest } from './auth/AccessRequest'
import { useAuth } from './auth/AuthProvider'
import { BatchShell } from './batch/BatchShell'
import { destinationFor } from './lib/membership'
import { COPY } from './lib/copy'
import { HomePage } from './batch/HomePage'
const CoordinatorPage = lazy(async () => ({ default: (await import('./batch/CoordinatorPage')).CoordinatorPage }))
const HousesPage = lazy(async () => ({ default: (await import('./batch/HousesPage')).HousesPage }))
const ProfilePage = lazy(async () => ({ default: (await import('./batch/ProfilePage')).ProfilePage }))
const MemberProfilePage = lazy(async () => ({ default: (await import('./batch/ProfilePage')).MemberProfilePage }))
const ReunionPage = lazy(async () => ({ default: (await import('./batch/ReunionPage')).ReunionPage }))
const FinancePage = lazy(async () => ({ default: (await import('./batch/FinancePage')).FinancePage }))
const MemoriesPage = lazy(async () => ({ default: (await import('./batch/MemoriesPage')).MemoriesPage }))
function Landing() { const { user, membership, signIn, signInForE2E } = useAuth(); if (user && membership) return <Navigate to={destinationFor(membership)} replace />; return <main className="auth-card"><p className="eyebrow">{COPY.batchName}</p><h1>25 years. One brotherhood.</h1><p>{COPY.privateAccess}</p><button onClick={() => void signIn()}>{COPY.signIn}</button>{import.meta.env.VITE_E2E_AUTH === 'true' && <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void signInForE2E(String(form.get('email')), String(form.get('password'))) }}><label>Test email<input name="email" type="email" /></label><label>Test password<input name="password" type="password" /></label><button type="submit">Test sign in</button></form>}</main> }
function Pending() { return <main className="auth-card"><h1>Approval pending</h1><p>A Coordinator will review your request. Private batch data remains unavailable until approval.</p></main> }
function Denied() { return <main className="auth-card"><h1>Access unavailable</h1><p>Your batch access is not active. Please contact a Coordinator on WhatsApp.</p></main> }
function Protected() { const { user, membership, loading } = useAuth(); if (loading) return <main className="auth-card">Loading secure session…</main>; if (!user || !membership) return <Navigate to="/" replace />; const destination = destinationFor(membership); return destination === '/home' ? <BatchShell /> : <Navigate to={destination} replace /> }
function CoordinatorOnly() { const { membership } = useAuth(); return membership?.role === 'coordinator' ? <CoordinatorPage /> : <Navigate to="/home" replace /> }
function SignedInOnly({ children }: { children: React.ReactNode }) { const { user, loading } = useAuth(); if (loading) return <main className="auth-card">Loading secure session…</main>; return user ? children : <Navigate to="/" replace /> }
export default function App() { return <Suspense fallback={<main className="auth-card" role="status">Loading secure screen…</main>}><Routes><Route path="/" element={<Landing />} /><Route path="/request-access" element={<SignedInOnly><AccessRequest /></SignedInOnly>} /><Route path="/pending" element={<SignedInOnly><Pending /></SignedInOnly>} /><Route path="/access-denied" element={<SignedInOnly><Denied /></SignedInOnly>} /><Route element={<Protected />}><Route path="/home" element={<HomePage />} /><Route path="/houses" element={<HousesPage />} /><Route path="/members/:uid" element={<MemberProfilePage />} /><Route path="/reunion" element={<ReunionPage />} /><Route path="/reunion/fund" element={<FinancePage />} /><Route path="/memories" element={<MemoriesPage />} /><Route path="/account" element={<ProfilePage />} /><Route path="/account/coordinator" element={<CoordinatorOnly />} /><Route path="/fund" element={<Navigate to="/reunion/fund" replace />} /><Route path="/admin" element={<Navigate to="/account/coordinator" replace />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></Suspense> }
