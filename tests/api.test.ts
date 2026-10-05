import test from 'node:test'
import assert from 'node:assert/strict'

const base = process.env.EDUTRACK_TEST_URL
if (base && !['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('API regression tests require a local synthetic fixture')

test('API authentication, school boundaries, validation, account changes and document parsing', { skip: !base }, async () => {
  const testIp = `192.0.2.${Math.floor(Math.random() * 250) + 1}`
  async function post(path: string, body: unknown, cookie?: string) {
    return fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': testIp, Origin: base!, ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) })
  }
  for (const path of ['create-user', 'update-user', 'delete-user', 'account']) {
    assert.equal((await post('/api/auth/' + path, { requesting_user_role: 'admin', user_id: 'teacher-1' })).status, 401)
  }
  assert.equal((await post('/api/auth/login', { username: 123, password: [] })).status, 400)
  assert.equal((await post('/api/auth/login', { username: 'fixture-admin', password: 'wrong-password' })).status, 401)
  const login = await post('/api/auth/login', { username: 'fixture-admin', password: 'fixture-password', keepSignedIn: true })
  assert.equal(login.status, 200)
  const cookieHeader = login.headers.get('set-cookie')!
  assert.match(cookieHeader, /HttpOnly/i)
  assert.match(cookieHeader, /Max-Age=31536000/i)
  const cookie = cookieHeader.split(';')[0]
  assert.equal((await login.json()).user.password_hash, undefined)
  const crossOrigin = await fetch(base + '/api/auth/account', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie, Origin: 'https://untrusted.example' }, body: JSON.stringify({ display_name: 'Rejected' }) })
  assert.equal(crossOrigin.status, 403)
  assert.equal((await post('/api/auth/create-user', { username: 'cross-school', password: 'password', display_name: 'Cross School', role: 'teacher', school_id: 'school-2' }, cookie)).status, 403)
  assert.equal((await post('/api/auth/delete-user', { user_id: 'admin-1' }, cookie)).status, 400)
  assert.equal((await post('/api/auth/update-user', { user_id: 'admin-1', display_name: 'Admin', role: 'teacher' }, cookie)).status, 400)
  assert.equal((await post('/api/auth/account', { current_password: 'incorrect', password: 'new-password' }, cookie)).status, 403)
  assert.equal((await post('/api/auth/account', { display_name: 'Updated Test Admin' }, cookie)).status, 200)
  assert.equal((await post('/api/auth/update-user', { user_id: 'other-1', display_name: 'Forbidden Update' }, cookie)).status, 404)
  assert.equal((await post('/api/auth/delete-user', { user_id: 'other-1' }, cookie)).status, 404)
  const teacherLogin = await post('/api/auth/login', { username: 'fixture-teacher', password: 'fixture-password' })
  assert.equal(teacherLogin.status, 200)
  const teacherCookie = teacherLogin.headers.get('set-cookie')!.split(';')[0]
  assert.equal((await post('/api/auth/delete-user', { user_id: 'admin-1', requesting_user_role: 'admin' }, teacherCookie)).status, 403)
  const create = await post('/api/auth/create-user', { username: 'new-' + Date.now(), password: 'fixture-password', display_name: 'New Staff', role: 'teacher', roles: ['teacher'], school_id: 'school-1' }, cookie)
  assert.equal(create.status, 200)
  const created = (await create.json()).user
  assert.equal(created.password_hash, undefined)
  assert.equal((await post('/api/auth/update-user', { user_id: created.id, display_name: 'Edited Staff' }, cookie)).status, 200)
  assert.equal((await post('/api/auth/delete-user', { user_id: created.id }, cookie)).status, 200)
  assert.equal((await post('/api/setup', { school_name: 123 })).status, 400)
  assert.equal((await post('/api/timetable/parse', {})).status, 401)
  assert.equal((await post('/api/timetable/parse', { text: 'x' }, cookie)).status, 422)
  assert.equal((await post('/api/timetable/parse', { text: 'Monday period one Grade 8 Mathematics' }, cookie)).status, 503)
  const invalid = new FormData(); invalid.set('file', 'not a file')
  assert.equal((await fetch(base + '/api/parse-doc', { method: 'POST', body: invalid })).status, 400)
  const form = new FormData(); form.set('file', new File(['Name\tMiddle\tSurname\nTest\t\tLearner'], 'students.tsv'))
  const parsed = await fetch(base + '/api/parse-doc', { method: 'POST', body: form })
  assert.equal(parsed.status, 200)
  assert.deepEqual((await parsed.json()).rows, [['Test', '', 'Learner']])
  const logout = await post('/api/auth/logout', {}, cookie)
  assert.match(logout.headers.get('set-cookie')!, /Max-Age=0/i)
})
