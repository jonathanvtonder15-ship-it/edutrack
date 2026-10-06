import { createClient, SupabaseClient } from '@supabase/supabase-js'

// The browser never receives Supabase tokens or a service-role credential.
// Keep the query builder, but send data requests through the session-aware gateway.
export const supabase: SupabaseClient = createClient('http://edutrack.invalid', 'gateway', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const response = await fetch(`/api/data${url.pathname}${url.search}`, { ...init, credentials: 'same-origin' })
    if (response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('edutrack-session-expired'))
    return response
  } },
})

export const studentPhotoUrl = (path: string) => `/api/data/storage/v1/object/student-photos/${path}`

export interface School { id: string; name: string; timetable_type: '5-day' | '10-day'; periods_per_day: number; created_at: string; logo_url?: string }
export interface User { id: string; username: string; display_name: string; role: 'admin' | 'teacher' | 'smt' | 'admin-teacher' | 'monitor-guardian'; school_id: string; created_at: string }
export interface Student { id: string; student_number: string | null; name: string; surname: string; grade: number | null; photo_url: string | null; school_id: string; created_at: string }
export interface Class { id: string; name: string; grade: number; school_id: string; created_at: string }
export interface Subject { id: string; name: string; grade: number; is_caps: boolean; school_id: string; created_at: string }
export interface Allocation { id: string; user_id: string; class_id: string; subject_id: string | null; created_at: string }
export interface Attendance { id: string; student_id: string; class_id: string; date: string; period: number; status: 'present' | 'absent' | 'late'; marked_by: string; school_id: string; created_at: string }
export interface DemeritType { id: string; name: string; points: number; school_id: string; created_at: string }
export interface Demerit { id: string; student_id: string; demerit_type_id: string; given_by: string; date: string; notes: string | null; school_id: string; created_at: string }
export interface Notification { id: string; user_id: string; type: string; title: string; message: string; data_json: Record<string, unknown> | null; read: boolean; school_id: string; created_at: string }

