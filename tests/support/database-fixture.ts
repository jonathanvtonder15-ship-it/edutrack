// Deliberately limited HTTP fixture for application regression tests, not a Supabase emulator.
// It cannot validate database constraints, RLS, storage or provider compatibility.
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'

type Row = Record<string, unknown>
export async function startDatabaseFixture(port = 0) {
  const password_hash = await bcrypt.hash('fixture-password', 4)
  const tables: Record<string, Row[]> = {
    schools: [{ id: 'school-1', name: 'Test School', periods_per_day: 8, timetable_type: '5-day' }],
    users: [
      { id: 'admin-1', username: 'fixture-admin', display_name: 'Test Admin', role: 'admin', roles: ['admin'], school_id: 'school-1', password_hash },
      { id: 'teacher-1', username: 'fixture-teacher', display_name: 'Test Teacher', role: 'teacher', roles: ['teacher'], school_id: 'school-1', password_hash },
      { id: 'other-1', username: 'fixture-other', display_name: 'Other Admin', role: 'admin', roles: ['admin'], school_id: 'school-2', password_hash },
    ],
    students: [{ id: 'student-1', name: 'Test', surname: 'Learner', grade: 8, student_number: '001', school_id: 'school-1', register_class: '8A', photo_url: null }],
    classes: [{ id: 'class-1', name: '8A', grade: 8, school_id: 'school-1' }],
    subjects: [],
  }
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,HEAD,OPTIONS')
    res.setHeader('Content-Type', 'application/json')
    if (req.method === 'OPTIONS') { res.end(); return }
    const url = new URL(req.url!, 'http://localhost')
    const table = url.pathname.split('/')[3]
    if (!url.pathname.startsWith('/rest/v1/')) { res.writeHead(404); res.end('{}'); return }
    const matches = (row: Row) => [...url.searchParams].every(([key, value]) => {
      if (value.startsWith('eq.')) return String(row[key]) === value.slice(3)
      if (value.startsWith('neq.')) return String(row[key]) !== value.slice(4)
      return true
    })
    let rows = (tables[table] ||= []).filter(matches)
    if (req.method === 'POST' || req.method === 'PATCH') {
      let raw = ''; for await (const chunk of req) raw += chunk
      const body = JSON.parse(raw || '{}')
      if (req.method === 'POST') {
        rows = (Array.isArray(body) ? body : [body]).map(row => ({ id: randomUUID(), ...row }))
        tables[table].push(...rows)
      } else { rows.forEach(row => Object.assign(row, body)) }
    } else if (req.method === 'DELETE') { tables[table] = tables[table].filter(row => !matches(row)) }
    if (table === 'users' && url.searchParams.get('select')?.includes('schools(')) rows = rows.map(row => ({ ...row, schools: tables.schools.find(school => school.id === row.school_id) }))
    const single = req.headers.accept?.includes('application/vnd.pgrst.object+json')
    if (single && rows.length !== 1) { res.writeHead(406); res.end(JSON.stringify({ code: 'PGRST116', message: 'Expected one row' })); return }
    res.setHeader('Content-Range', `0-${Math.max(0, rows.length - 1)}/${rows.length}`)
    res.end(JSON.stringify(single ? rows[0] : rows))
  })
  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  return { server, tables, url: `http://127.0.0.1:${address.port}` }
}
