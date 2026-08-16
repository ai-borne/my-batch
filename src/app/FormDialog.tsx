import { FormEvent, KeyboardEvent, ReactNode, useEffect, useRef, useState } from 'react'
import { COPY } from '../lib/copy'

type FormDialogProps = {
  title: string
  description: string
  submitLabel: string
  returnFocus: HTMLElement | null
  onClose: () => void
  onSubmit: (values: FormData) => Promise<void>
  submitDisabled?: boolean
  children?: ReactNode
}

export function FormDialog({ title, description, submitLabel, returnFocus, onClose, onSubmit, submitDisabled = false, children }: FormDialogProps) {
  const container = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => {
    const fallback = returnFocus ?? document.activeElement as HTMLElement | null
    container.current?.querySelector<HTMLElement>('[data-dialog-focus], input, textarea, button')?.focus()
    return () => fallback?.focus()
  }, [returnFocus])
  function moveFocus(edge: 'first' | 'last') {
    const focusable = [...(container.current?.querySelectorAll<HTMLElement>('[data-dialog-focus], input, textarea, select, button:not(:disabled), a[href]') ?? [])]
    focusable.filter((element) => !element.dataset.focusGuard).at(edge === 'first' ? 0 : -1)?.focus()
  }
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) { if (event.key === 'Escape' && !submitting) onClose() }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true); setError('')
    try { await onSubmit(new FormData(event.currentTarget)) } catch (cause) { setError(cause instanceof Error ? cause.message : COPY.dialogActionFailed) } finally { setSubmitting(false) }
  }
  return <div className="dialog-backdrop"><div className="form-dialog" ref={container} role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-description" onKeyDown={handleKeyDown}><span className="focus-guard" data-focus-guard="true" tabIndex={0} aria-hidden="true" onFocus={() => moveFocus('last')} /><form onSubmit={submit}><h2 id="dialog-title">{title}</h2><p id="dialog-description">{description}</p>{children}{error && <p role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={submitting}>{COPY.cancel}</button><button type="submit" disabled={submitting || submitDisabled}>{submitting ? COPY.working : submitLabel}</button></div></form><span className="focus-guard" data-focus-guard="true" tabIndex={0} aria-hidden="true" onFocus={() => moveFocus('first')} /></div></div>
}
