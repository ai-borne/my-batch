import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { InstallButton } from '../app/InstallButton'
import { OfflineNotice } from '../app/Resilience'

const links = [
  ['home', 'Home'], ['houses', 'Houses'], ['reunion', 'Reunion'], ['memories', 'Memories'], ['fund', 'Fund'], ['account', 'Account'],
] as const

export function BatchShell() {
  const { membership, signOut } = useAuth()
  return <div className="app"><header className="topbar"><NavLink className="brand-mark" to="/home">Ajinkyans</NavLink><div className="topbar-actions"><InstallButton />{membership?.role === 'coordinator' && <NavLink className="text-button" to="/admin">Manage</NavLink>}<button className="text-button" onClick={() => void signOut()}>Sign out</button></div></header><main className="main-content"><OfflineNotice /><Outlet /></main><nav className="bottom-nav" aria-label="Batch navigation">{links.map(([path, label]) => <NavLink key={path} className="nav-item" to={`/${path}`}>{label}</NavLink>)}</nav></div>
}
