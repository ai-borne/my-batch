import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SuperAdminConsole } from '../src/superAdmin/SuperAdminConsole'

const reauthenticate = vi.fn()
const signOut = vi.fn()
const listMembers = vi.fn()
const listAuditEvents = vi.fn()
const changeCoordinator = vi.fn()

vi.mock('../src/auth/AuthProvider', () => ({ useAuth: () => ({ reauthenticate, signOut }) }))
vi.mock('../src/superAdmin/governance', () => ({
  listGovernanceMembers: (...args: unknown[]) => listMembers(...args),
  listGovernanceAuditEvents: (...args: unknown[]) => listAuditEvents(...args),
  assignCoordinator: (...args: unknown[]) => changeCoordinator(...args),
  auditTime: () => '15 Nov 2023, 3:43 pm',
}))

describe('SuperAdminConsole', () => {
  beforeEach(() => { vi.resetAllMocks() })
  afterEach(cleanup)
  test('searches and paginates coordinators, then requires confirmation, a reason, and reauthentication to appoint one', async () => {
    const user = userEvent.setup()
    listMembers
      .mockResolvedValue({ members: [], nextPageToken: null })
      .mockResolvedValueOnce({ members: [{ uid: 'member-1', displayName: 'Asha Rao', email: 'asha@example.com', memberCode: 'M-001', role: 'batchmate' }], nextPageToken: 'next-members' })
      .mockResolvedValueOnce({ members: [{ uid: 'member-1', displayName: 'Asha Rao', email: 'asha@example.com', memberCode: 'M-001', role: 'batchmate' }], nextPageToken: 'next-members' })
      .mockResolvedValueOnce({ members: [{ uid: 'member-2', displayName: 'Bharat Shah', role: 'coordinator' }], nextPageToken: null })
    listAuditEvents.mockResolvedValue({ events: [], nextPageToken: null })
    changeCoordinator.mockResolvedValue({ updated: true })

    render(<SuperAdminConsole />)
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Search active members'), 'asha')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(listMembers).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'asha' })))
    await user.click(screen.getByRole('button', { name: 'Load more members' }))
    expect(await screen.findByText('Bharat Shah')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Appoint Coordinator for Asha Rao' }))
    expect(screen.getByRole('alertdialog')).toHaveAccessibleName('Appoint Coordinator')
    const submit = screen.getByRole('button', { name: 'Appoint Coordinator' })
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText('Business reason'), 'Regional support coverage')
    expect(submit).toBeEnabled()
    await user.click(submit)
    await waitFor(() => expect(reauthenticate).toHaveBeenCalledOnce())
    expect(changeCoordinator).toHaveBeenCalledWith(expect.objectContaining({ memberUid: 'member-1', action: 'assign', reason: 'Regional support coverage' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Coordinator appointed.')
  })

  test('shows retry, empty, access-denied, audit filtering, and audit pagination states', async () => {
    const user = userEvent.setup()
    listMembers.mockRejectedValueOnce(new Error('permission-denied')).mockResolvedValueOnce({ members: [], nextPageToken: null })
    listAuditEvents
      .mockResolvedValueOnce({ events: [], nextPageToken: null })
      .mockResolvedValueOnce({ events: [{ id: 'audit-1', action: 'coordinator.assigned', actorUid: 'actor-1', targetUid: 'target-1', reason: 'Coverage', createdAt: 1_700_000_000_000 }], nextPageToken: 'next-audit' })
      .mockResolvedValueOnce({ events: [{ id: 'audit-2', action: 'coordinator.revoked', actorUid: 'actor-2', targetUid: 'target-2', reason: 'Rotation', createdAt: 1_700_100_000_000 }], nextPageToken: null })

    render(<SuperAdminConsole />)
    expect(await screen.findByText('Access denied. Your Super Admin session may have expired.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry member directory' }))
    expect(await screen.findByText('No active members match this search.')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Audit action'), 'coordinator.assigned')
    await user.type(screen.getByLabelText('Actor UID'), 'actor-1')
    await user.type(screen.getByLabelText('Target UID'), 'target-1')
    await user.type(screen.getByLabelText('From date'), '2023-11-01')
    await user.type(screen.getByLabelText('To date'), '2023-11-30')
    await user.click(screen.getByRole('button', { name: 'Apply audit filters' }))
    await waitFor(() => expect(listAuditEvents).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'coordinator.assigned', actorUid: 'actor-1', targetUid: 'target-1', from: '2023-11-01', to: '2023-11-30' }), undefined))
    expect(await screen.findByText('coordinator.assigned', { selector: 'strong' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Load more audit events' }))
    expect(await screen.findByText('coordinator.revoked', { selector: 'strong' })).toBeInTheDocument()
  })

  test('requires confirmation, a reason, and reauthentication before revoking a Coordinator', async () => {
    const user = userEvent.setup()
    listMembers.mockResolvedValue({ members: [{ uid: 'member-3', displayName: 'Chitra Iyer', role: 'coordinator' }], nextPageToken: null })
    listAuditEvents.mockResolvedValue({ events: [], nextPageToken: null })
    changeCoordinator.mockResolvedValue({ updated: true })

    render(<SuperAdminConsole />)
    await user.click(await screen.findByRole('button', { name: 'Revoke Coordinator from Chitra Iyer' }))
    await user.type(screen.getByLabelText('Business reason'), 'Coordinator rotation')
    await user.click(screen.getByRole('button', { name: 'Revoke Coordinator' }))
    await waitFor(() => expect(reauthenticate).toHaveBeenCalledOnce())
    expect(changeCoordinator).toHaveBeenCalledWith(expect.objectContaining({ memberUid: 'member-3', action: 'revoke', reason: 'Coordinator rotation' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Coordinator revoked.')
  })
})
