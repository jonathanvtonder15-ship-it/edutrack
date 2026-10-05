import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase-server'
import { setSession, sessionSecret } from '@/lib/session'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { school_name, admin_username, admin_password, admin_display_name, timetable_type, periods_per_day } = await req.json().catch(() => null) || {}
    if (![school_name, admin_username, admin_password, admin_display_name].every(v => typeof v === 'string' && v.trim())) return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    if ((timetable_type && !['5-day', '10-day'].includes(timetable_type)) || (periods_per_day !== undefined && (!Number.isInteger(periods_per_day) || periods_per_day < 1 || periods_per_day > 15))) return NextResponse.json({ error: 'Invalid timetable settings' }, { status: 400 })
    sessionSecret()
    const supabase = getServiceSupabase()
    const { data: school, error: schoolError } = await supabase.from('schools').insert({ name: school_name, timetable_type: timetable_type || '5-day', periods_per_day: periods_per_day || 8 }).select().single()
    if (schoolError) return NextResponse.json({ error: schoolError.message }, { status: 500 })
    const password_hash = await bcrypt.hash(admin_password, 10)
    const { data: admin, error: adminError } = await supabase.from('users').insert({ username: admin_username.toLowerCase().trim(), password_hash, display_name: admin_display_name, role: 'admin', school_id: school.id }).select().single()
    if (adminError) { await supabase.from('schools').delete().eq('id', school.id); return NextResponse.json({ error: adminError.message }, { status: 500 }) }
    return setSession(NextResponse.json({ success: true, school: { id: school.id, name: school.name }, admin: { id: admin.id, username: admin.username, display_name: admin.display_name } }), admin.id)
  } catch (err) { console.error('Setup error:', err); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }) }
}

