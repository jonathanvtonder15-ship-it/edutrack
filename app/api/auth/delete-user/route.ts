import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req, true)
    if (session.response) return session.response
    const { user: actor, supabase } = session
    const { user_id } = await req.json().catch(() => null) || {}
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    if (actor.id === user_id) return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
    const { data: deleted, error } = await supabase.from('users').delete().eq('id', user_id).eq('school_id', actor.school_id).select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!deleted?.length) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete user error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

