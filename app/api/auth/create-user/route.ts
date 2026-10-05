import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req, true)
    if (session.response) return session.response
    const { user: actor, supabase } = session
    const { username, password, display_name, role, roles, school_id } = await req.json().catch(() => null) || {}
    if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password || typeof display_name !== 'string' || !display_name.trim() || !role || !school_id) return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    if (!['admin', 'teacher', 'smt', 'admin-teacher', 'monitor-guardian'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    if (school_id !== actor.school_id) return NextResponse.json({ error: 'School access denied' }, { status: 403 })
    if (roles && (!Array.isArray(roles) || roles.some((r: unknown) => typeof r !== 'string' || !['admin', 'teacher', 'smt', 'admin-teacher', 'monitor-guardian'].includes(r)))) return NextResponse.json({ error: 'Invalid roles' }, { status: 400 })
    const userRoles = Array.isArray(roles) && roles.length > 0 ? roles : [role]
    if (!userRoles.includes(role)) userRoles.push(role)
    const { data: existing } = await supabase.from('users').select('id').eq('username', username.toLowerCase().trim()).single()
    if (existing) return NextResponse.json({ error: 'Username already exists' }, { status: 409 })
    const password_hash = await bcrypt.hash(password, 10)
    const { data: user, error } = await supabase.from('users').insert({ username: username.toLowerCase().trim(), password_hash, display_name, role, roles: userRoles, school_id }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role, roles: user.roles } })
  } catch (err) { console.error('Create user error:', err); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }) }
}

