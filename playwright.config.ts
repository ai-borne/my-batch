import { defineConfig } from '@playwright/test'

const authPort = process.env.AJINKYANS_E2E_AUTH_PORT ?? '9099'
const firestorePort = process.env.AJINKYANS_E2E_FIRESTORE_PORT ?? '8080'
const storagePort = process.env.AJINKYANS_E2E_STORAGE_PORT ?? '9199'
const functionsPort = process.env.AJINKYANS_E2E_FUNCTIONS_PORT ?? '5001'
const appPort = Number(process.env.AJINKYANS_E2E_APP_PORT ?? '4173')
const emulatorConfig = process.env.AJINKYANS_E2E_EMULATOR_CONFIG ? `--config ${process.env.AJINKYANS_E2E_EMULATOR_CONFIG}` : ''
const appEnvironment = `VITE_FIREBASE_API_KEY=test VITE_FIREBASE_AUTH_DOMAIN=test.invalid VITE_FIREBASE_PROJECT_ID=demo-no-project VITE_FIREBASE_STORAGE_BUCKET=demo-no-project.appspot.com VITE_FIREBASE_APP_ID=test VITE_USE_FIREBASE_EMULATORS=true VITE_E2E_AUTH=true VITE_FIREBASE_AUTH_EMULATOR_PORT=${authPort} VITE_FIREBASE_FIRESTORE_EMULATOR_PORT=${firestorePort} VITE_FIREBASE_STORAGE_EMULATOR_PORT=${storagePort} VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT=${functionsPort}`

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global.setup.cjs',
  use: { baseURL: `http://127.0.0.1:${appPort}` },
  webServer: { command: `npm --prefix functions run build && ${appEnvironment} firebase emulators:exec ${emulatorConfig} --only auth,firestore,storage,functions "npm run dev -- --host 127.0.0.1 --port ${appPort}"`, port: appPort, reuseExistingServer: !process.env.CI },
})
