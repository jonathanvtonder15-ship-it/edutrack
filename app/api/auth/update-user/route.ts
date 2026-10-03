import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mkfixnivoyqghvmrsloj.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZml4bml2b3lxZ2h2bXJzbG9qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU2MjExNywiZXhwIjoyMDkyMTM4MTE3fQ.wZVOtCUdzqDxCWSOhAELjuZDQD1PdPRRREFtjAjQ5QE'

const VALID_ROLES = ['admin', 'teacher', 'smt', 'admin-teacher', 'monitor-guardian']

export async function POST(req: NextRequest) {
  try {
    const { user_id, username, password, display_name, role, roles, requesting_user_role } = await req.json()
    if (requesting_user_role !== 'admin' && requesting_user_role !== 'admin-teacher') return NextResponse.json({ error: 'Only admins can edit users' }, { status: 403 })
    if (!user_id || !display_name) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    if (roles && (!Array.isArray(roles) || roles.some((r: string) => !VALID_ROLES.includes(r)))) return NextResponse.json({ error: 'Invalid roles' }, { status: 400 })
    if (role && !VALID_ROLES.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const updates: Record<string, unknown> = { display_name }
    if (role) updates.role = role
    if (Array.isArray(roles) && roles.length > 0) updates.roles = roles

    if (username && username.trim()) {
      const clean = username.toLowerCase().trim()
      const { data: existing } = await supabase.from('users').select('id').eq('username', clean).neq('id', user_id).single()
      if (existing) return NextResponse.json({ error: 'Username already in use' }, { status: 409 })
      updates.username = clean
    }

    if (password && password.trim()) {
      updates.password_hash = await bcrypt.hash(password, 10)
    }

    const { data: user, error } = await supabase.from('users').update(updates).eq('id', user_id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role, roles: user.roles } })
  } catch (err) {
    console.error('Update user error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

