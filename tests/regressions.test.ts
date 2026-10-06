import test from 'node:test'
import assert from 'node:assert/strict'
import { signSession, verifySession } from '../lib/session-token'
import { saveAttendance, type AttendanceRecord } from '../lib/attendance'
import type { SupabaseClient } from '@supabase/supabase-js'

const secret = 'synthetic-session-signing-secret-for-tests'
test('sessions reject tampering, expiry, invalid shape and wrong keys', () => {
  const token = signSession({ userId: 'admin-1', expiresAt: 2000 }, secret)
  assert.deepEqual(verifySession(token, secret, 1000), { userId: 'admin-1', expiresAt: 2000 })
  assert.equal(verifySession(token, secret, 2000), null)
  assert.equal(verifySession(token, 'another-key', 1000), null)
  assert.equal(verifySession(token + '.extra', secret, 1000), null)
  assert.equal(verifySession('invalid', secret, 1000), null)
  assert.equal(verifySession(signSession({ userId: '', expiresAt: 2000 }, secret), secret, 1000), null)
  const altered = Buffer.from(JSON.stringify({ userId: 'admin-2', expiresAt: 2000 })).toString('base64url')
  assert.equal(verifySession(altered + '.' + token.split('.')[1], secret, 1000), null)
})

test('attendance writes atomically, surfaces failures and never deletes the previous register', async () => {
  const calls: unknown[] = []
  let error: { message: string } | null = { message: 'Write denied' }
  const client = { from(table: string) {
    assert.equal(table, 'attendance')
    return { async upsert(rows: unknown, options: unknown) { calls.push({ rows, options }); return { error } } }
  } } as unknown as SupabaseClient
  const rows: AttendanceRecord[] = [{ student_id: 'student-1', class_id: 'class-1', date: '2026-10-05', period: 1, status: 'present', marked_by: 'teacher-1', school_id: 'school-1' }]
  await assert.rejects(saveAttendance(client, rows), /Write denied/)
  error = null
  await saveAttendance(client, rows)
  await saveAttendance(client, [])
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0], { rows, options: { onConflict: 'student_id,class_id,date,period' } })
})

test('offline attendance counts only the current school and marker without discarding other batches', async () => {
  const { canSyncAttendance } = await import('../lib/attendance')
  const record: AttendanceRecord = { student_id:'learner',class_id:'class',date:'2026-10-05',period:1,status:'present',marked_by:'teacher',school_id:'school' }
  const queue = [
    {records:[record]},
    {records:[{...record,marked_by:'other-teacher'}]},
    {records:[{...record,school_id:'other-school'}]},
    {records:[record,{...record,marked_by:'other-teacher'}]},
    {records:[]},
  ]
  const snapshot = structuredClone(queue)
  assert.equal(queue.filter(batch => canSyncAttendance(batch,{id:'teacher',school_id:'school'})).length,1)
  assert.equal(queue.filter(batch => canSyncAttendance(batch,{id:'other-teacher',school_id:'school'})).length,1)
  assert.deepEqual(queue,snapshot)
})
