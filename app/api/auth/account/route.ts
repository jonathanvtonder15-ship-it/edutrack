import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req)
    if (session.response) return session.response
    const { user, supabase } = session
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const updates: { display_name?: string; password_hash?: string } = {}
    if (typeof body.display_name === 'string' && body.display_name.trim()) updates.display_name = body.display_name.trim()
    if (body.password !== undefined) {
      if (typeof body.password !== 'string' || body.password.length < 6 || typeof body.current_password !== 'string') return NextResponse.json({ error: 'Provide your current password and a new password of at least 6 characters' }, { status: 400 })
      const { data } = await supabase.from('users').select('password_hash').eq('id', user.id).single()
      if (!data || !(await bcrypt.compare(body.current_password, data.password_hash))) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 })
      updates.password_hash = await bcrypt.hash(body.password, 10)
    }
    if (!Object.keys(updates).length) return NextResponse.json({ error: 'No changes supplied' }, { status: 400 })
    const { error } = await supabase.from('users').update(updates).eq('id', user.id).eq('school_id', user.school_id)
    if (error) return NextResponse.json({ error: 'Could not update account' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Could not update account' }, { status: 500 })
  }
}
