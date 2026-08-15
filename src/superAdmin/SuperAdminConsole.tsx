import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { COPY } from '../lib/copy'
import { AuditLog } from './AuditLog'
import { CoordinatorDirectory } from './CoordinatorDirectory'
import { CoordinatorBootstrap } from './CoordinatorBootstrap'
import {
  assignCoordinator,
  bootstrapCoordinator,
  listBootstrapCandidates,
  listGovernanceAuditEvents,
  listGovernanceMembers,
} from './governance'

export function SuperAdminConsole() {
  const { signOut, reauthenticate } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const [bootstrapNotice, setBootstrapNotice] = useState('')
  async function changeCoordinator(memberUid: string, action: 'assign' | 'revoke', reason: string) {
    try {
      await reauthenticate()
      const result = await assignCoordinator({ memberUid, action, reason })
      if (!result.updated) throw new Error(COPY.superAdmin.noChange)
    } catch (error) { throw error instanceof Error && error.message === COPY.superAdmin.noChange ? error : new Error(COPY.superAdmin.roleChangeFailed) }
  }

  async function appointBootstrap(input: { requestId: string; reason: string; operationId: string }) {
    await reauthenticate()
    return bootstrapCoordinator(input)
  }
  return <main className="super-admin-console">
    <header className="super-admin-header"><div><p className="eyebrow">{COPY.superAdmin.label}</p><h1>{COPY.superAdmin.title}</h1><p>{COPY.superAdmin.intro}</p></div><button className="secondary-button" onClick={() => void signOut()}>{COPY.superAdmin.signOut}</button></header>
    {bootstrapNotice && <p role="status">{bootstrapNotice}</p>}
    <CoordinatorBootstrap
      load={listBootstrapCandidates}
      appoint={appointBootstrap}
      onSuccess={() => { setBootstrapNotice(COPY.superAdmin.bootstrapSuccess); setRefreshKey((value) => value + 1) }}
      onUnavailable={setBootstrapNotice}
    />
    <CoordinatorDirectory load={(search, pageToken) => listGovernanceMembers({ search, pageToken })} onChange={changeCoordinator} refreshKey={refreshKey} />
    <AuditLog load={listGovernanceAuditEvents} refreshKey={refreshKey} />
  </main>
}
