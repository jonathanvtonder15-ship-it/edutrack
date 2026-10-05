import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase-server'
import { setSession, checkRequestOrigin } from '@/lib/session'
import { authEmail, getAuthenticatedSupabase } from '@/lib/supabase-auth'

const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 60000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  for (const [key, value] of loginAttempts) if (value.resetAt <= now) loginAttempts.delete(key)
  const record = loginAttempts.get(ip)
  if (!record || now > record.resetAt) { loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS }); return true }
  if (record.count >= MAX_ATTEMPTS) return false
  record.count++; return true
}

export async function POST(req: NextRequest) {
  const originError = checkRequestOrigin(req)
  if (originError) return originError
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(ip)) return NextResponse.json({ error: 'Too many login attempts. Please wait 1 minute.' }, { status: 429 })
    const { username, password, keepSignedIn } = await req.json().catch(() => null) || {}
    if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
    const supabase = getServiceSupabase()
    const { data: user, error } = await supabase.from('users').select('id,username,display_name,role,roles,school_id,schools(name)').eq('active', true).eq('username', username.toLowerCase().trim()).single()
    if (error || !user) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    const auth = await getAuthenticatedSupabase()
    const { error: signInError } = await auth.auth.signInWithPassword({ email: authEmail(user.id), password })
    if (signInError) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    return setSession(NextResponse.json({ user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role, roles: (user.roles && user.roles.length > 0) ? user.roles : [user.role], school_id: user.school_id, school_name: (user.schools as unknown as { name: string })?.name || 'Unknown School' } }), user.id, keepSignedIn === true)
  } catch (err) { console.error('Login error:', err); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }) }
}

