import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/session'
import { authEmail } from '@/lib/supabase-auth'
import { nameSchema, passwordSchema, roleSchema, usernameSchema } from '@/lib/auth-input'

const schema = z.object({ username: usernameSchema, password: passwordSchema, display_name: nameSchema, role: roleSchema, roles: z.array(roleSchema).optional(), school_id: z.uuid() })
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req, true)
    if (session.response) return session.response
    const { user: actor, supabase } = session
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Provide valid account details and a password of at least 8 characters' }, { status: 400 })
    const { password, roles = [], ...profile } = parsed.data
    if (profile.school_id !== actor.school_id) return NextResponse.json({ error: 'School access denied' }, { status: 403 })
    const id = randomUUID()
    const { error: authError } = await supabase.auth.admin.createUser({ id, email: authEmail(id), password, email_confirm: true })
    if (authError) return NextResponse.json({ error: 'Could not create sign-in account' }, { status: 500 })
    const { data: user, error } = await supabase.from('users').insert({ ...profile, id, roles: [...new Set([...roles, profile.role])] }).select().single()
    if (error) {
      await supabase.auth.admin.deleteUser(id)
      return NextResponse.json({ error: error.code === '23505' ? 'Username already exists' : 'Could not create staff profile' }, { status: error.code === '23505' ? 409 : 500 })
    }
    return NextResponse.json({ user })
  } catch { return NextResponse.json({ error: 'Could not create account' }, { status: 500 }) }
}
