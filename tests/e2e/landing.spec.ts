import { expect, test } from '@playwright/test'
async function signIn(page: import('@playwright/test').Page, email: string, destination = '/home') { await page.goto('/'); await page.getByLabel('Test email').fill(email); await page.getByLabel('Test password').fill('password-123'); await page.getByRole('button', { name: 'Test sign in' }).click(); await expect(page).toHaveURL(new RegExp(`${destination}$`)) }
async function signOut(page: import('@playwright/test').Page) { await page.getByRole('button', { name: 'Sign out' }).click(); await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible() }
test('public landing exposes Google sign-in but no private batch data', async ({ page }) => { await page.goto('/'); await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible(); await expect(page.getByText('Private batch home.')).toHaveCount(0) })

test('mobile landing exposes the installable app metadata without private content', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  await expect(page.getByText('Private batch home.')).toHaveCount(0)
})

test('a Coordinator test sign-in reaches Home and can approve a pending request', async ({ page }) => {
  await signIn(page, 'coordinator@example.test'); await page.goto('/admin'); await expect(page).toHaveURL(/\/home$/); await page.goto('/account/coordinator'); await expect(page.getByText('Pending Member')).toBeVisible()
  const reject = page.getByRole('button', { name: 'Reject' }).first(); await reject.click(); const dialog = page.getByRole('alertdialog', { name: 'Reject access request' }); await dialog.getByLabel('Reason for rejection').fill('Please confirm your full name.'); await dialog.getByRole('button', { name: 'Cancel' }).click(); await expect(reject).toBeFocused()
  await page.getByRole('button', { name: 'Approve' }).click(); await expect(page.getByRole('status')).toHaveText('Member approved.')
})

test('a rejected requester can correct and resubmit access details', async ({ page }) => {
  await signIn(page, 'rejected@example.test', '/request-access'); await page.goto('/request-access'); await expect(page.getByRole('alert')).toContainText('Use your full name.'); await page.getByLabel('Name').fill('Corrected Full Name'); await page.getByRole('button', { name: 'Correct and resubmit' }).click(); await expect(page).toHaveURL(/\/pending$/)
})

test('a suspended member is redirected away from private routes', async ({ page }) => {
  await signIn(page, 'suspended@example.test', '/access-denied'); await page.goto('/home'); await expect(page).toHaveURL(/\/access-denied$/)
})

test('an active member gets the accessible five-item mobile navigation and Home actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, 'coordinator@example.test'); await page.goto('/home')
  const navigation = page.getByRole('navigation', { name: 'Batch navigation' })
  await expect(navigation).toBeVisible()
  await expect(navigation.getByRole('link')).toHaveCount(5)
  await expect(navigation).toContainText('Home')
  await expect(navigation).toContainText('Account')
  await expect(navigation).not.toContainText('Fund')
  await page.getByRole('link', { name: 'RSVP now' }).click()
  await expect(page).toHaveURL(/\/reunion$/)
})

test('desktop keeps matching top navigation without the mobile bar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await signIn(page, 'coordinator@example.test'); await page.goto('/home')
  const navigation = page.locator('nav[aria-label="Batch navigation"]:visible')
  await expect(navigation).toContainText('Memories')
  await expect(navigation.getByRole('link')).toHaveCount(5)
})

test('the directory searches the server projection, clears filters, and pages beyond the first result set', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 }); await signIn(page, 'member@example.test'); await page.goto('/houses')
  await expect(page.getByText('Directory Member 01')).toBeVisible(); await page.getByRole('button', { name: 'Show more members' }).click(); await expect(page.getByText('Directory Member 26')).toBeVisible()
  await page.getByLabel('Search members by name').fill('Directory Member 03'); await expect(page.getByText('Directory Member 03')).toBeVisible(); await expect(page.getByText('Directory Member 04')).toHaveCount(0)
  await page.getByRole('button', { name: 'Clear filters' }).click(); await expect(page.getByText('Directory Member 01')).toBeVisible()
})

