import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { db } from './shared.js'

export const callablePolicies = {
  addArchiveMedia: { limit: 6, windowSeconds: 600, rationale: 'media verification is compute-intensive' },
  approveMembership: { limit: 5, windowSeconds: 600, rationale: 'membership changes are material' },
  assignCoordinator: { limit: 3, windowSeconds: 3600, rationale: 'role grants are high impact' },
  attachExpenseReceipt: { limit: 10, windowSeconds: 600, rationale: 'receipt attachment is sensitive' },
  attachPaymentEvidence: { limit: 6, windowSeconds: 600, rationale: 'payment evidence is sensitive' },
  cleanupArchiveOrphans: { limit: 2, windowSeconds: 3600, rationale: 'cleanup scans batch storage' },
  createAlbum: { limit: 10, windowSeconds: 600, rationale: 'content creation abuse control' },
  createPost: { limit: 10, windowSeconds: 600, rationale: 'content creation abuse control' },
  deleteOwnComment: { limit: 20, windowSeconds: 600, rationale: 'destructive content mutation' },
  deleteOwnPost: { limit: 10, windowSeconds: 600, rationale: 'destructive content mutation' },
  manageAlbum: { limit: 10, windowSeconds: 600, rationale: 'content moderation control' },
  manageMembership: { limit: 10, windowSeconds: 600, rationale: 'membership changes are material' },
  markNotificationsRead: { limit: 30, windowSeconds: 600, rationale: 'limits write amplification' },
  moderateArchiveContent: { limit: 10, windowSeconds: 600, rationale: 'moderation changes are material' },
  publishAnnouncement: { limit: 3, windowSeconds: 600, rationale: 'fan-out notification control' },
  rebuildFundSummary: { limit: 3, windowSeconds: 600, rationale: 'summary rebuild reads financial records' },
  rejectMembership: { limit: 5, windowSeconds: 600, rationale: 'membership changes are material' },
  reopenRsvp: { limit: 10, windowSeconds: 600, rationale: 'Coordinator RSVP override' },
  reportArchiveContent: { limit: 10, windowSeconds: 600, rationale: 'report spam control' },
  requestProfileDataChange: { limit: 3, windowSeconds: 3600, rationale: 'privacy request intake control' },
  reviewExpense: { limit: 10, windowSeconds: 600, rationale: 'financial approval is material' },
  reviewPaymentClaim: { limit: 10, windowSeconds: 600, rationale: 'payment review is material' },
  saveArchiveComment: { limit: 20, windowSeconds: 600, rationale: 'comment spam control' },
  saveExpense: { limit: 10, windowSeconds: 600, rationale: 'financial record creation' },
  setArchiveLike: { limit: 60, windowSeconds: 600, rationale: 'like spam control' },
  submitPaymentClaim: { limit: 4, windowSeconds: 600, rationale: 'payment claim abuse control' },
  submitRsvp: { limit: 10, windowSeconds: 600, rationale: 'RSVP write control' },
  updateOwnPost: { limit: 20, windowSeconds: 600, rationale: 'content mutation abuse control' },
} as const

type CallableName = keyof typeof callablePolicies

export const secureCall = (handler: (request: any) => Promise<unknown>) => onCall(
  { enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true' },
  async (request) => {
    try {
      return await handler(request)
    } catch (error) {
      if (error instanceof HttpsError) throw error
      console.error('Callable failed', { errorType: error instanceof Error ? error.name : 'unknown' })
      throw new HttpsError('internal', 'The request could not be completed. Please try again.')
    }
  },
)

export async function limitCallable(batchId: string, uid: string, operation: CallableName) {
  const policy = callablePolicies[operation]
  const rateLimitRef = db.doc(`rateLimits/${batchId}:${uid}:${operation}`)
  await db.runTransaction(async (transaction) => {
    const now = Timestamp.now()
    const current = await transaction.get(rateLimitRef)
    const startedAt = current.data()?.windowStartedAt as Timestamp | undefined
    const inWindow = startedAt !== undefined && now.seconds - startedAt.seconds < policy.windowSeconds
    const count = inWindow ? Number(current.data()?.count ?? 0) : 0
    if (count >= policy.limit) throw new HttpsError('resource-exhausted', 'Too many requests. Please wait and try again.')
    transaction.set(rateLimitRef, {
      batchId, uid, operation, count: count + 1, windowStartedAt: inWindow ? startedAt : now,
      expiresAt: Timestamp.fromMillis(now.toMillis() + policy.windowSeconds * 2_000), updatedAt: FieldValue.serverTimestamp(),
    })
  })
}
