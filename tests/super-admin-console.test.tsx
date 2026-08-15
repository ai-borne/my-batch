import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SuperAdminConsole } from '../src/superAdmin/SuperAdminConsole'

const reauthenticate = vi.fn()
const signOut = vi.fn()
const listMembers = vi.fn()
const listAuditEvents = vi.fn()
const changeCoordinator = vi.fn()
const listBootstrapCandidates = vi.fn()
const bootstrapCoordinator = vi.fn()

vi.mock('../src/auth/AuthProvider', () => ({ useAuth: () => ({ reauthenticate, signOut }) }))
vi.mock('../src/superAdmin/governance', () => ({
  listGovernanceMembers: (...args: unknown[]) => listMembers(...args),
  listGovernanceAuditEvents: (...args: unknown[]) => listAuditEvents(...args),
  assignCoordinator: (...args: unknown[]) => changeCoordinator(...args),
  listBootstrapCandidates: (...args: unknown[]) => listBootstrapCandidates(...args),
  bootstrapCoordinator: (...args: unknown[]) => bootstrapCoordinator(...args),
  auditTime: () => '15 Nov 2023, 3:43 pm',
}))

describe('SuperAdminConsole', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    listBootstrapCandidates.mockResolvedValue({ candidates: [], nextPageToken: null })
  })
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

  test('shows bounded bootstrap candidates, requires a reason, and refreshes every governance view after appointing the first Coordinator', async () => {
    const user = userEvent.setup()
    listMembers.mockResolvedValue({ members: [{ uid: 'new-coordinator', displayName: 'Asha Rao', role: 'coordinator' }], nextPageToken: null })
    listAuditEvents.mockResolvedValue({ events: [{ id: 'bootstrap-audit', action: 'membership.bootstrapCoordinatorApproved', actorUid: 'admin', targetUid: 'new-coordinator', reason: 'Restore review coverage' }], nextPageToken: null })
    listBootstrapCandidates
      .mockResolvedValueOnce({ candidates: [{ requestId: 'request-1', displayName: 'Asha Rao', rollNumber: 'R-001', houseId: 'ashoka' }], nextPageToken: 'next-candidates' })
      .mockResolvedValueOnce({ candidates: [{ requestId: 'request-2', displayName: 'Bharat Shah', rollNumber: 'R-002', houseId: null }], nextPageToken: null })
      .mockRejectedValueOnce(Object.assign(new Error('Coordinator bootstrap is only available'), { code: 'failed-precondition' }))
    bootstrapCoordinator.mockResolvedValue({ approved: true, membershipUid: 'new-coordinator' })

    render(<SuperAdminConsole />)
    expect(await screen.findByRole('heading', { name: 'Coordinator bootstrap' })).toBeInTheDocument()
    expect(screen.queryByText('asha@example.com')).not.toBeInTheDocument()
    expect(screen.getByText('R-001 · Ashoka')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Load more applicants' }))
    expect(await screen.findByText('Bharat Shah')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Approve and appoint Coordinator for Asha Rao' }))
    expect(screen.getByRole('alertdialog')).toHaveAccessibleName('Approve and appoint Coordinator')
    const submit = screen.getByRole('button', { name: 'Approve and appoint Coordinator' })
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText('Business reason'), 'Restore review coverage')
    await user.click(submit)
    await waitFor(() => expect(reauthenticate).toHaveBeenCalledOnce())
    expect(bootstrapCoordinator).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'request-1', reason: 'Restore review coverage', operationId: expect.any(String) }))
    expect(await screen.findByRole('status')).toHaveTextContent('Coordinator appointed. The bootstrap panel is no longer available.')
    await waitFor(() => expect(listMembers).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(listAuditEvents).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('heading', { name: 'Coordinator bootstrap' })).not.toBeInTheDocument()
  })

  test('shows an empty bootstrap state when zero-Coordinator recovery has no pending applicants', async () => {
    listMembers.mockResolvedValue({ members: [], nextPageToken: null })
    listAuditEvents.mockResolvedValue({ events: [], nextPageToken: null })
    listBootstrapCandidates.mockResolvedValue({ candidates: [], nextPageToken: null })

    render(<SuperAdminConsole />)
    expect(await screen.findByText('No pending applicants are available for Coordinator bootstrap.')).toBeInTheDocument()
  })

  test('shows retry, duplicate-roll, and single-flight bootstrap states', async () => {
    const user = userEvent.setup()
    listMembers.mockResolvedValue({ members: [], nextPageToken: null })
    listAuditEvents.mockResolvedValue({ events: [], nextPageToken: null })
    listBootstrapCandidates
      .mockRejectedValueOnce(Object.assign(new Error('permission-denied'), { code: 'permission-denied' }))
      .mockResolvedValueOnce({ candidates: [{ requestId: 'request-3', displayName: 'Chitra Iyer', rollNumber: 'R-003', houseId: 'pratap' }], nextPageToken: null })
      .mockResolvedValueOnce({ candidates: [{ requestId: 'request-3', displayName: 'Chitra Iyer', rollNumber: 'R-003', houseId: 'pratap' }], nextPageToken: null })
    let rejectBootstrap: ((error: Error) => void) | undefined
    bootstrapCoordinator.mockImplementationOnce(() => new Promise((_, reject) => { rejectBootstrap = reject }))
      .mockRejectedValueOnce(Object.assign(new Error('That school roll number is already assigned'), { code: 'already-exists' }))

    render(<SuperAdminConsole />)
    expect(await screen.findByText('Access denied. Your Super Admin session may have expired.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry bootstrap candidates' }))
    await user.click(await screen.findByRole('button', { name: 'Approve and appoint Coordinator for Chitra Iyer' }))
    await user.type(screen.getByLabelText('Business reason'), 'Coverage')
    const submit = screen.getByRole('button', { name: 'Approve and appoint Coordinator' })
    await user.click(submit)
    await user.click(submit)
    expect(bootstrapCoordinator).toHaveBeenCalledTimes(1)
    rejectBootstrap?.(Object.assign(new Error('duplicate'), { code: 'already-exists' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That school roll number is already assigned to another active member. Choose another applicant or resolve the duplicate roll number.')
  })

  test('hides the bootstrap panel and explains stale state when another actor appoints the first Coordinator', async () => {
    const user = userEvent.setup()
    listMembers.mockResolvedValue({ members: [], nextPageToken: null })
    listAuditEvents.mockResolvedValue({ events: [], nextPageToken: null })
    listBootstrapCandidates
      .mockResolvedValueOnce({ candidates: [{ requestId: 'request-4', displayName: 'Dev Malik', rollNumber: 'R-004', houseId: null }], nextPageToken: null })
      .mockRejectedValueOnce(Object.assign(new Error('Coordinator bootstrap is only available'), { code: 'functions/failed-precondition' }))
    bootstrapCoordinator.mockRejectedValueOnce(Object.assign(new Error('Coordinator bootstrap is only available'), { code: 'functions/failed-precondition' }))

    render(<SuperAdminConsole />)
    await user.click(await screen.findByRole('button', { name: 'Approve and appoint Coordinator for Dev Malik' }))
    await user.type(screen.getByLabelText('Business reason'), 'Coverage')
    await user.click(screen.getByRole('button', { name: 'Approve and appoint Coordinator' }))
    expect(await screen.findByText('Coordinator bootstrap is no longer available because the selected applicant is no longer eligible.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Coordinator bootstrap' })).not.toBeInTheDocument()
  })
})
