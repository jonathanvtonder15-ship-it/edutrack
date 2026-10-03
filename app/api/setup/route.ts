import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mkfixnivoyqghvmrsloj.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZml4bml2b3lxZ2h2bXJzbG9qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU2MjExNywiZXhwIjoyMDkyMTM4MTE3fQ.wZVOtCUdzqDxCWSOhAELjuZDQD1PdPRRREFtjAjQ5QE'

export async function POST(req: NextRequest) {
  try {
    const { school_name, admin_username, admin_password, admin_display_name, timetable_type, periods_per_day } = await req.json()
    if (!school_name || !admin_username || !admin_password || !admin_display_name) return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: school, error: schoolError } = await supabase.from('schools').insert({ name: school_name, timetable_type: timetable_type || '5-day', periods_per_day: periods_per_day || 8 }).select().single()
    if (schoolError) return NextResponse.json({ error: schoolError.message }, { status: 500 })
    const password_hash = await bcrypt.hash(admin_password, 10)
    const { data: admin, error: adminError } = await supabase.from('users').insert({ username: admin_username.toLowerCase().trim(), password_hash, display_name: admin_display_name, role: 'admin', school_id: school.id }).select().single()
    if (adminError) { await supabase.from('schools').delete().eq('id', school.id); return NextResponse.json({ error: adminError.message }, { status: 500 }) }
    return NextResponse.json({ success: true, school: { id: school.id, name: school.name }, admin: { id: admin.id, username: admin.username, display_name: admin.display_name } })
  } catch (err) { console.error('Setup error:', err); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }) }
}

