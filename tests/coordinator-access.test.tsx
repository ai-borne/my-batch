import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { CoordinatorAccessGate } from '../src/batch/CoordinatorAccessGate'
import { isPermissionDenied } from '../src/lib/authorization'

let membership: { status: 'active'; role: 'coordinator' | 'batchmate' }
const refreshMembership = vi.fn()

vi.mock('../src/auth/AuthProvider', () => ({ useAuth: () => ({ membership, refreshMembership, reauthenticate: vi.fn() }) }))
function Workspace({ onPermissionDenied }: { onPermissionDenied: () => Promise<void> }) {
  return <><p>Coordinator workspace</p><button onClick={() => void onPermissionDenied()}>Simulate backend denial</button></>
}

function Home() {
  const location = useLocation()
  return <p>{location.state?.coordinatorAccessChanged ? 'Coordinator access changed' : 'Home'}</p>
}

function renderRoute() {
  return render(<MemoryRouter initialEntries={['/account/coordinator']}><Routes><Route path="/account/coordinator" element={<CoordinatorAccessGate>{(onPermissionDenied) => <Workspace onPermissionDenied={onPermissionDenied} />}</CoordinatorAccessGate>} /><Route path="/home" element={<Home />} /></Routes></MemoryRouter>)
}

describe('Coordinator access resilience', () => {
  afterEach(cleanup)
  beforeEach(() => {
    membership = { status: 'active', role: 'coordinator' }
    refreshMembership.mockReset().mockImplementation(async () => undefined)
  })

  test('refreshes membership before rendering Coordinator tools and redirects a revoked Coordinator', async () => {
    refreshMembership.mockImplementation(async () => { membership = { status: 'active', role: 'batchmate' } })
    renderRoute()
    expect(screen.getByRole('status')).toHaveTextContent('Checking Coordinator access…')
    expect(await screen.findByText('Coordinator access changed')).toBeInTheDocument()
    expect(screen.queryByText('Coordinator workspace')).not.toBeInTheDocument()
  })

  test('fails closed when the membership refresh cannot be completed', async () => {
    refreshMembership.mockRejectedValue(new Error('permission-denied'))
    renderRoute()
    expect(await screen.findByText('Coordinator access changed')).toBeInTheDocument()
    expect(screen.queryByText('Coordinator workspace')).not.toBeInTheDocument()
  })

  test('keeps Coordinator tools available after a successful route refresh, then removes them after a backend denial', async () => {
    renderRoute()
    expect(await screen.findByText('Coordinator workspace')).toBeInTheDocument()
    membership = { status: 'active', role: 'batchmate' }
    await screen.getByRole('button', { name: 'Simulate backend denial' }).click()
    await waitFor(() => expect(refreshMembership).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Coordinator access changed')).toBeInTheDocument()
  })

  test('recognizes Firestore and callable permission-denied responses', () => {
    expect(isPermissionDenied({ code: 'permission-denied' })).toBe(true)
    expect(isPermissionDenied({ code: 'functions/permission-denied' })).toBe(true)
    expect(isPermissionDenied({ code: 'unavailable' })).toBe(false)
  })
})
