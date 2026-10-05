import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from './supabase-server'
import { signSession, verifySession } from './session-token'

export const SESSION_COOKIE = 'edutrack_session'
export function sessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters')
  return secret
}

export function setSession(response: NextResponse, userId: string, keepSignedIn = false) {
  const maxAge = (keepSignedIn ? 365 * 24 : 12) * 60 * 60
  response.cookies.set(SESSION_COOKIE, signSession({ userId, expiresAt: Date.now() + maxAge * 1000 }, sessionSecret()), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge,
  })
  return response
}

export async function requireSession(req: NextRequest, adminOnly = false) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const claims = token ? verifySession(token, sessionSecret()) : null
  if (!claims) return { response: NextResponse.json({ error: 'Please sign in again' }, { status: 401 }) }
  const origin = req.headers.get('origin')
  // Next's internal URL may use the bind address; browsers send the public Host.
  const expectedOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.headers.get('host') || req.nextUrl.host}`).origin
  if (origin && origin !== expectedOrigin) return { response: NextResponse.json({ error: 'Invalid request origin' }, { status: 403 }) }
  const supabase = getServiceSupabase()
  const { data: user, error } = await supabase.from('users').select('id,school_id,role,roles').eq('id', claims.userId).single()
  if (error || !user) return { response: NextResponse.json({ error: 'Please sign in again' }, { status: 401 }) }
  const roles: string[] = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role]
  if (adminOnly && !roles.some(role => role === 'admin' || role === 'admin-teacher')) return { response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  return { user, supabase }
}
