import { expect, test } from '@playwright/test'
test('public landing exposes Google sign-in but no private batch data', async ({ page }) => { await page.goto('/'); await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible(); await expect(page.getByText('Private batch home.')).toHaveCount(0) })
