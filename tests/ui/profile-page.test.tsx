import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ProfilePage } from '../../src/batch/ProfilePage'
import { COPY } from '../../src/lib/copy'

const user = { uid: 'self' }
let membership: { role?: 'coordinator' } = {}
const setDoc = vi.fn(vi.fn(async () => undefined))
const getDoc = vi.fn(vi.fn(async () => ({ data: () => ({ displayName: 'Sameer', city: 'Pune' }) })))
const getDocs = vi.fn(vi.fn(async () => ({ size: 0 })))

vi.mock('../../src/auth/AuthProvider', () => ({ useAuth: () => ({ user, membership }) }))
vi.mock('firebase/firestore/lite', () => {
  const identity = (value: unknown) => value
  return {
    collection: identity, doc: identity, query: identity, where: identity, orderBy: identity, limit: identity,
    getDoc: (...args: unknown[]) => getDoc(...args), getDocs: (...args: unknown[]) => getDocs(...args),
    setDoc: (...args: unknown[]) => setDoc(...args), serverTimestamp: () => 'app-timestamp',
  }
})
vi.mock('firebase/functions', () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }))
vi.mock('firebase/storage', () => ({ ref: (a: unknown, b: string) => ({ a, b }), uploadBytes: async () => undefined }))
vi.mock('../../src/lib/firebase', () => ({ firebaseServices: () => ({ db: 'db', auth: { currentUser: user }, storage: 'storage', functions: 'functions' }) }))

function renderAccount() {
  return render(<MemoryRouter initialEntries={['/account']}><Routes><Route path="/account" element={<ProfilePage />} /><Route path="/memories" element={<p>Memories</p>} /></Routes></MemoryRouter>)
}

beforeEach(() => { membership = {}; setDoc.mockClear().mockResolvedValue(undefined); getDoc.mockClear().mockResolvedValue({ data: () => ({ displayName: 'Sameer', city: 'Pune' }) }); getDocs.mockClear().mockResolvedValue({ size: 0 }) })
afterEach(() => cleanup())

describe('UX-5 Account sections and sticky save', () => {
  test('shows a sticky save control only after an edit, and saves the grouped profile', async () => {
    renderAccount()
    expect(screen.queryByRole('button', { name: COPY.account.save })).not.toBeInTheDocument()
    await screen.findByDisplayValue('Pune')
    await userEvent.type(screen.getByLabelText('City'), '!!')
    expect(await screen.findByRole('button', { name: COPY.account.save })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: COPY.account.save }))
    expect(setDoc).toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent(COPY.account.saved)
  })

  test('groups fields into labelled sections and offers a member-safe preview', async () => {
    renderAccount()
    expect(screen.getByRole('group', { name: COPY.account.identity })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: COPY.account.schoolMemories })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: COPY.account.privacySupport })).toBeInTheDocument()
    await screen.findByDisplayValue('Pune')
    await userEvent.type(screen.getByLabelText('City'), '!!')
    await userEvent.click(await screen.findByRole('link', { name: COPY.account.preview }))
    expect(within(document.body).getByText('Sameer')).toBeInTheDocument()
  })

  test('surfaces a danger zone alongside the privacy support request actions', () => {
    renderAccount()
    expect(screen.getByRole('heading', { name: COPY.account.danger })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: COPY.account.requestCorrection })).toBeInTheDocument()
  })
})