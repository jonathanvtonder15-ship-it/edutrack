import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'unconfigured'

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey)

export interface School { id: string; name: string; timetable_type: '5-day' | '10-day'; periods_per_day: number; created_at: string; logo_url?: string }
export interface User { id: string; username: string; password_hash: string; display_name: string; role: 'admin' | 'teacher' | 'smt' | 'admin-teacher'; school_id: string; created_at: string }
export interface Student { id: string; student_number: string | null; name: string; surname: string; grade: number | null; photo_url: string | null; school_id: string; created_at: string }
export interface Class { id: string; name: string; grade: number; school_id: string; created_at: string }
export interface Subject { id: string; name: string; grade: number; is_caps: boolean; school_id: string; created_at: string }
export interface Allocation { id: string; user_id: string; class_id: string; subject_id: string | null; created_at: string }
export interface Attendance { id: string; student_id: string; class_id: string; date: string; period: number; status: 'present' | 'absent' | 'late'; marked_by: string; school_id: string; created_at: string }
export interface DemeritType { id: string; name: string; points: number; school_id: string; created_at: string }
export interface Demerit { id: string; student_id: string; demerit_type_id: string; given_by: string; date: string; notes: string | null; school_id: string; created_at: string }
export interface Notification { id: string; user_id: string; type: string; title: string; message: string; data_json: Record<string, unknown> | null; read: boolean; school_id: string; created_at: string }

