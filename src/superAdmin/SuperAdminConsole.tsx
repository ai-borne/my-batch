import { useAuth } from '../auth/AuthProvider'
import { COPY } from '../lib/copy'
import { AuditLog } from './AuditLog'
import { CoordinatorDirectory } from './CoordinatorDirectory'
import { assignCoordinator, listGovernanceAuditEvents, listGovernanceMembers } from './governance'

export function SuperAdminConsole() {
  const { signOut, reauthenticate } = useAuth()
  async function changeCoordinator(memberUid: string, action: 'assign' | 'revoke', reason: string) {
    try {
      await reauthenticate()
      const result = await assignCoordinator({ memberUid, action, reason })
      if (!result.updated) throw new Error(COPY.superAdmin.noChange)
    } catch (error) { throw error instanceof Error && error.message === COPY.superAdmin.noChange ? error : new Error(COPY.superAdmin.roleChangeFailed) }
  }

  return <main className="super-admin-console"><header className="super-admin-header"><div><p className="eyebrow">{COPY.superAdmin.label}</p><h1>{COPY.superAdmin.title}</h1><p>{COPY.superAdmin.intro}</p></div><button className="secondary-button" onClick={() => void signOut()}>{COPY.superAdmin.signOut}</button></header><CoordinatorDirectory load={(search, pageToken) => listGovernanceMembers({ search, pageToken })} onChange={changeCoordinator} /><AuditLog load={listGovernanceAuditEvents} /></main>
}
