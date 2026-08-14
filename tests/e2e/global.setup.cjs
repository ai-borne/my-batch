process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${process.env.AJINKYANS_E2E_AUTH_PORT ?? '9099'}`
process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${process.env.AJINKYANS_E2E_FIRESTORE_PORT ?? '8080'}`

const { seedE2E } = require('../../scripts/seed-e2e.cjs')

module.exports = seedE2E
