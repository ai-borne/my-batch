import { ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { COPY } from '../lib/copy'

export function CoordinatorAccessGate({ children }: { children: (onPermissionDenied: () => Promise<void>) => ReactNode }) {
  const { membership, refreshMembership } = useAuth()
  const [accessState, setAccessState] = useState<'checking' | 'ready' | 'unavailable'>('checking')
  async function refreshCoordinatorAccess() {
    setAccessState('checking')
    try { await refreshMembership(); setAccessState('ready') } catch { setAccessState('unavailable') }
  }
  useEffect(() => {
    let active = true
    void refreshMembership().then(
      () => { if (active) setAccessState('ready') },
      () => { if (active) setAccessState('unavailable') },
    )
    return () => { active = false }
  }, [refreshMembership])
  if (accessState === 'checking') return <section className="panel" role="status">{COPY.coordinator.checkingAccess}</section>
  if (accessState === 'unavailable' || membership?.status !== 'active' || membership.role !== 'coordinator') return <Navigate to="/home" replace state={{ coordinatorAccessChanged: true }} />
  return children(refreshCoordinatorAccess)
}
