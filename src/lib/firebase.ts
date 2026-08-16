import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app'
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth'
import { Firestore, connectFirestoreEmulator, getFirestore } from 'firebase/firestore/lite'
import { FirebaseStorage, connectStorageEmulator, getStorage } from 'firebase/storage'
import { Functions, connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { ReCaptchaEnterpriseProvider, initializeAppCheck } from 'firebase/app-check'
import { appEnvironment } from './environment'

const requiredKeys = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_APP_ID'] as const

function config() {
  const missing = requiredKeys.filter((key) => !import.meta.env[key])
  if (missing.length) throw new Error(`Firebase configuration is missing: ${missing.join(', ')}`)
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }
}

let emulatorsConnected = false
let appCheckInitialized = false
const emulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_HOST ?? '127.0.0.1'
const authEmulatorPort = Number(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT ?? 9099)
const firestoreEmulatorPort = Number(import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT ?? 8080)
const storageEmulatorPort = Number(import.meta.env.VITE_FIREBASE_STORAGE_EMULATOR_PORT ?? 9199)
const functionsEmulatorPort = Number(import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT ?? 5001)
export function firebaseServices(): { app: FirebaseApp; auth: Auth; db: Firestore; storage: FirebaseStorage; functions: Functions } {
  const app = getApps().length ? getApp() : initializeApp(config())
  const environment = appEnvironment()
  if (!appCheckInitialized && environment !== 'local') {
    const siteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY
    if (!siteKey) throw new Error('Firebase App Check is missing VITE_RECAPTCHA_ENTERPRISE_SITE_KEY.')
    initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true })
    appCheckInitialized = true
  }
  const auth = getAuth(app)
  const db = getFirestore(app)
  const storage = getStorage(app)
  const functions = getFunctions(app)
  if (environment === 'local' && !emulatorsConnected) {
    connectAuthEmulator(auth, `http://${emulatorHost}:${authEmulatorPort}`, { disableWarnings: true })
    connectFirestoreEmulator(db, emulatorHost, firestoreEmulatorPort)
    connectStorageEmulator(storage, emulatorHost, storageEmulatorPort)
    connectFunctionsEmulator(functions, emulatorHost, functionsEmulatorPort)
    emulatorsConnected = true
  }
  return { app, auth, db, storage, functions }
}
