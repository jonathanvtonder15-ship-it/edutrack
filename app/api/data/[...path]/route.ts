import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { DATA_TABLES } from '@/lib/data-tables'

const MAX_BODY = 6 * 1024 * 1024
async function gateway(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const session = await requireSession(req)
    if (session.response) return session.response
    const { path } = await context.params
    const isTable = path.length === 3 && path[0] === 'rest' && path[1] === 'v1' && DATA_TABLES.has(path[2])
    const isPhoto = path[0] === 'storage' && path[1] === 'v1' && path[2] === 'object'
      && path[3] === 'student-photos' && path.length === 6
      && /^[0-9a-f-]{36}$/.test(path[4]) && /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif)$/.test(path[5])
    if (!isTable && !isPhoto) return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
    if (isPhoto && !['GET','HEAD','POST','PUT'].includes(req.method)) return new NextResponse(null, { status: 405 })
    // getUser() in requireSession verifies the identity before this token is used.
    const { data } = await session.authenticatedSupabase.auth.getSession()
    if (!data.session) return NextResponse.json({ error: 'Please sign in again' }, { status: 401 })
    const headers = new Headers({ apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${data.session.access_token}` })
    for (const name of ['content-type','accept','prefer','range','range-unit','x-upsert','cache-control']) {
      const value = req.headers.get(name)
      if (value) headers.set(name, value)
    }
    let body: Uint8Array | undefined
    if (!['GET','HEAD'].includes(req.method)) {
      if (Number(req.headers.get('content-length')) > MAX_BODY) return new NextResponse(null, { status: 413 })
      const reader = req.body?.getReader()
      const chunks: Uint8Array[] = []
      let size = 0
      if (reader) {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          size += value.length
          if (size > MAX_BODY) { await reader.cancel(); return new NextResponse(null, { status: 413 }) }
          chunks.push(value)
        }
      }
      body = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length }
    }
    const targetPath = isPhoto && ['GET','HEAD'].includes(req.method)
      ? ['storage','v1','object','authenticated',...path.slice(3)] : path
    const url = new URL(targetPath.join('/'), process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '') + '/')
    url.search = req.nextUrl.search
    const upstream = await fetch(url, { method: req.method, headers, body: body as BodyInit | undefined, cache: 'no-store', redirect: 'error' })
    const responseHeaders = new Headers({ 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' })
    for (const name of ['content-type','content-range','preference-applied']) {
      const value = upstream.headers.get(name)
      if (value) responseHeaders.set(name, value)
    }
    return new NextResponse(req.method === 'HEAD' || upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: responseHeaders })
  } catch {
    return NextResponse.json({ error: 'Data service unavailable. Please try again.' }, { status: 502 })
  }
}
export const GET = gateway
export const HEAD = gateway
export const POST = gateway
export const PATCH = gateway
export const PUT = gateway
export const DELETE = gateway
