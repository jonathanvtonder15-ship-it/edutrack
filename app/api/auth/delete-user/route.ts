import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req, true)
    if (session.response) return session.response
    const { user: actor, supabase } = session
    const parsed = z.object({ user_id: z.uuid() }).safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    const { user_id } = parsed.data
    if (actor.id === user_id) return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 })
    // Every policy and API request checks active. Historical attribution remains intact.
    const { data, error } = await supabase.from('users').update({ active: false }).eq('id', user_id).eq('school_id', actor.school_id).eq('active', true).select('id')
    if (error) return NextResponse.json({ error: 'Could not deactivate account' }, { status: 500 })
    if (!data?.length) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const { error: banError } = await supabase.auth.admin.updateUserById(user_id, { ban_duration: '876000h' })
    if (banError) console.error('Auth ban failed for deactivated profile; database access remains denied')
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Could not deactivate account' }, { status: 500 }) }
}
