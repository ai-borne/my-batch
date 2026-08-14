import { expect, test } from '@playwright/test'
test('public landing exposes Google sign-in but no private batch data', async ({ page }) => { await page.goto('/'); await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible(); await expect(page.getByText('Private batch home.')).toHaveCount(0) })

test('mobile landing exposes the installable app metadata without private content', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  await expect(page.getByText('Private batch home.')).toHaveCount(0)
})
