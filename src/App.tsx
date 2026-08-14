import { Navigate, Route, Routes } from 'react-router-dom'
import { AccessRequest } from './auth/AccessRequest'
import { useAuth } from './auth/AuthProvider'
import { destinationFor } from './lib/membership'

function Landing() { const { signIn } = useAuth(); return <main className="auth-card"><p className="eyebrow">Sainik School Satara · 2002 Batch</p><h1>25 years. One brotherhood.</h1><p>Our memories, preserved—privately for approved members.</p><button onClick={() => void signIn()}>Continue with Google</button></main> }
function Pending() { return <main className="auth-card"><h1>Approval pending</h1><p>A Coordinator will review your request. Private batch data remains unavailable until approval.</p></main> }
function Denied() { return <main className="auth-card"><h1>Access unavailable</h1><p>Your batch access is not active. Please contact a Coordinator on WhatsApp.</p></main> }
function Home() { const { membership, signOut } = useAuth(); return <main className="auth-card"><h1>Ajinkyans 2002</h1><p>Private batch home.</p>{membership?.role === 'coordinator' && <p>Coordinator access enabled.</p>}<button onClick={() => void signOut()}>Sign out</button></main> }
function Protected() { const { user, membership, loading } = useAuth(); if (loading) return <main className="auth-card">Loading secure session…</main>; if (!user || !membership) return <Navigate to="/" replace />; const destination = destinationFor(membership); return destination === '/home' ? <Home /> : <Navigate to={destination} replace /> }
function SignedInOnly({ children }: { children: React.ReactNode }) { const { user, loading } = useAuth(); if (loading) return <main className="auth-card">Loading secure session…</main>; return user ? children : <Navigate to="/" replace /> }
export default function App() { return <Routes><Route path="/" element={<Landing />} /><Route path="/request-access" element={<SignedInOnly><AccessRequest /></SignedInOnly>} /><Route path="/pending" element={<SignedInOnly><Pending /></SignedInOnly>} /><Route path="/access-denied" element={<SignedInOnly><Denied /></SignedInOnly>} /><Route path="/home" element={<Protected />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes> }
