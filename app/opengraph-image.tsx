import { createSocialImage } from '@/components/social-image'

export const alt = 'EduTrack — School Attendance & Management System'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return createSocialImage(size)
}
