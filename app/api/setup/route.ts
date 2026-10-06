import { timingSafeEqual, randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServiceSupabase } from '@/lib/supabase-server'
import { authEmail, getAuthenticatedSupabase } from '@/lib/supabase-auth'
import { nameSchema, passwordSchema, usernameSchema } from '@/lib/auth-input'
import { setSession, sessionSecret, checkRequestOrigin } from '@/lib/session'

const setupSchema = z.object({
  setup_code: z.string(), school_name: nameSchema, admin_username: usernameSchema,
  admin_password: passwordSchema, admin_display_name: nameSchema,
  timetable_type: z.enum(['5-day', '10-day']).default('5-day'),
  periods_per_day: z.number().int().min(1).max(15).default(8),
})

export async function POST(req: NextRequest) {
  const originError = checkRequestOrigin(req)
  if (originError) return originError
  try {
    const setupToken = process.env.SCHOOL_SETUP_TOKEN
    if (!setupToken || setupToken.length < 32) return NextResponse.json({ error: 'School setup is disabled. Contact your site administrator.' }, { status: 503 })
    const parsed = setupSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Provide all fields, a valid username and a password of at least 8 characters.' }, { status: 400 })
    const body = parsed.data
    const supplied = Buffer.from(body.setup_code)
    const expected = Buffer.from(setupToken)
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return NextResponse.json({ error: 'Invalid setup code' }, { status: 403 })
    sessionSecret()
    const supabase = getServiceSupabase()
    const id = randomUUID()
    const { error: authError } = await supabase.auth.admin.createUser({ id, email: authEmail(id), password: body.admin_password, email_confirm: true })
    if (authError) return NextResponse.json({ error: 'Could not create administrator account' }, { status: 500 })
    const { data, error } = await supabase.rpc('bootstrap_school', {
      admin_id: id, school_name: body.school_name, admin_username: body.admin_username,
      admin_display_name: body.admin_display_name, timetable: body.timetable_type, periods: body.periods_per_day,
    })
    if (error) {
      await supabase.auth.admin.deleteUser(id)
      return NextResponse.json({ error: error.code === '23505' ? 'Username already exists' : 'Could not create school. Check the database setup.' }, { status: error.code === '23505' ? 409 : 500 })
    }
    const auth = await getAuthenticatedSupabase()
    const { error: loginError } = await auth.auth.signInWithPassword({ email: authEmail(id), password: body.admin_password })
    if (loginError) return NextResponse.json({ error: 'School created. Please sign in with your new account.' }, { status: 503 })
    return setSession(NextResponse.json({ success: true, ...data }), id)
  } catch {
    return NextResponse.json({ error: 'Could not set up school' }, { status: 500 })
  }
}
