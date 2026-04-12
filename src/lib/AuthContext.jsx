import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// ── Put your Supabase user ID here to grant admin access ──
const ADMIN_USER_IDS = [
  // Replace this with your actual Supabase user ID
  // Find it: Supabase Dashboard → Authentication → Users → click your user
  'ed1f34a7-7838-4d01-a29c-63220c43e9f1'
]

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      // Remove the static HTML loader once auth state is known
      const loader = document.getElementById('app-init-loader')
      if (loader) loader.remove()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const user = session?.user ?? null
  const isAdmin = user ? ADMIN_USER_IDS.includes(user.id) : false

  // Hold rendering until session is resolved to prevent flash of blank screen
  if (session === undefined) return null

  return (
    <AuthContext.Provider value={{ session, user, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
