import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

const links = [
  ['home', 'Home'], ['houses', 'Houses'], ['reunion', 'Reunion'], ['fund', 'Fund'], ['account', 'Account'],
] as const

export function BatchShell() {
  const { membership, signOut } = useAuth()
  return <div className="app"><header className="topbar"><NavLink className="brand-mark" to="/home">Ajinkyans</NavLink><div className="topbar-actions">{membership?.role === 'coordinator' && <NavLink className="text-button" to="/admin">Manage</NavLink>}<button className="text-button" onClick={() => void signOut()}>Sign out</button></div></header><main className="main-content"><Outlet /></main><nav className="bottom-nav" aria-label="Batch navigation">{links.map(([path, label]) => <NavLink key={path} className="nav-item" to={`/${path}`}>{label}</NavLink>)}</nav></div>
}
