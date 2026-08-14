const eventCodes = new Set(['callable_failed', 'upload_failed', 'ui_crash', 'performance_regression'])
const surfaces = new Set(['archive', 'finance', 'notifications', 'app'])

export type TelemetryEvent = { eventCode: string; correlationId: string; surface: string }

export function sanitizeTelemetry(value: Record<string, unknown>): TelemetryEvent {
  if (Object.keys(value).some((key) => !['eventCode', 'correlationId', 'surface'].includes(key)) || !eventCodes.has(String(value.eventCode)) || !surfaces.has(String(value.surface)) || typeof value.correlationId !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(value.correlationId)) throw new Error('Telemetry data is invalid.')
  return { eventCode: String(value.eventCode), correlationId: value.correlationId, surface: String(value.surface) }
}

export async function reportTelemetry(event: TelemetryEvent) {
  try { await httpsCallable(firebaseServices().functions, 'recordTelemetry')({ batchId: PILOT_BATCH_ID, requestId: crypto.randomUUID(), ...sanitizeTelemetry(event) }) } catch { /* Telemetry must never interrupt the member journey. */ }
}
import { httpsCallable } from 'firebase/functions'
import { firebaseServices } from './firebase'
import { PILOT_BATCH_ID } from './membership'
