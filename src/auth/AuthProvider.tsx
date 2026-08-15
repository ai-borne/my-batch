import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { GoogleAuthProvider, User, onAuthStateChanged, reauthenticateWithPopup, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore/lite'
import { firebaseServices } from '../lib/firebase'
import { Membership, PILOT_BATCH_ID } from '../lib/membership'
import { clearPrivateAppCache } from '../lib/cachePrivacy'
import { hasSuperAdminClaim, shouldLoadMemberSession } from '../lib/authorization'

type AuthState = { user: User | null; membership: Membership | null; isSuperAdmin: boolean; loading: boolean; signIn: () => Promise<void>; signInForE2E: (email: string, password: string) => Promise<void>; signOut: () => Promise<void>; reauthenticate: () => Promise<void>; refreshMembership: () => Promise<void> }
const AuthContext = createContext<AuthState | null>(null)
async function fetchMembership(uid: string): Promise<Membership> {
  const snapshot = await getDoc(doc(firebaseServices().db, `batches/${PILOT_BATCH_ID}/memberships/${uid}`))
  return snapshot.exists() ? snapshot.data() as Membership : { status: 'none' }
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [membership, setMembership] = useState<Membership | null>(null); const [isSuperAdmin, setIsSuperAdmin] = useState(false); const [loading, setLoading] = useState(true)
  const refreshMembership = useCallback(async () => { if (user) setMembership(await fetchMembership(user.uid)) }, [user])
  useEffect(() => {
    const { auth, db } = firebaseServices()
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser)
      if (nextUser) {
        const token = await nextUser.getIdTokenResult()
        const nextIsSuperAdmin = hasSuperAdminClaim(token.claims)
        setIsSuperAdmin(nextIsSuperAdmin)
        if (!shouldLoadMemberSession(nextIsSuperAdmin)) {
          setMembership({ status: 'none' })
          setLoading(false)
          return
        }
        const userRef = doc(db, 'users', nextUser.uid)
        const existingUser = await getDoc(userRef)
        await setDoc(userRef, { uid: nextUser.uid, displayName: nextUser.displayName ?? '', email: nextUser.email ?? '', photoURL: nextUser.photoURL ?? null, updatedAt: serverTimestamp(), ...(!existingUser.exists() ? { createdAt: serverTimestamp() } : {}) }, { merge: true })
        setMembership(await fetchMembership(nextUser.uid))
      } else { setMembership(null); setIsSuperAdmin(false) }
      setLoading(false)
    })
  }, [])
  const value = useMemo(() => ({ user, membership, isSuperAdmin, loading, refreshMembership, signIn: async () => { await signInWithPopup(firebaseServices().auth, new GoogleAuthProvider()) }, signInForE2E: async (email: string, password: string) => { if (import.meta.env.VITE_E2E_AUTH !== 'true') throw new Error('Test sign-in is unavailable.'); await signInWithEmailAndPassword(firebaseServices().auth, email, password) }, signOut: async () => { await clearPrivateAppCache(); await signOut(firebaseServices().auth) }, reauthenticate: async () => { if (!user) throw new Error('Sign in is required.'); if (import.meta.env.VITE_E2E_AUTH === 'true') { await user.getIdToken(true); return }; await reauthenticateWithPopup(user, new GoogleAuthProvider()); await user.getIdToken(true) } }), [user, membership, isSuperAdmin, loading, refreshMembership])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() { const state = useContext(AuthContext); if (!state) throw new Error('useAuth must be rendered within AuthProvider.'); return state }
