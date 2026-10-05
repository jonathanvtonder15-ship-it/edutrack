import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/supabase-auth'
import { SESSION_COOKIE, checkRequestOrigin } from '@/lib/session'

export async function POST(req: NextRequest) {
  const originError = checkRequestOrigin(req)
  if (originError) return originError
  let incomplete = false
  try {
    const auth = await getAuthenticatedSupabase()
    const { error } = await auth.auth.signOut({ scope: 'local' })
    incomplete = Boolean(error)
  } catch {
    incomplete = true
  }
  const response = incomplete
    ? NextResponse.json({ error: 'Server sign-out could not be completed' }, { status: 503 })
    : NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 })
  return response
}
