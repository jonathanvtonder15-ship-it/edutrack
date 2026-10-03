'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, Award } from 'lucide-react'
import DemeritsPage from '../demerits/page'
import MeritsPage from '../merits/page'

function ConductInner() {
  const params = useSearchParams()
  const [view, setView] = useState<'demerits' | 'merits'>(params.get('view') === 'merits' ? 'merits' : 'demerits')

  return (
    <div className="space-y-4">
      <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-xl">
        <button
          onClick={() => setView('demerits')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === 'demerits' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <AlertTriangle className="w-4 h-4" /> Demerits
        </button>
        <button
          onClick={() => setView('merits')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === 'merits' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Award className="w-4 h-4" /> Merits
        </button>
      </div>

      {view === 'demerits' ? <DemeritsPage /> : <MeritsPage />}
    </div>
  )
}

export default function ConductPage() {
  return (
    <Suspense fallback={null}>
      <ConductInner />
    </Suspense>
  )
}

