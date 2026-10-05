import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Usernames remain the public login identifier; these addresses never receive mail.
export const authEmail = (id: string) => `${id}@users.edutrack.invalid`

export async function getAuthenticatedSupabase() {
  const jar = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase authentication configuration is missing')
  return createServerClient(url, key, {
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: values => { for (const { name, value, options } of values) jar.set(name, value, options) },
    },
  })
}
