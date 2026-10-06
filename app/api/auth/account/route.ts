import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/session'
import { authEmail } from '@/lib/supabase-auth'
import { nameSchema, passwordSchema } from '@/lib/auth-input'

const schema = z.object({ display_name: nameSchema.optional(), password: passwordSchema.optional(), current_password: z.string().optional() })
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req)
    if (session.response) return session.response
    const { user, supabase, authenticatedSupabase } = session
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid account details (passwords need at least 8 characters)' }, { status: 400 })
    const body = parsed.data
    if (!body.display_name && !body.password) return NextResponse.json({ error: 'No changes supplied' }, { status: 400 })
    if (body.password) {
      if (!body.current_password) return NextResponse.json({ error: 'Provide your current password' }, { status: 400 })
      const { error: verifyError } = await authenticatedSupabase.auth.signInWithPassword({ email: authEmail(user.id), password: body.current_password })
      if (verifyError) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 })
      const { error } = await authenticatedSupabase.auth.updateUser({ password: body.password })
      if (error) return NextResponse.json({ error: 'Could not update password' }, { status: 500 })
    }
    if (body.display_name) {
      const { error } = await supabase.from('users').update({ display_name: body.display_name }).eq('id', user.id).eq('school_id', user.school_id)
      if (error) return NextResponse.json({ error: 'Could not update name' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Could not update account' }, { status: 500 }) }
}
