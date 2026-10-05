import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { DATA_TABLES } from '../lib/data-tables'

const base = process.env.EDUTRACK_TEST_URL
const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const setupCode = process.env.SCHOOL_SETUP_TOKEN
if (base) {
  for (const url of [base, dbUrl]) if (!url || !['localhost','127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Integration tests require local Supabase and a local app')
  if (!anon || !serviceKey || !setupCode) throw new Error('Local Supabase and setup configuration is required')
}

class Browser {
  cookies = new Map<string,string>()
  ip = `192.0.2.${Math.floor(Math.random()*250)+1}`
  async request(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST', origin = base!) {
    const response = await fetch(base + path, { method, headers: { Origin: origin, 'x-forwarded-for': this.ip, Cookie: [...this.cookies].map(([k,v]) => `${k}=${v}`).join('; '), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const item of response.headers.getSetCookie()) {
      const [pair] = item.split(';'); const index = pair.indexOf('=')
      this.cookies.set(pair.slice(0,index), pair.slice(index+1))
    }
    return response
  }
  async json(path: string, body?: unknown, method?: string) {
    const response = await this.request(path, body, method)
    const result = await response.json()
    assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(result)}`)
    return result
  }
}

test('real Auth, RLS, school relationships, gateway, storage and account lifecycle', { skip: !base }, async () => {
  const service = createClient(dbUrl!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } })
  const anonymous = createClient(dbUrl!, anon!, { auth: { persistSession: false } })
  const admins = [new Browser(), new Browser()]
  const schools: string[] = [], authIds: string[] = []
  const stamp = Date.now().toString(36)
  const password = 'Test-only-password-42'
  const first = admins[0]
  const credentials: {id:string; username:string; school_id:string}[] = []
  const rawClients: SupabaseClient[] = []
  try {
    assert.equal((await first.request('/api/data/rest/v1/students')).status, 401)
    assert.equal((await first.request('/api/auth/create-user', { requesting_user_role: 'admin' })).status, 401)
    const setup = { setup_code: setupCode, school_name: 'Integration School', admin_username: `admin-${stamp}`, admin_password: password, admin_display_name: 'Test Admin', timetable_type: '5-day', periods_per_day: 8 }
    assert.equal((await first.request('/api/setup', { ...setup, setup_code: 'wrong' })).status, 403)
    for (const [i,browser] of admins.entries()) {
      const body = await browser.json('/api/setup', { ...setup, admin_username: `${setup.admin_username}-${i}` })
      schools.push(body.school.id); authIds.push(body.admin.id); credentials.push(body.admin)
      assert.equal(body.admin.password_hash, undefined)
      const me = await browser.json('/api/auth/me')
      assert.equal(me.user.school_id, body.school.id)
    }
    // A duplicate username must roll back both the new school and its Auth identity.
    const beforeSchools = await service.from('schools').select('id', { count:'exact',head:true })
    const beforeUsers = await service.auth.admin.listUsers({ perPage:1000 })
    assert.equal((await first.request('/api/setup', { ...setup, admin_username: `${setup.admin_username}-0` })).status, 409)
    assert.equal((await service.from('schools').select('id',{count:'exact',head:true})).count, beforeSchools.count)
    assert.equal((await service.auth.admin.listUsers({perPage:1000})).data.users.length, beforeUsers.data.users.length)

    for (const table of DATA_TABLES) {
      const { data, error } = await anonymous.from(table).select('*').limit(1)
      assert.ok(error || data?.length === 0, `anonymous could read ${table}`)
    }
    assert.ok((await anonymous.rpc('bootstrap_school', { admin_id:authIds[0],school_name:'Forbidden',admin_username:'forbidden',admin_display_name:'Forbidden',timetable:'5-day',periods:8 })).error)
    const studentIds: string[] = [], classIds: string[] = []
    for (const [i,browser] of admins.entries()) {
      const student = await service.from('students').insert({ school_id:schools[i],name:'Test',surname:'Learner' }).select().single();assert.ifError(student.error);studentIds.push(student.data.id)
      const cls = await service.from('classes').insert({ school_id:schools[i],name:'8A',grade:8 }).select().single();assert.ifError(cls.error);classIds.push(cls.data.id)
      const rows = await browser.json('/api/data/rest/v1/students?select=*')
      assert.deepEqual(rows.map((s:{id:string})=>s.id),[student.data.id])
      for (const role of i===0 ? ['teacher','monitor-guardian'] : []) {
        const created = await browser.json('/api/auth/create-user', {username:`${role}-${stamp}`,password,display_name:role,role,school_id:schools[i]})
        credentials.push(created.user);authIds.push(created.user.id)
      }
    }
    const teacherProfile = credentials[2], guardianProfile = credentials[3]
    const teacher = new Browser(), guardian = new Browser()
    for (const [browser,profile] of [[teacher,teacherProfile],[guardian,guardianProfile]] as const) {
      const login = await browser.request('/api/auth/login',{username:profile.username,password,keepSignedIn:true})
      assert.equal(login.status,200)
      assert.ok(login.headers.getSetCookie().every(c=>c.includes('HttpOnly')))
      assert.match(login.headers.getSetCookie().join(';'),/Max-Age=31536000/)
      const raw = createClient(dbUrl!,anon!,{auth:{persistSession:false,autoRefreshToken:false}})
      const signed = await raw.auth.signInWithPassword({email:`${profile.id}@users.edutrack.invalid`,password});assert.ifError(signed.error)
      rawClients.push(raw)
    }
    // Force the stored session expiry into the past to exercise refresh-cookie rotation.
    const authCookieNames = [...teacher.cookies.keys()].filter(name => name.startsWith('sb-') && name.includes('-auth-token')).sort()
    const packed = authCookieNames.map(name => teacher.cookies.get(name)).join('')
    assert.ok(packed.startsWith('base64-'))
    const storedSession = JSON.parse(Buffer.from(packed.slice(7), 'base64url').toString())
    storedSession.expires_at = 1
    const repacked = 'base64-' + Buffer.from(JSON.stringify(storedSession)).toString('base64url')
    for (const name of authCookieNames) teacher.cookies.delete(name)
    const cookieName = authCookieNames[0].replace(/\.\d+$/, '')
    for (let offset = 0, i = 0; offset < repacked.length; offset += 3000, i++) teacher.cookies.set(`${cookieName}.${i}`, repacked.slice(offset, offset + 3000))
    assert.equal((await teacher.json('/api/auth/me')).user.id, teacherProfile.id)
    const rawTeacher = rawClients[0], rawGuardian = rawClients[1]
    assert.ok((await rawTeacher.from('users').update({roles:['admin'],role:'admin'}).eq('id',teacherProfile.id)).error)
    assert.ok((await rawTeacher.from('users').select('password_hash')).error)
    assert.deepEqual((await rawTeacher.from('students').select('id').eq('school_id',schools[1])).data,[])
    assert.equal((await teacher.request('/api/auth/create-user',{requesting_user_role:'admin'})).status,403)
    assert.equal((await first.request('/api/auth/account',{display_name:'Forbidden'},'POST','https://untrusted.example')).status,403)
    assert.equal((await first.request('/api/data/rest/v1/rpc/bootstrap_school',{})).status,404)
    assert.equal((await first.request('/api/data/auth/v1/admin/users')).status,404)
    assert.equal((await first.request('/api/auth/update-user',{user_id:authIds[1],display_name:'Forbidden'})).status,404)
    assert.equal((await first.request('/api/auth/delete-user',{user_id:authIds[1]})).status,404)
    assert.equal((await first.request('/api/auth/update-user',{user_id:authIds[0],display_name:'Admin',roles:['teacher']})).status,400)

    const enrollment = await first.request('/api/data/rest/v1/class_students', {student_id:studentIds[0],class_id:classIds[0]});assert.equal(enrollment.status,201)
    const nested = await first.json('/api/data/rest/v1/class_students?select=student_id,students(name),classes(name)')
    assert.equal(nested[0].students.name,'Test')
    assert.equal((await first.request('/api/data/rest/v1/class_students',{student_id:studentIds[1],class_id:classIds[0]})).status,409)
    assert.equal((await teacher.request('/api/data/rest/v1/classes',{name:'Forbidden',grade:8,school_id:schools[0]})).status,403)
    const attendance = {student_id:studentIds[0],class_id:classIds[0],date:'2026-10-05',period:1,status:'present',marked_by:teacherProfile.id,school_id:schools[0]}
    assert.equal((await teacher.request('/api/data/rest/v1/attendance',attendance)).status,201)
    assert.equal((await teacher.request('/api/data/rest/v1/attendance',{...attendance,period:2,school_id:schools[1]})).status,409)
    assert.equal((await teacher.request('/api/data/rest/v1/attendance',{...attendance,period:2,student_id:studentIds[1]})).status,409)
    assert.equal((await teacher.request('/api/data/rest/v1/attendance',{...attendance,period:2,marked_by:authIds[0]})).status,403)
    assert.deepEqual((await rawGuardian.from('attendance').select('*')).data,[])
    assert.ok((await rawGuardian.from('attendance').insert({...attendance,period:2,marked_by:guardianProfile.id})).error)
    const upsert = await rawTeacher.from('attendance').upsert({...attendance,status:'late'}, {onConflict:'student_id,class_id,date,period'}).select()
    assert.ifError(upsert.error);assert.equal(upsert.data?.length,1);assert.equal(upsert.data?.[0].status,'late')
    const remark = await first.request('/api/data/rest/v1/attendance?student_id=eq.'+studentIds[0], { status:'present', marked_by:authIds[0] }, 'PATCH')
    assert.equal(remark.status,204)
    // A teacher cannot take over a register now marked by management.
    assert.ok((await rawTeacher.from('attendance').upsert({...attendance,status:'late'}, {onConflict:'student_id,class_id,date,period'})).error)
    const notification = {user_id:teacherProfile.id,type:'merit',title:'Good work',message:'Test',school_id:schools[0]}
    assert.equal((await teacher.request('/api/data/rest/v1/notifications',notification)).status,201)
    assert.equal((await teacher.request('/api/data/rest/v1/notifications?user_id=eq.'+teacherProfile.id,{read:true},'PATCH')).status,204)
    assert.equal((await teacher.request('/api/data/rest/v1/notifications?user_id=eq.'+teacherProfile.id,{title:'Spoof'},'PATCH')).status,403)
    assert.equal((await teacher.request('/api/data/rest/v1/notifications',{...notification,type:'announcement'})).status,403)
    assert.equal((await teacher.request('/api/data/rest/v1/notifications',{...notification,user_id:authIds[1]})).status,409)

    // Exercise every declared table and the application's named relationship hints.
    for (const table of DATA_TABLES) await first.json(`/api/data/rest/v1/${table}?select=*&limit=1`)
    for (const [table,join] of [['allocations','users!allocations_user_id_fkey(display_name),classes(name),subjects(name)'],['demerits','users!demerits_given_by_fkey(display_name),demerit_types(name),students(name)'],['merits','users!merits_given_by_fkey(display_name),merit_types(name)'],['batting','absent:users!batting_absent_teacher_id_fkey(display_name),replacement:users!batting_replacement_teacher_id_fkey(display_name)'],['leave_register','recorder:users!leave_register_recorded_by_fkey(display_name),to_teacher:users!leave_register_to_teacher_id_fkey(display_name)'],['community_service','users!community_service_recorded_by_fkey(display_name)'],['messages','users!messages_sender_id_fkey(display_name)']]) await first.json(`/api/data/rest/v1/${table}?select=${encodeURIComponent(join)}`)

    const photoPath = `${schools[0]}/${studentIds[0]}.png`
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=','base64')
    const photoRoute = '/api/data/storage/v1/object/student-photos/'+photoPath
    const upload = await fetch(base+photoRoute,{method:'POST',headers:{Origin:base!,Cookie:[...first.cookies].map(([k,v])=>`${k}=${v}`).join('; '),'Content-Type':'image/png'},body:png})
    assert.equal(upload.status,200,await upload.text())
    assert.equal((await first.request(photoRoute)).status,200)
    assert.equal((await admins[1].request(photoRoute)).status,400)
    assert.equal((await fetch(`${dbUrl}/storage/v1/object/public/student-photos/${photoPath}`)).status,400)
    assert.ok((await rawTeacher.storage.from('student-photos').upload(`${schools[0]}/${studentIds[0]}.jpg`,png,{contentType:'image/jpeg'})).error)
    assert.ifError((await service.storage.from('student-photos').remove([photoPath])).error)

    assert.equal((await teacher.request('/api/auth/account',{current_password:'incorrect',password:'New-test-password-42'})).status,403)
    await teacher.json('/api/auth/account',{display_name:'Updated Teacher'})
    assert.equal((await teacher.json('/api/auth/me')).user.display_name,'Updated Teacher')
    await first.json('/api/auth/update-user',{user_id:teacherProfile.id,display_name:'Updated Teacher',password:'New-test-password-42'})
    const relogin = new Browser()
    await relogin.json('/api/auth/login',{username:teacherProfile.username,password:'New-test-password-42'})
    await relogin.json('/api/auth/account',{current_password:'New-test-password-42',password:'Final-test-password-42'})
    await relogin.json('/api/auth/logout',{})
    assert.equal((await relogin.request('/api/auth/me')).status,401)
    await first.json('/api/auth/delete-user',{user_id:teacherProfile.id})
    assert.equal((await teacher.request('/api/auth/me')).status,401)
    assert.deepEqual((await rawTeacher.from('students').select('*')).data,[])
    assert.equal((await service.from('attendance').select('marked_by').eq('student_id',studentIds[0])).data?.length,1)
  } finally {
    for (const raw of rawClients) await raw.auth.signOut()
    // This suite only touches its own freshly created local schools.
    for (const table of [...DATA_TABLES].reverse()) {
      if (table==='users'||table==='schools') continue
      const { error } = await service.from(table).delete().in('school_id',schools)
      assert.ifError(error)
    }
    assert.ifError((await service.from('users').delete().in('school_id',schools)).error)
    assert.ifError((await service.from('schools').delete().in('id',schools)).error)
    for (const id of authIds) assert.ifError((await service.auth.admin.deleteUser(id)).error)
  }
})
