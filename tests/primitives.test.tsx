import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { Avatar, Badge, EmptyState, ErrorState, IconButton, Skeleton, Toast } from '../src/ui/Primitives'

describe('UX-1 primitives', () => {
  test('exposes names and text alternatives for common state and icon controls', () => {
    render(<><IconButton label="Close notice">×</IconButton><Avatar name="Ajinkya Rao" /><Badge tone="success">Verified</Badge><Skeleton label="Loading memories" /><EmptyState title="No memories" /><ErrorState title="Could not load memories" /><Toast>Saved</Toast></>)

    expect(screen.getByRole('button', { name: 'Close notice' })).toBeVisible()
    expect(screen.getByLabelText('Ajinkya Rao')).toHaveTextContent('AR')
    expect(screen.getByLabelText('Loading memories')).toHaveAttribute('role', 'status')
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load memories')
    expect(screen.getByText('Saved')).toHaveAttribute('role', 'status')
  })
})
