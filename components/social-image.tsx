import { ImageResponse } from 'next/og'

export function createSocialImage(size: { width: number; height: number }) {
  return new ImageResponse(
    <div style={{ background: '#0f172a', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', gap: 24 }}>
      <svg width="140" height="140" viewBox="0 0 64 64">
        <rect width="64" height="64" rx="14" fill="#2563eb" />
        <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="m10 26 22-10 22 10-22 10-22-10Z" />
          <path d="M18 30v13c8 7 20 7 28 0V30M54 26v17" />
        </g>
      </svg>
      <div style={{ fontSize: 72, fontWeight: 700 }}>EduTrack</div>
      <div style={{ fontSize: 30, color: '#cbd5e1' }}>School Attendance &amp; Management System</div>
    </div>,
    size,
  )
}
