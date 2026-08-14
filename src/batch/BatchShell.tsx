import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { InstallButton } from '../app/InstallButton'
import { OfflineNotice } from '../app/Resilience'
import { navigationFor } from './navigation'

export function BatchShell() {
  const { membership, signOut } = useAuth()
  const links = navigationFor(membership?.role)
  return <div className="app"><header className="topbar"><NavLink className="brand-mark" to="/home">Ajinkyans</NavLink><nav className="desktop-nav" aria-label="Batch navigation">{links.map((link) => <NavLink key={link.to} to={link.to}>{link.label}</NavLink>)}</nav><div className="topbar-actions"><InstallButton /><button className="text-button" onClick={() => void signOut()}>Sign out</button></div></header><main className="main-content"><OfflineNotice /><Outlet /></main><nav className="bottom-nav" aria-label="Batch navigation">{links.map((link) => <NavLink key={link.to} className="nav-item" to={link.to}>{link.label}</NavLink>)}</nav></div>
}
