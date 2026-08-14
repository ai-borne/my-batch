import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
const launcher = readFileSync('scripts/run-e2e-server.mjs', 'utf8')
const manualLauncher = readFileSync('scripts/run-e2e-dev.mjs', 'utf8')

describe('manual E2E environment', () => {
  test('starts the isolated test application only after synthetic accounts are seeded', () => {
    expect(packageJson.scripts['dev:e2e']).toBe('node scripts/run-e2e-dev.mjs')
    expect(manualLauncher).toContain("AJINKYANS_E2E_SEED = 'true'")
    expect(launcher).toContain("node scripts/seed-e2e.cjs &&")
  })
})
