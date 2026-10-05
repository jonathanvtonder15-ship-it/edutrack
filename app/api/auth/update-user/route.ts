import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import bcrypt from 'bcryptjs'

const VALID_ROLES = ['admin', 'teacher', 'smt', 'admin-teacher', 'monitor-guardian']

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req, true)
    if (session.response) return session.response
    const { user: actor, supabase } = session
    const { user_id, username, password, display_name, role, roles } = await req.json().catch(() => null) || {}
    if (typeof user_id !== 'string' || !user_id || typeof display_name !== 'string' || !display_name.trim() || (username !== undefined && typeof username !== 'string') || (password !== undefined && typeof password !== 'string')) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    if (roles && (!Array.isArray(roles) || roles.some((r: string) => !VALID_ROLES.includes(r)))) return NextResponse.json({ error: 'Invalid roles' }, { status: 400 })
    if (role && !VALID_ROLES.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

    if (actor.id === user_id && (role || (Array.isArray(roles) && roles.length))) return NextResponse.json({ error: 'You cannot change your own roles' }, { status: 400 })
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

    const { data: user, error } = await supabase.from('users').update(updates).eq('id', user_id).eq('school_id', actor.school_id).select().single()
    if (error?.code === 'PGRST116') return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role, roles: user.roles } })
  } catch (err) {
    console.error('Update user error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

