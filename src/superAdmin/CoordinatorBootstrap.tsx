import { MouseEvent, useEffect, useState } from 'react'
import { FormDialog } from '../app/FormDialog'
import { COPY } from '../lib/copy'
import { BootstrapCandidate, BootstrapCandidatePage } from './governance'

type Dialog = { candidate: BootstrapCandidate; operationId: string; trigger: HTMLElement }
type Props = {
  load: (pageToken?: string) => Promise<BootstrapCandidatePage>
  appoint: (input: { requestId: string; reason: string; operationId: string }) => Promise<unknown>
  onSuccess: () => void
  onUnavailable: (message: string) => void
}

function errorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
}

export function CoordinatorBootstrap({ load, appoint, onSuccess, onUnavailable }: Props) {
  const [candidates, setCandidates] = useState<BootstrapCandidate[]>([])
  const [pageToken, setPageToken] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'unavailable'>('loading')
  const [notice, setNotice] = useState('')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [reason, setReason] = useState('')
  async function fetchCandidates(token?: string, append = false) {
    setState('loading')
    try {
      const page = await load(token)
      setCandidates((current) => append ? [...current, ...page.candidates] : page.candidates)
      setPageToken(page.nextPageToken); setState('ready')
    } catch (error) {
      if (errorCode(error) === 'failed-precondition') { setState('unavailable'); return }
      setNotice(errorCode(error) === 'permission-denied' ? COPY.superAdmin.accessDenied : COPY.superAdmin.bootstrapFailed)
      setState('error')
    }
  }
  useEffect(() => { void fetchCandidates() }, [])
  async function submit(values: FormData) {
    if (!dialog) return
    const submittedReason = String(values.get('reason') ?? '').trim()
    if (!submittedReason) throw new Error(COPY.superAdmin.reasonRequired)
    try {
      await appoint({ requestId: dialog.candidate.requestId, reason: submittedReason, operationId: dialog.operationId })
      setDialog(null); setReason(''); setNotice(COPY.superAdmin.bootstrapSuccess); onSuccess()
      await fetchCandidates()
    } catch (error) {
      const code = errorCode(error)
      if (code === 'failed-precondition') {
        setDialog(null); setReason(''); onUnavailable(COPY.superAdmin.bootstrapStale); await fetchCandidates()
        return
      }
      if (code === 'already-exists') throw new Error(COPY.superAdmin.bootstrapDuplicateRoll)
      if (code === 'permission-denied') throw new Error(COPY.superAdmin.accessDenied)
      throw new Error(COPY.superAdmin.bootstrapRetry)
    }
  }
  if (state === 'unavailable') return null
  return <section className="panel super-admin-section" aria-labelledby="coordinator-bootstrap-title">
    <div className="section-heading"><div><p className="eyebrow">{COPY.superAdmin.bootstrapLabel}</p><h2 id="coordinator-bootstrap-title">{COPY.superAdmin.bootstrapTitle}</h2><p>{COPY.superAdmin.bootstrapIntro}</p></div></div>
    {notice && <p role="status">{notice}</p>}
    {state === 'loading' && <p role="status">{COPY.superAdmin.loadingBootstrap}</p>}
    {state === 'error' && <button onClick={() => void fetchCandidates()}>{COPY.superAdmin.retryBootstrap}</button>}
    {state === 'ready' && !candidates.length && <p>{COPY.superAdmin.bootstrapEmpty}</p>}
    {state === 'ready' && candidates.map((candidate) => <article className="member-row" key={candidate.requestId}><span><strong>{candidate.displayName}</strong><small>{candidate.rollNumber}{candidate.houseId ? ` · ${candidate.houseId.slice(0, 1).toUpperCase()}${candidate.houseId.slice(1)}` : ''}</small></span><button aria-label={COPY.superAdmin.appointBootstrapAria(candidate.displayName)} onClick={(event: MouseEvent<HTMLButtonElement>) => setDialog({ candidate, operationId: crypto.randomUUID(), trigger: event.currentTarget })}>{COPY.superAdmin.appointBootstrap}</button></article>)}
    {state === 'ready' && pageToken && <button className="secondary-button" onClick={() => void fetchCandidates(pageToken, true)}>{COPY.superAdmin.loadMoreCandidates}</button>}
    {dialog && <FormDialog title={COPY.superAdmin.appointBootstrap} description={COPY.superAdmin.appointBootstrapDescription} submitLabel={COPY.superAdmin.appointBootstrap} returnFocus={dialog.trigger} onClose={() => { setDialog(null); setReason('') }} onSubmit={submit} submitDisabled={!reason.trim()}><label>{COPY.superAdmin.reasonLabel}<textarea name="reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required data-dialog-focus /></label></FormDialog>}
  </section>
}