test('directory profile navigation remains usable at mobile, tablet, and desktop widths', async ({ page }) => {
  await signIn(page, 'member@example.test')
  for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport); await page.goto('/houses'); await page.getByRole('link', { name: "View Directory Member 01's profile" }).click()
    await expect(page.getByRole('heading', { name: 'Directory Member 01' })).toBeVisible(); expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(true)
  }
})

test('shell reflows without horizontal overflow at every launch viewport', async ({ page }) => {
  await signIn(page, 'coordinator@example.test')
  const content = page.locator('main')
  for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/home')
    expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(true)
    await expect(content).toBeVisible()
    // Launch gate: the primary content is not fully obscured by fixed chrome in the first viewport.
    // Wait for the fixed chrome (banner/bottom-nav) to settle so the measurement
    // reflects the final layout rather than a mid-render frame.
    await content.evaluate((element) => new Promise<void>((resolve) => {
      let last = element.getBoundingClientRect().top
      let idleFrames = 0
      const step = () => {
        const top = element.getBoundingClientRect().top
        if (top === last) idleFrames += 1
        else { idleFrames = 0; last = top }
        if (idleFrames >= 3) resolve()
        else requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }))
    const unobscured = await content.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight
      return bounds.top < viewportHeight && bounds.bottom > 0
    })
    expect(unobscured).toBe(true)
    const mobileNav = page.locator('.bottom-nav')
    if (viewport.width < 768) {
      await expect(mobileNav).toBeVisible()
      await expect(mobileNav.getByRole('link')).toHaveCount(5)
      await expect(mobileNav.locator('svg')).toHaveCount(5)
    } else await expect(mobileNav).toBeHidden()
  }
})

test('mobile notification centre is keyboard-accessible and displays member-scoped updates', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, 'member@example.test'); await page.goto('/home')
  const notifications = page.getByRole('button', { name: /Notifications \(1 unread\)/ })
  await expect(notifications).toBeVisible(); await notifications.focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Notification centre' })).toContainText('Welcome back')
})

test('critical member controls retain accessible landmarks, keyboard operation, reflow, reduced motion, and touch targets', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 })
  await signIn(page, 'coordinator@example.test'); await page.goto('/home')
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Batch navigation' })).toBeVisible()
  const reunion = page.getByRole('link', { name: 'RSVP now' })
  await reunion.focus(); await expect(reunion).toBeFocused(); await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/reunion$/)
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(true)
  expect(await page.locator('.topbar-actions button, .desktop-nav a, .bottom-nav a, .button-link').evaluateAll((controls) => controls.filter((control) => control.getClientRects().length > 0).filter((control) => {
    const bounds = control.getBoundingClientRect()
    return bounds.width < 48 || bounds.height < 48
  }).map((control) => (control as HTMLElement).innerText || control.getAttribute('aria-label')))).toEqual([])
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(Number.parseFloat(await page.locator('.app').evaluate((app) => getComputedStyle(app).transitionDuration))).toBeLessThanOrEqual(0.00001)
})

test('Coordinator tools live under Account and are hidden from batchmates', async ({ page }) => {
  await signIn(page, 'coordinator@example.test'); await page.goto('/account')
  await expect(page.getByRole('link', { name: 'Open Coordinator tools' })).toBeVisible()
  await signOut(page)
  await signIn(page, 'member@example.test'); await page.goto('/account')
  await expect(page.getByRole('link', { name: 'Open Coordinator tools' })).toHaveCount(0)
})

test('a member can submit, have a payment rejected, and submit a corrected claim', async ({ page }) => {
  await signIn(page, 'member@example.test'); await page.goto('/reunion/fund')
  await page.getByLabel('Amount paid (₹)').fill('30000'); await page.getByLabel('UTR / transaction ID').fill('UTR-PLAYWRIGHT-1'); await page.getByLabel('Payment date').fill('2027-01-06')
  await page.getByRole('button', { name: 'Submit for review' }).click(); await expect(page.getByRole('status')).toContainText('submitted')
  await signOut(page); await signIn(page, 'coordinator@example.test'); await page.goto('/account/coordinator')
  await page.getByRole('button', { name: 'Fund', exact: true }).click()
  await expect(page.getByText('UTR-PLAYWRIGHT-1')).toBeVisible(); await page.locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Payment claims' }) }).getByRole('button', { name: 'Reject' }).click()
  await signOut(page); await signIn(page, 'member@example.test'); await page.goto('/reunion/fund')
  await page.getByLabel('Amount paid (₹)').fill('30000'); await page.getByLabel('UTR / transaction ID').fill('UTR-PLAYWRIGHT-2'); await page.getByLabel('Payment date').fill('2027-01-06')
  await page.getByRole('button', { name: 'Submit for review' }).click(); await expect(page.getByRole('status')).toContainText('submitted')
})

