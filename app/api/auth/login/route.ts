import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mkfixnivoyqghvmrsloj.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZml4bml2b3lxZ2h2bXJzbG9qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU2MjExNywiZXhwIjoyMDkyMTM4MTE3fQ.wZVOtCUdzqDxCWSOhAELjuZDQD1PdPRRREFtjAjQ5QE'

const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 60000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = loginAttempts.get(ip)
  if (!record || now > record.resetAt) { loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS }); return true }
  if (record.count >= MAX_ATTEMPTS) return false
  record.count++; return true
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(ip)) return NextResponse.json({ error: 'Too many login attempts. Please wait 1 minute.' }, { status: 429 })
    const { username, password } = await req.json()
    if (!username || !password) return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: user, error } = await supabase.from('users').select('*, schools(name)').eq('username', username.toLowerCase().trim()).single()
    if (error || !user) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    return NextResponse.json({ user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role, roles: (user.roles && user.roles.length > 0) ? user.roles : [user.role], school_id: user.school_id, school_name: (user.schools as { name: string })?.name || 'Unknown School' } })
  } catch (err) { console.error('Login error:', err); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }) }
}


