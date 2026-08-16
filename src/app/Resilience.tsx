import { Component, ReactNode, useEffect, useState } from 'react'
import { COPY } from '../lib/copy'
import { reportTelemetry } from '../lib/telemetry'

export function OfflineNotice() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  return online ? null : <p className="connection-notice surface-warning" role="status">{COPY.resilience.offline}</p>
}

type BoundaryState = { failed: boolean }

export class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { void reportTelemetry({ eventCode: 'ui_crash', correlationId: crypto.randomUUID(), surface: 'app' }) }
  render() {
    if (this.state.failed) return <main className="auth-card surface-raised" role="alert"><h1>{COPY.resilience.errorTitle}</h1><p>{COPY.resilience.errorBody}</p></main>
    return this.props.children
  }
}
