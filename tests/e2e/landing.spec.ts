import { expect, test } from '@playwright/test'
async function signIn(page: import('@playwright/test').Page, email: string) { await page.goto('/'); await page.getByLabel('Test email').fill(email); await page.getByLabel('Test password').fill('password-123'); await page.getByRole('button', { name: 'Test sign in' }).click(); await expect(page.getByRole('status')).toHaveText('Test session ready') }
test('public landing exposes Google sign-in but no private batch data', async ({ page }) => { await page.goto('/'); await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible(); await expect(page.getByText('Private batch home.')).toHaveCount(0) })

test('mobile landing exposes the installable app metadata without private content', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  await expect(page.getByText('Private batch home.')).toHaveCount(0)
})

test('a Coordinator can reauthenticate and approve a pending request', async ({ page }) => {
  await signIn(page, 'coordinator@example.test'); await page.goto('/admin'); await expect(page.getByText('Pending Member')).toBeVisible(); await page.getByRole('button', { name: 'Approve' }).click(); await expect(page.getByRole('status')).toHaveText('Member approved.')
})

test('a rejected requester can correct and resubmit access details', async ({ page }) => {
  await signIn(page, 'rejected@example.test'); await page.goto('/request-access'); await expect(page.getByRole('alert')).toContainText('Use your full name.'); await page.getByLabel('Name').fill('Corrected Full Name'); await page.getByRole('button', { name: 'Correct and resubmit' }).click(); await expect(page).toHaveURL(/\/pending$/)
})

test('a suspended member is redirected away from private routes', async ({ page }) => {
  await signIn(page, 'suspended@example.test'); await page.goto('/home'); await expect(page).toHaveURL(/\/access-denied$/)
})
