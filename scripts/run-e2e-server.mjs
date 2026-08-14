import { spawn } from 'node:child_process'

const authPort = process.env.AJINKYANS_E2E_AUTH_PORT ?? '49099'
const firestorePort = process.env.AJINKYANS_E2E_FIRESTORE_PORT ?? '48080'
const storagePort = process.env.AJINKYANS_E2E_STORAGE_PORT ?? '49199'
const functionsPort = process.env.AJINKYANS_E2E_FUNCTIONS_PORT ?? '45001'
const appPort = process.env.AJINKYANS_E2E_APP_PORT ?? '4173'
const config = process.env.AJINKYANS_E2E_EMULATOR_CONFIG ?? 'firebase.e2e.json'
const environment = {
  ...process.env,
  VITE_FIREBASE_API_KEY: 'test',
  VITE_FIREBASE_AUTH_DOMAIN: 'test.invalid',
  VITE_FIREBASE_PROJECT_ID: 'demo-no-project',
  VITE_FIREBASE_STORAGE_BUCKET: 'demo-no-project.appspot.com',
  VITE_FIREBASE_APP_ID: 'test',
  VITE_USE_FIREBASE_EMULATORS: 'true',
  VITE_E2E_AUTH: 'true',
  VITE_FIREBASE_AUTH_EMULATOR_PORT: authPort,
  VITE_FIREBASE_FIRESTORE_EMULATOR_PORT: firestorePort,
  VITE_FIREBASE_STORAGE_EMULATOR_PORT: storagePort,
  VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT: functionsPort,
}

const seedCommand = process.env.AJINKYANS_E2E_SEED === 'true' ? 'node scripts/seed-e2e.cjs && ' : ''
const emulator = spawn('firebase', ['emulators:exec', '--config', config, '--only', 'auth,firestore,storage,functions', `${seedCommand}npm run dev -- --host 127.0.0.1 --port ${appPort}`], { detached: true, env: environment, stdio: 'inherit' })
let stopping = false
const stop = (signal) => {
  if (stopping) return
  stopping = true
  process.kill(-emulator.pid, signal)
  setTimeout(() => process.kill(-emulator.pid, 'SIGKILL'), 5_000).unref()
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(signal))
emulator.on('exit', (code, signal) => process.exitCode = code ?? (signal ? 1 : 0))
