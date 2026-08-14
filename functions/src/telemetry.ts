import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { db, requireActiveMember, requireBatchId, requireUid } from './shared.js'
import { limitCallable, secureCall } from './security.js'

const eventCodes = new Set(['callable_failed', 'upload_failed', 'ui_crash', 'performance_regression'])
const surfaces = new Set(['archive', 'finance', 'notifications', 'app'])

export const recordTelemetry = secureCall(async (request) => {
  const { batchId, eventCode, correlationId, surface } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await requireActiveMember(batchId, uid)
  await limitCallable(batchId, uid, 'recordTelemetry')
  if (Object.keys(request.data).some((key) => !['batchId', 'requestId', 'eventCode', 'correlationId', 'surface'].includes(key)) || !eventCodes.has(String(eventCode)) || !surfaces.has(String(surface)) || typeof correlationId !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(correlationId)) throw new HttpsError('invalid-argument', 'Telemetry data is invalid.')
  await db.collection(`batches/${batchId}/telemetryEvents`).add({ eventCode, correlationId, surface, createdAt: FieldValue.serverTimestamp() })
  return { recorded: true }
})
