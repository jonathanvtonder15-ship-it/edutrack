import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from './supabase-server'
import { getAuthenticatedSupabase } from './supabase-auth'
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

export function checkRequestOrigin(req: NextRequest) {
  const origin = req.headers.get('origin')
  const expected = new URL(process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.headers.get('host') || req.nextUrl.host}`).origin
  if ((origin && origin !== expected) || req.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  return null
}

export async function requireSession(req: NextRequest, adminOnly = false) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const claims = token ? verifySession(token, sessionSecret()) : null
  if (!claims) return { response: NextResponse.json({ error: 'Please sign in again' }, { status: 401 }) }
  const originError = checkRequestOrigin(req)
  if (originError) return { response: originError }
  const authenticatedSupabase = await getAuthenticatedSupabase()
  const { data: identity, error: authError } = await authenticatedSupabase.auth.getUser()
  if (authError || identity.user?.id !== claims.userId) return { response: NextResponse.json({ error: 'Please sign in again' }, { status: 401 }) }
  const supabase = getServiceSupabase()
  const { data: user, error } = await supabase.from('users').select('id,school_id,role,roles,username,display_name,schools(name)').eq('active', true).eq('id', claims.userId).single()
  if (error || !user) return { response: NextResponse.json({ error: 'Please sign in again' }, { status: 401 }) }
  const roles: string[] = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role]
  if (adminOnly && !roles.some(role => role === 'admin' || role === 'admin-teacher')) return { response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  return { user, supabase, authenticatedSupabase }
}
