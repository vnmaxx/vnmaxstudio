import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'

interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  approved: boolean
  isAdmin: boolean
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, logout: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (!firebaseUser) {
        setUser(null)
        setLoading(false)
        return
      }

      const isAdmin = firebaseUser.email === 'admin@studioia.com'

      const ref = doc(db, 'users', firebaseUser.uid)
      const snap = await getDoc(ref)

      if (!snap.exists()) {
        await setDoc(ref, {
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || '',
          approved: isAdmin,
          createdAt: serverTimestamp(),
        })
      }

      const data = snap.exists() ? snap.data() : { approved: isAdmin }

      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        approved: isAdmin || data.approved === true,
        isAdmin,
      })
      setLoading(false)
    })
    return unsub
  }, [])

  const logout = () => signOut(auth)

  return <AuthContext.Provider value={{ user, loading, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
