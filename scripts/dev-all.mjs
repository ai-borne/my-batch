#!/usr/bin/env node
/**
 * dev:all — one command for local development.
 *
 * Starts the Firebase Emulator Suite, seeds demo data, and runs the Vite dev
 * server against the emulators. This replaces the manual sequence of
 * "start emulators, then seed, then run dev" that is easy to get wrong.
 *
 * Usage:
 *   npm run dev:all
 *
 * The app connects to the emulators because VITE_APP_ENV=local is set here.
 */
import { spawn } from 'node:child_process'

const appPort = process.env.AJINKYANS_DEV_APP_PORT ?? '5173'
const environment = {
  ...process.env,
  VITE_APP_ENV: 'local',
  VITE_USE_FIREBASE_EMULATORS: 'true',
  VITE_FIREBASE_API_KEY: 'test',
  VITE_FIREBASE_AUTH_DOMAIN: 'test.invalid',
  VITE_FIREBASE_PROJECT_ID: 'demo-no-project',
  VITE_FIREBASE_STORAGE_BUCKET: 'demo-no-project.appspot.com',
  VITE_FIREBASE_APP_ID: 'test',
  // The seed/wait scripts default to the e2e ports; point them at the default
  // firebase.json emulator ports used here.
  AJINKYANS_E2E_FIRESTORE_PORT: '8080',
  AJINKYANS_E2E_AUTH_PORT: '9099',
  AJINKYANS_E2E_STORAGE_PORT: '9199',
  AJINKYANS_E2E_FUNCTIONS_PORT: '5001',
}

const seedCommand = 'node scripts/seed-e2e.cjs && node scripts/wait-for-e2e-firestore.mjs && '
const emulator = spawn('firebase', ['emulators:exec', '--config', 'firebase.json', '--only', 'auth,firestore,storage,functions', `${seedCommand}npm run dev -- --host 127.0.0.1 --port ${appPort}`], { detached: true, env: environment, stdio: 'inherit' })
let stopping = false
const stop = (signal) => {
  if (stopping) return
  stopping = true
  process.kill(-emulator.pid, signal)
  setTimeout(() => process.kill(-emulator.pid, 'SIGKILL'), 5_000).unref()
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(signal))
emulator.on('exit', (code, signal) => process.exitCode = code ?? (signal ? 1 : 0))