import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mkfixnivoyqghvmrsloj.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZml4bml2b3lxZ2h2bXJzbG9qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU2MjExNywiZXhwIjoyMDkyMTM4MTE3fQ.wZVOtCUdzqDxCWSOhAELjuZDQD1PdPRRREFtjAjQ5QE'

export async function POST(req: NextRequest) {
  try {
    const { username, password, display_name, role, roles, school_id, requesting_user_role } = await req.json()
    if (requesting_user_role !== 'admin' && requesting_user_role !== 'admin-teacher') return NextResponse.json({ error: 'Only admins can create users' }, { status: 403 })
    if (!username || !password || !display_name || !role || !school_id) return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    if (!['admin', 'teacher', 'smt', 'admin-teacher', 'monitor-guardian'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    const userRoles = Array.isArray(roles) && roles.length > 0 ? roles : [role]
    if (!userRoles.includes(role)) userRoles.push(role)
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: existing } = await supabase.from('users').select('id').eq('username', username.toLowerCase().trim()).single()
    if (existing) return NextResponse.json({ error: 'Username already exists' }, { status: 409 })
    const password_hash = await bcrypt.hash(password, 10)
    const { data: user, error } = await supabase.from('users').insert({ username: username.toLowerCase().trim(), password_hash, display_name, role, roles: userRoles, school_id }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role, roles: user.roles } })
  } catch (err) { console.error('Create user error:', err); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }) }
}




