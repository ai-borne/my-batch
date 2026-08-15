import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const callableExports = [
  'addArchiveMedia', 'approveMembership', 'assignCoordinator', 'attachExpenseReceipt', 'attachPaymentEvidence', 'listGovernanceAuditEvents', 'listGovernanceMembers',
  'cleanupArchiveOrphans', 'createAlbum', 'createPost', 'deleteOwnComment', 'deleteOwnPost', 'manageAlbum',
  'manageMembership', 'markNotificationsRead', 'moderateArchiveContent', 'publishAnnouncement', 'rebuildFundSummary',
  'rejectMembership', 'reopenRsvp', 'reportArchiveContent', 'requestProfileDataChange', 'reviewExpense',
  'reviewPaymentClaim', 'saveArchiveComment', 'saveExpense', 'setArchiveLike', 'submitPaymentClaim', 'submitRsvp', 'updateOwnPost',
]

describe('GS-1 callable controls', () => {
  it('keeps every callable behind the shared App Check and safe-error boundary with an operation-specific durable limit', async () => {
    const [index, security] = await Promise.all([
      readFile('functions/src/index.ts', 'utf8'),
      readFile('functions/src/security.ts', 'utf8'),
    ])
    expect(security).toContain("enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true'")
    expect(security).toContain("rateLimits/${batchId}:${uid}:${operation}")
    expect(security).toContain("throw new HttpsError('internal'")
    for (const callable of callableExports) {
      expect(index).toContain(callable)
      expect(security).toContain(`${callable}: { limit:`)
    }
  })
})
