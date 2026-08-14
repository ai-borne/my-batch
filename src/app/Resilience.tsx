import { Component, ReactNode, useEffect, useState } from 'react'
import { COPY } from '../lib/copy'

export function OfflineNotice() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  return online ? null : <p className="connection-notice" role="status">You’re offline. Previously opened app screens remain available; {COPY.offlinePrivateData}.</p>
}

type BoundaryState = { failed: boolean }

export class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main className="auth-card" role="alert"><h1>Something went wrong</h1><p>Please refresh the app. If this continues, contact a Coordinator.</p></main>
    return this.props.children
  }
}
