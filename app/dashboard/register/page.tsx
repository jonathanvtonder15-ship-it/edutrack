'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ClipboardCheck, ArrowLeftRight } from 'lucide-react'
import AttendancePage from '../attendance/page'
import BattingPage from '../batting/page'

function RegisterInner() {
  const params = useSearchParams()
  const [view, setView] = useState<'attendance' | 'batting'>(params.get('view') === 'batting' ? 'batting' : 'attendance')

  return (
    <div className="space-y-4">
      <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-xl">
        <button
          onClick={() => setView('attendance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === 'attendance' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <ClipboardCheck className="w-4 h-4" /> Attendance
        </button>
        <button
          onClick={() => setView('batting')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === 'batting' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <ArrowLeftRight className="w-4 h-4" /> Batting
        </button>
      </div>

      {view === 'attendance' ? <AttendancePage /> : <BattingPage />}
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterInner />
    </Suspense>
  )
}

