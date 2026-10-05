import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await requireSession(req)
  if (session.response) return session.response
  const { schools, ...profile } = session.user
  return NextResponse.json({ user: { ...profile, school_name: (schools as unknown as { name: string })?.name || '' } }, { headers: { 'Cache-Control': 'private, no-store' } })
}
