'use client'

import { useLoadEffect } from '@/hooks/use-load-effect'
import { useCallback, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, TrendingUp, TrendingDown, CheckCircle2, XCircle, Clock, Activity } from 'lucide-react'

interface ClassAvg { class_id: string; class_name: string; grade: number; present: number; absent: number; late: number; sport: number; total: number; rate: number }

function fmtDate(d: string) {
  return new Date(d + 'T00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

function iso(d: Date) { return d.toISOString().split('T')[0] }

export default function AttendanceTrackingPage() {
  const user = useAppStore(s => s.user)
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<Array<{ id: string; name: string; grade: number }>>([])
  const [filterClass, setFilterClass] = useState('')
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return iso(d) })
  const [dateTo, setDateTo] = useState(() => iso(new Date()))

  const [classAvgs, setClassAvgs] = useState<ClassAvg[]>([])
  const [dailyTrend, setDailyTrend] = useState<Array<{ date: string; present: number; absent: number; late: number; sport: number; total: number; rate: number }>>([])
  const [totals, setTotals] = useState({ present: 0, absent: 0, late: 0, sport: 0, total: 0 })

  const loadClasses = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('classes').select('id,name,grade').eq('school_id', user.school_id).order('grade').order('name')
    setClasses(data || [])
  }, [user])

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    let q = supabase.from('attendance').select('date,period,status,class_id,classes(name,grade)').eq('school_id', user.school_id).gte('date', dateFrom).lte('date', dateTo)
    if (filterClass) q = q.eq('class_id', filterClass)
    const { data: att } = await q
    const recs = att || []

    // Class averages
    const cm = new Map<string, ClassAvg>()
    recs.forEach((r: Record<string, unknown>) => {
      const cid = r.class_id as string
      const cls = r.classes as { name: string; grade: number }
      if (!cm.has(cid)) cm.set(cid, { class_id: cid, class_name: cls?.name || '?', grade: cls?.grade || 0, present: 0, absent: 0, late: 0, sport: 0, total: 0, rate: 0 })
      const c = cm.get(cid)!
      c.total++
      const st = r.status as string
      if (st === 'present') c.present++
      else if (st === 'absent') c.absent++
      else if (st === 'late') c.late++
      else if (st === 'sport') c.sport++
    })
    const avgs = Array.from(cm.values()).map(c => ({ ...c, rate: c.total > 0 ? Math.round(((c.present + c.sport) / c.total) * 100) : 0 })).sort((a, b) => a.rate - b.rate)
    setClassAvgs(avgs)

    // Daily trend
    const dm = new Map<string, { present: number; absent: number; late: number; sport: number; total: number }>()
    recs.forEach((r: Record<string, unknown>) => {
      const d = r.date as string
      if (!dm.has(d)) dm.set(d, { present: 0, absent: 0, late: 0, sport: 0, total: 0 })
      const e = dm.get(d)!
      e.total++
      const st = r.status as string
      if (st === 'present') e.present++
      else if (st === 'absent') e.absent++
      else if (st === 'late') e.late++
      else if (st === 'sport') e.sport++
    })
    setDailyTrend(Array.from(dm.entries()).map(([date, e]) => ({ date, ...e, rate: e.total > 0 ? Math.round(((e.present + e.sport) / e.total) * 100) : 0 })).sort((a, b) => a.date.localeCompare(b.date)))

    const t = { present: 0, absent: 0, late: 0, sport: 0, total: 0 }
    recs.forEach((r: Record<string, unknown>) => {
      t.total++
      const st = r.status as string
      if (st === 'present') t.present++
      else if (st === 'absent') t.absent++
      else if (st === 'late') t.late++
      else if (st === 'sport') t.sport++
    })
    setTotals(t)
    setLoading(false)
  }, [user, dateFrom, dateTo, filterClass])

  function preset(days: number) {
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - (days - 1))
    setDateFrom(iso(from))
    setDateTo(iso(to))
  }

  const overallRate = totals.total > 0 ? Math.round(((totals.present + totals.sport) / totals.total) * 100) : 0

  // Bar chart values for daily trend (rate %)
  const showTrend = dailyTrend.length > 0

  useLoadEffect(loadClasses)
  useLoadEffect(loadData)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Attendance Tracking</h2>
          <p className="text-sm text-slate-500">{user?.school_name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {[7, 14, 30].map(d => (
              <button key={d} onClick={() => preset(d)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border text-slate-600 hover:bg-slate-50">{d}d</button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Class</label>
              <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm bg-white">
                <option value="">All classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} (Gr {c.grade})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm bg-white" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm bg-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-0 shadow-sm"><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-green-600" /></div><div><p className="text-2xl font-bold text-slate-800">{overallRate}%</p><p className="text-xs text-slate-500">Attendance Rate</p></div></div></CardContent></Card>
            <Card className="border-0 shadow-sm"><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><Activity className="w-5 h-5 text-blue-600" /></div><div><p className="text-2xl font-bold text-slate-800">{totals.total}</p><p className="text-xs text-slate-500">Total Marks</p></div></div></CardContent></Card>
            <Card className="border-0 shadow-sm"><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center"><XCircle className="w-5 h-5 text-red-600" /></div><div><p className="text-2xl font-bold text-slate-800">{totals.absent}</p><p className="text-xs text-slate-500">Absent</p></div></div></CardContent></Card>
            <Card className="border-0 shadow-sm"><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center"><Clock className="w-5 h-5 text-yellow-600" /></div><div><p className="text-2xl font-bold text-slate-800">{totals.late}</p><p className="text-xs text-slate-500">Late</p></div></div></CardContent></Card>
          </div>

          {/* 30-day trend */}
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-500" />Daily Attendance Rate Trend</CardTitle></CardHeader>
            <CardContent>
              {!showTrend ? (
                <p className="text-sm text-slate-400 text-center py-8">No attendance data in this range.</p>
              ) : (
                <div className="space-y-1">
                  {dailyTrend.map(d => (
                    <div key={d.date} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-16 flex-shrink-0">{fmtDate(d.date)}</span>
                      <div className="flex-1 h-5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${d.rate}%`,
                            background: d.rate >= 90 ? '#22c55e' : d.rate >= 75 ? '#eab308' : '#ef4444',
                            minWidth: d.rate > 0 ? '4px' : '0',
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-600 w-10 text-right">{d.rate}%</span>
                    </div>
                  ))}
                  {/* legend */}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500" />≥90% good</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500" />75–89%</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500" />&lt;75%</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Class-wise averages */}
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingDown className="w-5 h-5 text-red-500" />Class-wise Attendance</CardTitle></CardHeader>
            <CardContent className="p-0">
              {classAvgs.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No data for the selected filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead><tr className="border-b bg-slate-50">
                      <th className="text-left p-3 font-medium text-slate-600">Class</th>
                      <th className="text-left p-3 font-medium text-slate-600">Grade</th>
                      <th className="text-left p-3 font-medium text-slate-600">Attendance Rate</th>
                      <th className="text-left p-3 font-medium text-slate-600">Present</th>
                      <th className="text-left p-3 font-medium text-slate-600">Late</th>
                      <th className="text-left p-3 font-medium text-slate-600">Absent</th>
                      <th className="text-left p-3 font-medium text-slate-600">Total</th>
                    </tr></thead>
                    <tbody>{classAvgs.map(c => (
                      <tr key={c.class_id} className="border-b hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-800">{c.class_name}</td>
                        <td className="p-3 text-slate-500">Gr {c.grade}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 w-20 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${c.rate}%`, background: c.rate >= 90 ? '#22c55e' : c.rate >= 75 ? '#eab308' : '#ef4444' }} />
                            </div>
                            <span className={`font-bold ${c.rate >= 90 ? 'text-green-600' : c.rate >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>{c.rate}%</span>
                          </div>
                        </td>
                        <td className="p-3 text-green-600 font-medium">{c.present}</td>
                        <td className="p-3 text-yellow-600 font-medium">{c.late}</td>
                        <td className="p-3 text-red-600 font-medium">{c.absent}</td>
                        <td className="p-3 text-slate-500">{c.total}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

