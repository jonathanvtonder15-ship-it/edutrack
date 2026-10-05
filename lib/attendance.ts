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
// Requires database/attendance-unique.sql to have been applied.
export async function saveAttendance(client: SupabaseClient, records: AttendanceRecord[]) {
  if (!records.length) return
  const { error } = await client.from('attendance').upsert(records, {
    onConflict: 'student_id,class_id,date,period',
  })
  if (error) throw new Error(error.message)
}
