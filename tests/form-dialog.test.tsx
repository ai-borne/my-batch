import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { FormDialog } from '../src/app/FormDialog'

describe('FormDialog', () => {
  test('collects a required reason and restores focus when the user cancels a destructive action', async () => {
    const user = userEvent.setup()
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const onClose = vi.fn()
    const onSubmit = vi.fn()

    const view = render(<FormDialog title="Reject request" description="The member can correct and resubmit." submitLabel="Reject" returnFocus={trigger} onClose={onClose} onSubmit={onSubmit}><label>Reason<textarea name="reason" required data-dialog-focus /></label></FormDialog>)

    expect(screen.getByRole('alertdialog')).toHaveAccessibleName('Reject request')
    expect(screen.getByLabelText('Reason')).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
    view.unmount()
    expect(trigger).toHaveFocus()
  })

  test('keeps keyboard focus inside the dialog and lets Escape close it', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<FormDialog title="Confirm change" description="Confirm the requested change." submitLabel="Confirm" returnFocus={null} onClose={onClose} onSubmit={vi.fn()}><label>Reason<input data-dialog-focus /></label></FormDialog>)

    const reason = screen.getByLabelText('Reason')
    await user.tab()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus()
    await user.tab()
    expect(reason).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })
})
