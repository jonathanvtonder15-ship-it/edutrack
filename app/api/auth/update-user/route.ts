import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/session'
import { nameSchema, passwordSchema, roleSchema, usernameSchema } from '@/lib/auth-input'

const schema = z.object({ user_id: z.uuid(), display_name: nameSchema, username: usernameSchema.optional(), password: z.union([passwordSchema,z.literal('')]).optional(), role: roleSchema.optional(), roles: z.array(roleSchema).min(1).optional() })
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req, true)
    if (session.response) return session.response
    const { user: actor, supabase } = session
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid account details (passwords need at least 8 characters)' }, { status: 400 })
    const { user_id, password, ...updates } = parsed.data
    if (actor.id === user_id && (updates.role || updates.roles || password)) return NextResponse.json({ error: 'Use My Account to change your own password. You cannot change your own roles.' }, { status: 400 })
    const { data: existing } = await supabase.from('users').select('*').eq('id', user_id).eq('school_id', actor.school_id).eq('active', true).single()
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const role = updates.role || existing.role
    const roles = [...new Set([...(updates.roles || (updates.role ? [updates.role] : existing.roles)), role])]
    const { data: user, error } = await supabase.from('users').update({ ...updates, role, roles }).eq('id', user_id).select().single()
    if (error) return NextResponse.json({ error: error.code === '23505' ? 'Username already in use' : 'Could not update staff profile' }, { status: error.code === '23505' ? 409 : 500 })
    if (password) {
      const { error: passwordError } = await supabase.auth.admin.updateUserById(user_id, { password })
      if (passwordError) return NextResponse.json({ error: 'Profile saved, but password reset failed. Please retry the password reset.' }, { status: 502 })
    }
    return NextResponse.json({ user })
  } catch { return NextResponse.json({ error: 'Could not update account' }, { status: 500 }) }
}
