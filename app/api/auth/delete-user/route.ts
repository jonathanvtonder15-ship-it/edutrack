import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mkfixnivoyqghvmrsloj.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZml4bml2b3lxZ2h2bXJzbG9qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU2MjExNywiZXhwIjoyMDkyMTM4MTE3fQ.wZVOtCUdzqDxCWSOhAELjuZDQD1PdPRRREFtjAjQ5QE'

export async function POST(req: NextRequest) {
  try {
    const { user_id, requesting_user_role, requesting_user_id } = await req.json()
    if (requesting_user_role !== 'admin' && requesting_user_role !== 'admin-teacher') return NextResponse.json({ error: 'Only admins can delete users' }, { status: 403 })
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    if (requesting_user_id && requesting_user_id === user_id) return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { error } = await supabase.from('users').delete().eq('id', user_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete user error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

