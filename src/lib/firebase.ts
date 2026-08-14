import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app'
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth'
import { Firestore, connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { FirebaseStorage, connectStorageEmulator, getStorage } from 'firebase/storage'
import { Functions, connectFunctionsEmulator, getFunctions } from 'firebase/functions'

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
export function firebaseServices(): { app: FirebaseApp; auth: Auth; db: Firestore; storage: FirebaseStorage; functions: Functions } {
  const app = getApps().length ? getApp() : initializeApp(config())
  const auth = getAuth(app)
  const db = getFirestore(app)
  const storage = getStorage(app)
  const functions = getFunctions(app)
  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' && !emulatorsConnected) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
    connectStorageEmulator(storage, '127.0.0.1', 9199)
    connectFunctionsEmulator(functions, '127.0.0.1', 5001)
    emulatorsConnected = true
  }
  return { app, auth, db, storage, functions }
}
