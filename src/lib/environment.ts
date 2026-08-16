/**
 * environment.ts — single source of truth for which environment the app is in.
 *
 * The app runs in exactly one of three environments:
 *   - 'local'       → Firebase Emulator Suite (no App Check, emulator ports)
 *   - 'staging'     → a deployed non-production Firebase project (App Check on)
 *   - 'production'  → the live Firebase project (App Check on)
 *
 * Set VITE_APP_ENV in your .env.local. For backward compatibility, the legacy
 * VITE_USE_FIREBASE_EMULATORS=true flag is still honoured and maps to 'local'.
 */
export type AppEnvironment = 'local' | 'staging' | 'production'

export function appEnvironment(): AppEnvironment {
  const explicit = import.meta.env.VITE_APP_ENV
  if (explicit === 'local' || explicit === 'staging' || explicit === 'production') return explicit
  // Legacy flag: VITE_USE_FIREBASE_EMULATORS=true meant local emulator work.
  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') return 'local'
  return import.meta.env.PROD ? 'production' : 'local'
}

export const isLocal = () => appEnvironment() === 'local'
export const isStaging = () => appEnvironment() === 'staging'
export const isProduction = () => appEnvironment() === 'production'