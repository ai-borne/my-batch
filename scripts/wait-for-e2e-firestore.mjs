const host = process.env.AJINKYANS_E2E_FIRESTORE_HOST ?? '127.0.0.1'
const port = process.env.AJINKYANS_E2E_FIRESTORE_PORT ?? '48080'
const endpoint = `http://${host}:${port}/v1/projects/demo-no-project/databases/(default)/documents/batches/sssatara-2002`
const attempts = 30
const delayMs = 100

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

let consecutiveResponses = 0
for (let attempt = 0; attempt < attempts; attempt += 1) {
  try {
    await fetch(endpoint)
    consecutiveResponses += 1
    if (consecutiveResponses === 3) process.exit(0)
  } catch {
    consecutiveResponses = 0
  }
  await wait(delayMs)
}

throw new Error(`Firestore emulator did not stabilize at ${endpoint}.`)
