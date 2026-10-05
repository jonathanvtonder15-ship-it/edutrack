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