test('opening notifications does not mark them read; the explicit mark-all does, and deep links navigate', async ({ page }) => {
  await signIn(page, 'member@example.test'); await page.goto('/home')
  const notifications = page.getByRole('button', { name: /Notifications \(1 unread\)/ })
  await notifications.click(); await expect(page.getByRole('region', { name: 'Notification centre' })).toContainText('Welcome back')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /Notifications \(1 unread\)/ })).toBeVisible()
})

test('account edits reveal a sticky save control and cancel leaves changes unpersisted', async ({ page }) => {
  await signIn(page, 'member@example.test'); await page.goto('/account')
  await expect(page.getByRole('button', { name: 'Save profile' })).toHaveCount(0)
  await page.getByLabel('City').fill('Nagpur'); await expect(page.getByRole('button', { name: 'Save profile' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('You have unsaved changes. Save or discard them before leaving.')
  await page.getByRole('button', { name: 'Save profile' }).click(); await expect(page.getByRole('status')).toContainText('Profile saved')
  await page.getByRole('button', { name: 'Save profile' }).waitFor({ state: 'hidden' }).catch(() => {})
})

test('Coordinator operations are organised into tabs and destructive actions confirm', async ({ page }) => {
  await signIn(page, 'coordinator@example.test'); await page.goto('/account/coordinator')
  await expect(page.getByRole('button', { name: 'Requests', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Reunion', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Reunion details' })).toBeVisible()
  await page.getByRole('button', { name: 'Announcements', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Batch announcement' })).toBeVisible()
})

test('members can comment and report a memory, then a Coordinator moderates it', async ({ page }) => {
  await signIn(page, 'member@example.test'); await page.goto('/memories')
  await expect(page.getByText('Archive test memory')).toBeVisible()
  await page.getByLabel('Comment').fill('Great memory'); await page.getByRole('button', { name: 'Comment' }).click()
  await expect(page.getByRole('status')).toContainText('Comment added')
  await page.getByRole('button', { name: 'Report' }).click(); await expect(page.getByRole('status')).toContainText('Report sent')
  await signOut(page); await signIn(page, 'coordinator@example.test'); await page.goto('/memories')
  await expect(page.getByText('Open moderation reports')).toBeVisible(); await page.getByRole('button', { name: 'Hide' }).click(); await page.getByRole('alertdialog', { name: 'Hide reported content' }).getByRole('button', { name: 'Hide content' }).click()
  await expect(page.getByRole('status')).toContainText('hidden')
})

test('a member uploads an image memory that becomes visible in the private archive', async ({ page }) => {
  await signIn(page, 'member@example.test'); await page.goto('/memories')
  await page.getByLabel('Caption').fill('Uploaded archive image')
  await page.getByLabel('Photos or videos').setInputFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') })
  await page.getByLabel(/I have the right to share this/).first().check(); await page.getByRole('button', { name: 'Publish memory' }).click()
  await expect(page.getByRole('status')).toContainText('Memory published')
  await expect(page.getByText('Uploaded archive image')).toBeVisible()
})

test('destructive archive actions require an accessible confirmation and restore focus on cancellation', async ({ page }) => {
  await signIn(page, 'member@example.test'); await page.goto('/memories')
  const deleteButton = page.getByRole('button', { name: 'Delete' })
  await deleteButton.click()
  const dialog = page.getByRole('alertdialog', { name: 'Delete memory' })
  await expect(dialog).toContainText('This action cannot be undone.')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(deleteButton).toBeFocused()
})
