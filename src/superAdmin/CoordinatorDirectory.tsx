import { FormEvent, MouseEvent, useEffect, useState } from 'react'
import { FormDialog } from '../app/FormDialog'
import { COPY } from '../lib/copy'
import { GovernanceMember, MemberPage } from './governance'

type PendingChange = { member: GovernanceMember; action: 'assign' | 'revoke'; trigger: HTMLElement }
type Props = { load: (search: string, pageToken?: string) => Promise<MemberPage>; onChange: (memberUid: string, action: 'assign' | 'revoke', reason: string) => Promise<void>; refreshKey?: number }

export function CoordinatorDirectory({ load, onChange, refreshKey = 0 }: Props) {
  const [search, setSearch] = useState('')
  const [members, setMembers] = useState<GovernanceMember[]>([])
  const [pageToken, setPageToken] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [dialog, setDialog] = useState<PendingChange | null>(null)
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState('')
  async function fetchMembers(nextSearch = search, token?: string, append = false) {
    setState('loading')
    try {
      const page = await load(nextSearch, token)
      setMembers((current) => append ? [...current, ...page.members] : page.members)
      setPageToken(page.nextPageToken); setState('ready')
    } catch (error) { setState('error'); setNotice(error instanceof Error && error.message.includes('permission-denied') ? COPY.superAdmin.accessDenied : COPY.superAdmin.membersFailed) }
  }
  useEffect(() => { void fetchMembers('') }, [refreshKey])
  function submitSearch(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void fetchMembers(search) }
  async function submitChange(values: FormData) {
    if (!dialog) return
    const reason = String(values.get('reason') ?? '').trim()
    if (!reason) throw new Error(COPY.superAdmin.reasonRequired)
    await onChange(dialog.member.uid, dialog.action, reason)
    setDialog(null); setReason(''); setNotice(dialog.action === 'assign' ? COPY.superAdmin.appointed : COPY.superAdmin.revoked)
    await fetchMembers(search)
  }
  return <section className="panel super-admin-section" aria-labelledby="coordinator-directory-title">
    <div className="section-heading"><div><p className="eyebrow">{COPY.superAdmin.directoryLabel}</p><h2 id="coordinator-directory-title">{COPY.superAdmin.directoryTitle}</h2></div></div>
    <form className="super-admin-search" onSubmit={submitSearch}><label>{COPY.superAdmin.searchLabel}<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={COPY.superAdmin.searchPlaceholder} /></label><button type="submit">{COPY.superAdmin.search}</button></form>
    {notice && <p role="status">{notice}</p>}
    {state === 'loading' && <p role="status">{COPY.superAdmin.loadingMembers}</p>}
    {state === 'error' && <button onClick={() => void fetchMembers(search)}>{COPY.superAdmin.retryMembers}</button>}
    {state === 'ready' && !members.length && <p>{COPY.superAdmin.membersEmpty}</p>}
    {state === 'ready' && members.map((member) => <article className="member-row" key={member.uid}><span><strong>{member.displayName ?? member.memberCode ?? member.uid}</strong><small>{[member.email, member.memberCode].filter(Boolean).join(' · ') || member.uid}</small></span><span className="member-actions"><small>{member.role === 'coordinator' ? COPY.superAdmin.coordinator : COPY.superAdmin.member}</small><button aria-label={member.role === 'coordinator' ? COPY.superAdmin.revokeAria(member.displayName ?? member.uid) : COPY.superAdmin.appointAria(member.displayName ?? member.uid)} onClick={(event: MouseEvent<HTMLButtonElement>) => setDialog({ member, action: member.role === 'coordinator' ? 'revoke' : 'assign', trigger: event.currentTarget })}>{member.role === 'coordinator' ? COPY.superAdmin.revoke : COPY.superAdmin.appoint}</button></span></article>)}
    {state === 'ready' && pageToken && <button className="secondary-button" onClick={() => void fetchMembers(search, pageToken, true)}>{COPY.superAdmin.loadMoreMembers}</button>}
    {dialog && <FormDialog title={dialog.action === 'assign' ? COPY.superAdmin.appointTitle : COPY.superAdmin.revokeTitle} description={dialog.action === 'assign' ? COPY.superAdmin.appointDescription : COPY.superAdmin.revokeDescription} submitLabel={dialog.action === 'assign' ? COPY.superAdmin.appointTitle : COPY.superAdmin.revokeTitle} returnFocus={dialog.trigger} onClose={() => { setDialog(null); setReason('') }} onSubmit={submitChange} submitDisabled={!reason.trim()}><label>{COPY.superAdmin.reasonLabel}<textarea name="reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required data-dialog-focus /></label></FormDialog>}
  </section>
}
