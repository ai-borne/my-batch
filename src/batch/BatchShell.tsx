import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { OfflineNotice } from '../app/Resilience'
import { loadTheme } from '../lib/profile'
import { DesktopNavigation, MobileNavigation } from './BatchNavigation'
import { HeaderUtilities } from './HeaderUtilities'
import { COPY } from '../lib/copy'

export function BatchShell() {
  const { membership, signOut } = useAuth()
  return <div className={`app ${loadTheme() === 'dark' ? 'dark' : ''}`}><header className="topbar"><NavLink className="brand-mark" to="/home">{COPY.appName}</NavLink><DesktopNavigation role={membership?.role} /><HeaderUtilities onSignOut={() => void signOut()} /></header><main className="main-content"><OfflineNotice /><Outlet /></main><MobileNavigation role={membership?.role} /></div>
}
