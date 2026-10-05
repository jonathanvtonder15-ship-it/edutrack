import { supabase, studentPhotoUrl } from './supabase'

export async function saveStudentPhoto(schoolId: string, studentId: string, file: File) {
  const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
  const extension = extensions[file.type]
  if (!extension || file.size > 5 * 1024 * 1024) throw new Error('Choose a JPEG, PNG, WebP or GIF photo smaller than 5 MiB.')
  const path = `${schoolId}/${studentId}.${extension}`
  const { error } = await supabase.storage.from('student-photos').upload(path, file, { upsert: true })
  if (error) throw new Error('Photo upload failed. Please try again.')
  const url = studentPhotoUrl(path) + '?t=' + Date.now()
  const result = await supabase.from('students').update({ photo_url: url }).eq('id', studentId).select('id').single()
  if (result.error) throw new Error('Could not save the photo to this student. Please try again.')
  return url
}
