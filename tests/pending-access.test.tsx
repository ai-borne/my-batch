import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { Pending } from '../src/App'

const refreshMembership = vi.fn()
let membership: { status: 'none' | 'pending' | 'active'; role?: 'coordinator' }

vi.mock('../src/auth/AuthProvider', () => ({ useAuth: () => ({ membership, loading: false, refreshMembership }) }))

describe('pending-access route', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  test('sends an approved Coordinator away from the stale pending route', () => {
    membership = { status: 'active', role: 'coordinator' }
    render(<MemoryRouter initialEntries={['/pending']}><Routes><Route path="/pending" element={<Pending />} /><Route path="/home" element={<p>Private home</p>} /></Routes></MemoryRouter>)
    expect(screen.getByText('Private home')).toBeInTheDocument()
  })

  test('keeps a newly submitted request on the pending route', () => {
    membership = { status: 'none' }
    render(<MemoryRouter initialEntries={['/pending']}><Routes><Route path="/pending" element={<Pending />} /><Route path="/request-access" element={<p>Request access</p>} /></Routes></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Approval pending' })).toBeInTheDocument()
  })
})
