import { defineConfig } from '@playwright/test'

const appPort = Number(process.env.AJINKYANS_E2E_APP_PORT ?? '4173')

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global.setup.cjs',
  use: { baseURL: `http://127.0.0.1:${appPort}` },
  webServer: { command: 'npm --prefix functions run build && node scripts/run-e2e-server.mjs', port: appPort, reuseExistingServer: false, gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 } },
})
