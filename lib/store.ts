import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'admin' | 'teacher' | 'smt' | 'admin-teacher' | 'monitor-guardian'

interface UserSession {
  id: string
  username: string
  display_name: string
  role: string
  roles?: string[]
  school_id: string
  school_name: string
}

interface AppState {
  user: UserSession | null
  logoutWarning: string | null
  loginTime: number | null
  keepSignedIn: boolean
  setUser: (user: UserSession | null, keepSignedIn?: boolean) => void
  updateDisplayName: (userId: string, displayName: string) => void
  logout: () => void
  isSessionValid: () => boolean
  hasRole: (role: string) => boolean
  isAdmin: () => boolean
}

const SESSION_HOURS = 12
const SESSION_YEAR = 24 * 365

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      logoutWarning: null,
      loginTime: null,
      keepSignedIn: false,
      setUser: (user, keepSignedIn = get().keepSignedIn) => set({ user, logoutWarning: null, loginTime: user ? Date.now() : null, keepSignedIn }),
      updateDisplayName: (userId, displayName) => set(state => state.user?.id === userId
        ? { user: { ...state.user, display_name: displayName } }
        : {}),
      logout: () => {
        set({ user: null, loginTime: null, keepSignedIn: false, logoutWarning: null })
        void (async () => {
          try {
            const response = await fetch('/api/auth/logout', { method: 'POST' })
            if (!response.ok) throw new Error('Server sign-out failed')
          } catch {
            if (!get().user) set({ logoutWarning: 'Signed out on this device, but server sign-out could not be confirmed. Reconnect and retry before leaving a shared device.' })
          }
        })()
      },
      isSessionValid: () => {
        const { loginTime, keepSignedIn } = get()
        if (!loginTime) return false
        const hours = keepSignedIn ? SESSION_YEAR : SESSION_HOURS
        return Date.now() - loginTime < hours * 60 * 60 * 1000
      },
      hasRole: (role: string) => {
        const u = get().user
        if (!u) return false
        const roles = u.roles && u.roles.length > 0 ? u.roles : [u.role]
        return roles.includes(role)
      },
      isAdmin: () => {
        const u = get().user
        if (!u) return false
        const roles = u.roles && u.roles.length > 0 ? u.roles : [u.role]
        return roles.includes('admin')
      },
    }),
    { name: 'edutrack-auth' }
  )
)

