import { useAuth } from '../auth/AuthProvider'
import { COPY } from '../lib/copy'

export function SuperAdminConsole() {
  const { signOut } = useAuth()

  return <main className="auth-card"><p className="eyebrow">{COPY.superAdmin.label}</p><h1>{COPY.superAdmin.title}</h1><p>{COPY.superAdmin.placeholder}</p><button onClick={() => void signOut()}>{COPY.superAdmin.signOut}</button></main>
}
