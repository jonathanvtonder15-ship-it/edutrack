import type { SupabaseClient } from '@supabase/supabase-js'

export interface AttendanceRecord {
  student_id: string
  class_id: string
  date: string
  period: number
  status: string
  marked_by: string
  school_id: string
  note?: string | null
}

// One atomic database statement preserves the previous register on write failure.
// The full Supabase migration includes the required unique constraint.
export async function saveAttendance(client: SupabaseClient, records: AttendanceRecord[]) {
  if (!records.length) return
  const { error } = await client.from('attendance').upsert(records, {
    onConflict: 'student_id,class_id,date,period',
  })
  if (error) throw new Error(error.message)
}

export interface OfflineAttendanceBatch { records: AttendanceRecord[] }

export function canSyncAttendance(batch: OfflineAttendanceBatch, user: { school_id: string; id: string }) {
  return batch.records.length > 0 && batch.records.every(record => record.school_id === user.school_id && record.marked_by === user.id)
}

// A concurrent teacher's mark always wins over a generated absence.
export async function insertGeneratedAbsences(client: SupabaseClient, records: AttendanceRecord[]) {
  if (!records.length) return
  const { error } = await client.from('attendance').upsert(records, {
    onConflict: 'student_id,class_id,date,period', ignoreDuplicates: true,
  })
  if (error) throw new Error(error.message)
}
