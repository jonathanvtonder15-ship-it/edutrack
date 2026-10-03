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
  loginTime: number | null
  keepSignedIn: boolean
  setUser: (user: UserSession | null, keepSignedIn?: boolean) => void
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
      loginTime: null,
      keepSignedIn: false,
      setUser: (user, keepSignedIn = false) => set({ user, loginTime: user ? Date.now() : null, keepSignedIn }),
      logout: () => set({ user: null, loginTime: null, keepSignedIn: false }),
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

