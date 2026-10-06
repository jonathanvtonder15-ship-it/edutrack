'use client'

import { escapeHtml } from '@/lib/html'

import Image from 'next/image'

import { useLoadEffect } from '@/hooks/use-load-effect'
import { useCallback, useMemo, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, ClipboardList, ClipboardCheck, BarChart3, UsersRound, Plus, Trash2, Download, FileText, Search, AlertTriangle, Settings2, Upload } from 'lucide-react'

interface Monitor { id: string; name: string; student_id: string | null; photo_url: string | null; grade: number | null }
interface Student { id: string; name: string; surname: string; grade: number | null; photo_url: string | null; register_class: string | null }
interface HandInRow { id: string; date: string; monitor_id: string; monitor_name: string; photo_url: string | null; grade: number | null; paper_count: number; handed_in: string; notes: string; on_duty: boolean }
interface MonitorDemerit { id: string; monitor_id: string; monitor_name: string; photo_url: string | null; date: string; reason: string; points: number }
interface DemeritType { id: string; name: string; points: number }

type TabKey = 'handin' | 'duty' | 'totals' | 'monitors' | 'demerits'
type GradeVal = number | 'all'

function fmt(d: string) { const x = new Date(d + 'T00:00'); return isNaN(x.getTime()) ? d : x.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) }
function todayISO() { return new Date().toISOString().split('T')[0] }
function gradeFromRegisterClass(rc: string | null | undefined): number | null { if (!rc) return null; const m = rc.trim().match(/^(\d{1,2})/); return m ? parseInt(m[1]) : null }
function Avatar({ url, name }: { url: string | null; name: string }) { if (url) return <Image unoptimized width={32} height={32} src={url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />; return <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">{name.charAt(0)}</div> }
function GradeSelect({ value, onChange, grades }: { value: GradeVal; onChange: (g: GradeVal) => void; grades: number[] }) { return <select value={String(value)} onChange={e => onChange(e.target.value === 'all' ? 'all' : parseInt(e.target.value))} className="h-10 px-3 rounded-md border text-sm bg-white"><option value="all">All grades</option>{grades.map(g => <option key={g} value={g}>Gr {g}</option>)}</select> }

export default function MonitorsPage() {
  const user = useAppStore(s => s.user)
  const canAccess = !!user && (useAppStore.getState().hasRole('monitor-guardian') || user.role === 'admin' || user.role === 'admin-teacher' || user.role === 'smt')
  const canManage = !!user && (useAppStore.getState().hasRole('monitor-guardian') || user.role === 'admin' || user.role === 'admin-teacher')

  const [tab, setTab] = useState<TabKey>('handin')
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [handInLog, setHandInLog] = useState<HandInRow[]>([])
  const [hiForm, setHiForm] = useState({ date: todayISO(), monitor_id: '', paper_count: '0', handed_in: '', notes: '', on_duty: false })
  const [savingHI, setSavingHI] = useState(false)
  const [dutyDate, setDutyDate] = useState(todayISO())
  const [duty, setDuty] = useState<Record<string, { b1: boolean; b2: boolean }>>({})
  const [totals, setTotals] = useState<Array<{ monitor_id: string; name: string; photo_url: string | null; grade: number | null; papers: number; handins: number; last_date: string }>>([])
  const [monitorDemerits, setMonitorDemerits] = useState<MonitorDemerit[]>([])
  const [demTypes, setDemTypes] = useState<DemeritType[]>([])
  const [demForm, setDemForm] = useState({ monitor_ids: [] as string[], type_id: '', date: todayISO() })
  const [demMonitorSearch, setDemMonitorSearch] = useState('')
  const [savingDem, setSavingDem] = useState(false)
  const [newDemType, setNewDemType] = useState('')
  const [newDemTypePoints, setNewDemTypePoints] = useState('1')
  const [addingType, setAddingType] = useState(false)
  const [uploadingTypes, setUploadingTypes] = useState(false)
  const [typeResult, setTypeResult] = useState<{ added: number; skipped: number } | null>(null)
  const [hiGrade, setHiGrade] = useState<GradeVal>('all')
  const [dutyGrade, setDutyGrade] = useState<GradeVal>('all')
  const [totGrade, setTotGrade] = useState<GradeVal>('all')
  const [mGrade, setMGrade] = useState<GradeVal>('all')
  const [hiMonitorSearch, setHiMonitorSearch] = useState('')
  const [hiMonitorOpen, setHiMonitorOpen] = useState(false)
  const [mSearch, setMSearch] = useState('')
  const [addingMonitor, setAddingMonitor] = useState(false)

  const computeTotals = useCallback((rows: Record<string, unknown>[], monitors: Monitor[]) => {
    const agg = new Map<string, { papers: number; handins: number; last_date: string }>()
    for (const r of rows) { const mid = (r.monitor_id as string) || ''; if (!mid) continue; const e = agg.get(mid) || { papers: 0, handins: 0, last_date: '' }; e.papers += Number(r.paper_count) || 0; e.handins += 1; if (!e.last_date || (r.date as string) > e.last_date) e.last_date = r.date as string; agg.set(mid, e) }
    setTotals(monitors.map(mn => { const a = agg.get(mn.id); return { monitor_id: mn.id, name: mn.name, photo_url: mn.photo_url, grade: mn.grade, papers: a?.papers || 0, handins: a?.handins || 0, last_date: a?.last_date || '' } }))
  }, [])

  const loadDuty = useCallback(async (date: string) => { if (!user) return; const { data } = await supabase.from('on_duty_register').select('monitor_id,break1,break2').eq('school_id', user.school_id).eq('date', date); const map: Record<string, { b1: boolean; b2: boolean }> = {}; for (const d of (data || [])) { const r = d as Record<string, unknown>; map[r.monitor_id as string] = { b1: !!r.break1, b2: !!r.break2 } }; setDuty(map) }, [user])

  const loadAll = useCallback(async () => {
    if (!user || !canAccess) return
    setLoading(true)
    const [mR, hR, sR, dR, tR] = await Promise.all([
      supabase.from('monitors').select('id,name,student_id,photo_url,grade').eq('school_id', user.school_id).order('name'),
      supabase.from('hand_in_log').select('id,monitor_id,date,paper_count,handed_in,notes,on_duty,monitors(name,photo_url,grade)').eq('school_id', user.school_id).order('date', { ascending: false }),
      supabase.from('students').select('id,name,surname,grade,photo_url,register_class').eq('school_id', user.school_id).order('surname'),
      supabase.from('monitor_demerits').select('id,monitor_id,date,reason,points,monitors(name,photo_url)').eq('school_id', user.school_id).order('date', { ascending: false }),
      supabase.from('monitor_demerit_types').select('id,name,points').eq('school_id', user.school_id).order('name'),
    ])
    setMonitors((mR.data || []) as Monitor[])
    setStudents((sR.data || []) as Student[])
    setDemTypes((tR.data || []).map((t: Record<string, unknown>) => ({ id: t.id as string, name: t.name as string, points: Number(t.points) || 1 })) as DemeritType[])
    setHandInLog((hR.data || []).map((r: Record<string, unknown>) => { const mn = r.monitors as { name?: string; photo_url?: string | null; grade?: number | null } | null; return { id: r.id as string, monitor_id: r.monitor_id as string, date: r.date as string, paper_count: Number(r.paper_count) || 0, handed_in: (r.handed_in as string) || '', notes: (r.notes as string) || '', on_duty: !!r.on_duty, monitor_name: mn?.name || 'Unknown', photo_url: mn?.photo_url || null, grade: mn?.grade ?? null } }))
    setMonitorDemerits((dR.data || []).map((r: Record<string, unknown>) => { const mn = r.monitors as { name?: string; photo_url?: string | null } | null; return { id: r.id as string, monitor_id: r.monitor_id as string, monitor_name: mn?.name || 'Unknown', photo_url: mn?.photo_url || null, date: r.date as string, reason: (r.reason as string) || '', points: Number(r.points) || 0 } }))
    computeTotals(hR.data || [], (mR.data || []) as Monitor[])
    await loadDuty(dutyDate)
    setLoading(false)
  }, [user, canAccess, computeTotals, loadDuty, dutyDate])

  async function saveHandIn() { if (!user || !hiForm.monitor_id) return; setSavingHI(true); await supabase.from('hand_in_log').insert({ school_id: user.school_id, date: hiForm.date, monitor_id: hiForm.monitor_id, paper_count: parseInt(hiForm.paper_count) || 0, handed_in: hiForm.handed_in, notes: hiForm.notes, on_duty: hiForm.on_duty, recorded_by: user.id }); setHiForm({ date: todayISO(), monitor_id: '', paper_count: '0', handed_in: '', notes: '', on_duty: false }); setHiMonitorSearch(''); setHiMonitorOpen(false); await loadAll(); setSavingHI(false) }

  async function deleteHandIn(id: string) { await supabase.from('hand_in_log').delete().eq('id', id); const next = handInLog.filter(r => r.id !== id); setHandInLog(next); computeTotals(next.map(row => ({ ...row })), monitors) }

  async function saveMonitorDemerit() {
    if (!user || !demForm.type_id || demForm.monitor_ids.length === 0) return
    const t = demTypes.find(x => x.id === demForm.type_id)
    if (!t) return
    setSavingDem(true)
    for (const mid of demForm.monitor_ids) {
      await supabase.from('monitor_demerits').insert({ school_id: user.school_id, monitor_id: mid, date: demForm.date, reason: t.name, points: t.points, recorded_by: user.id })
    }
    setDemForm({ monitor_ids: [], type_id: '', date: todayISO() })
    await loadAll()
    setSavingDem(false)
  }

  async function deleteMonitorDemerit(id: string) { await supabase.from('monitor_demerits').delete().eq('id', id); setMonitorDemerits(monitorDemerits.filter(d => d.id !== id)) }

  async function addDemType() {
    if (!user || !newDemType.trim()) return
    setAddingType(true)
    const pts = parseInt(newDemTypePoints) || 1
    const { data } = await supabase.from('monitor_demerit_types').insert({ school_id: user.school_id, name: newDemType.trim(), points: pts }).select().single()
    if (data) { setDemTypes([...demTypes, { id: data.id, name: data.name, points: data.points }].sort((a, b) => a.name.localeCompare(b.name))); setNewDemType(''); setNewDemTypePoints('1') }
    setAddingType(false)
  }

  async function deleteDemType(id: string) { await supabase.from('monitor_demerit_types').delete().eq('id', id); setDemTypes(demTypes.filter(t => t.id !== id)) }

  async function extractFileText(file: File): Promise<string> {
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (ext === 'docx') {
      const mammoth = (await import('mammoth')).default
      const buf = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer: buf })
      return result.value
    }
    if (ext === 'pdf') {
      const pdfjs = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`
      const buf = await file.arrayBuffer()
      const pdf = await pdfjs.getDocument({ data: buf }).promise
      let full = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const tc = await page.getTextContent()
        full += (tc.items as Array<{ str?: string }>).map(it => it.str || '').join(' ') + '\n'
      }
      return full
    }
    if (ext === 'xlsx' || ext === 'xls') {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]
      const lines: string[] = []
      for (const row of rows) {
        if (!Array.isArray(row)) continue
        const cells = row.map((c: unknown) => (c == null ? '' : String(c)).trim())
        const joined = cells.join(' ')
        if (!joined) continue
        const lower = joined.toLowerCase()
        if (!/\d/.test(joined) && (lower.includes('name') || lower.includes('demerit') || lower.includes('reason') || lower.includes('point'))) continue
        const name = cells[0] || ''
        const ptsRaw = cells.length > 1 ? cells[1] : ''
        if (name && ptsRaw && /^\d+$/.test(ptsRaw)) lines.push(name + ',' + ptsRaw)
        else if (name) lines.push(name)
      }
      return lines.join('\n')
    }
    return await file.text()
  }

  async function uploadTypesFile(file: File) {
    if (!user) return
    setUploadingTypes(true)
    setTypeResult(null)
    const text = await extractFileText(file)
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    let added = 0; let skipped = 0
    for (const line of lines) {
      let name = ''; let pts = 1
      const comma = line.split(',')
      if (comma.length >= 2) { name = comma[0].trim(); const p = parseInt(comma[1].trim()); if (!isNaN(p)) pts = p }
      else { const m = line.match(/^(.*?)\s+(\d+)\s*$/); if (m) { name = m[1].trim(); pts = parseInt(m[2]) } else { name = line } }
      if (!name) { skipped++; continue }
      const dup = demTypes.some(t => t.name.toLowerCase() === name.toLowerCase())
      if (dup) { skipped++; continue }
      const { data } = await supabase.from('monitor_demerit_types').insert({ school_id: user.school_id, name, points: pts }).select().single()
      if (data) { added++ } else { skipped++ }
    }
    setTypeResult({ added, skipped })
    setUploadingTypes(false)
    await loadAll()
  }

  async function toggleDuty(mid: string, key: 'b1' | 'b2') { const cur = duty[mid] || { b1: false, b2: false }; const next = { ...cur, [key]: !cur[key] }; setDuty({ ...duty, [mid]: next }); await supabase.from('on_duty_register').upsert({ school_id: user!.school_id, date: dutyDate, monitor_id: mid, break1: next.b1, break2: next.b2 }, { onConflict: 'date,monitor_id' }) }

  function dutyCount(key: 'b1' | 'b2') { return filteredDutyMonitors.filter(mn => duty[mn.id]?.[key] === true).length }

  async function addMonitorFromStudent(sid: string) { if (!user) return; setAddingMonitor(true); const st = students.find(s => s.id === sid); if (!st) { setAddingMonitor(false); return }; const grade = st.grade ?? gradeFromRegisterClass(st.register_class); const { data } = await supabase.from('monitors').insert({ school_id: user.school_id, name: st.surname + ', ' + st.name, student_id: st.id, photo_url: st.photo_url, grade }).select().single(); if (data) { setMonitors([...monitors, data as Monitor].sort((a, b) => a.name.localeCompare(b.name))) }; setAddingMonitor(false) }

  async function removeMonitor(id: string) { await supabase.from('monitors').delete().eq('id', id); setMonitors(monitors.filter(m => m.id !== id)) }

  function exportCSV(filename: string, headers: string[], rows: string[][]) { const q = '"'; const esc = (v: string) => q + (v || '').split(q).join(q + q) + q; const csv = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n'); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url) }

  function exportDuty() { const hs = ['Name', 'Grade', 'Date', '1st Break', '2nd Break']; const rows = filteredDutyMonitors.map(mn => [mn.name, mn.grade != null ? 'Gr ' + mn.grade : '', dutyDate, duty[mn.id]?.b1 ? 'Yes' : '', duty[mn.id]?.b2 ? 'Yes' : '']); exportCSV('on-duty-' + dutyDate + '.csv', hs, rows) }

  function printDuty() { const rows = filteredDutyMonitors.map(mn => '<tr><td>' + escapeHtml(mn.name) + '</td><td>' + escapeHtml(dutyDate) + '</td><td class="cell"></td><td class="cell"></td></tr>').join(''); const html = '<!DOCTYPE html><html><head><title>On-Duty Register</title><style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #333;padding:8px;text-align:left}.cell{width:60px;text-align:center}th{background:#f1f5f9}</style></head><body><h1>On-Duty Register</h1><h2>Date: ' + escapeHtml(dutyDate) + '</h2><table><thead><tr><th>Name</th><th>Date</th><th>1st Break</th><th>2nd Break</th></tr></thead><tbody>' + rows + '</tbody></table></body></html>'; const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.setTimeout(() => w.print(), 400) } }

  const grades = useMemo(() => { const set = new Set<number>(); for (const s of students) { const g = s.grade ?? gradeFromRegisterClass(s.register_class); if (g != null) set.add(g) }; for (const m of monitors) { if (m.grade != null) set.add(m.grade) }; return [...set].sort((a, b) => a - b) }, [students, monitors])
  const studentGrade = (s: Student) => s.grade ?? gradeFromRegisterClass(s.register_class)
  const filteredHandInLog = handInLog.filter(r => hiGrade === 'all' || r.grade === hiGrade)
  const filteredDutyMonitors = monitors.filter(m => dutyGrade === 'all' || m.grade === dutyGrade)
  const filteredTotals = totals.filter(t => totGrade === 'all' || t.grade === totGrade)
  const hiAvailability: Monitor[] = useMemo(() => { const q = hiMonitorSearch.trim().toLowerCase(); return monitors.filter(m => !q || m.name.toLowerCase().includes(q)) }, [monitors, hiMonitorSearch])
  const filteredStudents = useMemo(() => { const q = mSearch.trim().toLowerCase(); return students.filter(s => (mGrade === 'all' || studentGrade(s) === mGrade) && (!q || (s.name + ' ' + s.surname + ' ' + (s.register_class || '')).toLowerCase().includes(q))) }, [students, mGrade, mSearch])
  const alreadyMonitors = new Set(monitors.map(m => m.student_id).filter(Boolean))
  const selectedType = demTypes.find(t => t.id === demForm.type_id)
  const filteredDemMonitors = monitors.filter(m => !demMonitorSearch.trim() || m.name.toLowerCase().includes(demMonitorSearch.trim().toLowerCase()))

  useLoadEffect(loadAll)

  if (!user) return null
  if (!canAccess) return <div className="p-8 text-center text-slate-500">Monitor Guardian access required</div>
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>

  const tabs: Array<{ key: TabKey; label: string; icon: import('lucide-react').LucideIcon }> = [
    { key: 'handin', label: 'Hand-In Log', icon: ClipboardList },
    { key: 'duty', label: 'On-Duty Register', icon: ClipboardCheck },
    { key: 'demerits', label: 'Demerits', icon: AlertTriangle },
    { key: 'totals', label: 'Totals', icon: BarChart3 },
    ...(canManage ? [{ key: 'monitors' as TabKey, label: 'Manage Monitors', icon: UsersRound }] : []),
  ]

  return (
    <div className="space-y-6">
      <div><h2 className="text-xl font-bold text-slate-800">Monitors</h2><p className="text-sm text-slate-500">{user?.school_name}</p></div>
      <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
        {tabs.map(t => { const T = t.icon; return <button key={t.key} onClick={() => setTab(t.key)} className={'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ' + (tab === t.key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}><T className="w-4 h-4" />{t.label}</button> })}
      </div>

      {tab === 'handin' && (<>
        <Card className="border-0 shadow-sm"><CardHeader><CardTitle>New Hand-In</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-medium text-slate-500 mb-1 block">Date</label><input type="date" value={hiForm.date} onChange={e => setHiForm({ ...hiForm, date: e.target.value })} className="w-full h-10 px-3 rounded-md border text-sm bg-white" /></div><div><label className="text-xs font-medium text-slate-500 mb-1 block">Number of Papers</label><Input type="number" min="0" value={hiForm.paper_count} onChange={e => setHiForm({ ...hiForm, paper_count: e.target.value })} /></div></div>
          <div className="relative"><label className="text-xs font-medium text-slate-500 mb-1 block">Monitor</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Search monitor..." value={hiForm.monitor_id ? (monitors.find(m => m.id === hiForm.monitor_id)?.name || '') : hiMonitorSearch} onFocus={() => setHiMonitorOpen(true)} onChange={e => { setHiMonitorOpen(true); setHiMonitorSearch(e.target.value); setHiForm({ ...hiForm, monitor_id: '' }) }} className="pl-9" /></div>{hiMonitorOpen && (<div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border rounded-lg shadow-lg">{hiAvailability.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">No monitors match.</p> : hiAvailability.map(m => <button key={m.id} type="button" onClick={() => { setHiForm({ ...hiForm, monitor_id: m.id }); setHiMonitorOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-blue-50"><Avatar url={m.photo_url} name={m.name} /><span className="text-sm font-medium text-slate-800">{m.name}</span>{m.grade != null && <span className="ml-auto text-xs text-slate-400">Gr {m.grade}</span>}</button>)}</div>)}</div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-medium text-slate-500 mb-1 block">Handed In</label><Input placeholder="e.g. Yes / No / Partial" value={hiForm.handed_in} onChange={e => setHiForm({ ...hiForm, handed_in: e.target.value })} /></div><div><label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label><Input placeholder="Notes..." value={hiForm.notes} onChange={e => setHiForm({ ...hiForm, notes: e.target.value })} /></div></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hiForm.on_duty} onChange={e => setHiForm({ ...hiForm, on_duty: e.target.checked })} className="w-4 h-4" />On Duty?</label>
          <Button onClick={saveHandIn} disabled={savingHI || !hiForm.monitor_id} className="w-full" style={{ background: '#2563EB' }}>{savingHI ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Save Entry</Button>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><CardTitle>Hand-In Log ({filteredHandInLog.length})</CardTitle><div className="flex gap-2"><GradeSelect value={hiGrade} onChange={setHiGrade} grades={grades} /><Button size="sm" variant="outline" onClick={() => exportCSV('hand-in-log.csv', ['Date', 'Monitor', 'Grade', 'Papers', 'Handed In', 'On Duty', 'Notes'], filteredHandInLog.map(r => [r.date, r.monitor_name, r.grade != null ? 'Gr ' + r.grade : '', String(r.paper_count), r.handed_in, r.on_duty ? 'Yes' : 'No', r.notes]))}><Download className="w-4 h-4 mr-1" />CSV</Button></div></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm min-w-[720px]"><thead><tr className="border-b bg-slate-50"><th className="text-left p-3 font-medium text-slate-600">Date</th><th className="text-left p-3 font-medium text-slate-600">Monitor</th><th className="text-left p-3 font-medium text-slate-600">Grade</th><th className="text-left p-3 font-medium text-slate-600">Papers</th><th className="text-left p-3 font-medium text-slate-600">Handed In</th><th className="text-left p-3 font-medium text-slate-600">On Duty</th><th className="text-left p-3 font-medium text-slate-600">Notes</th>{canManage && <th className="p-3 w-10"></th>}</tr></thead><tbody>{filteredHandInLog.map(r => <tr key={r.id} className="border-b hover:bg-slate-50"><td className="p-3 text-slate-500">{fmt(r.date)}</td><td className="p-3"><div className="flex items-center gap-2"><Avatar url={r.photo_url} name={r.monitor_name} /><span className="font-medium text-slate-800">{r.monitor_name}</span></div></td><td className="p-3">{r.grade != null ? 'Gr ' + r.grade : '-'}</td><td className="p-3">{r.paper_count}</td><td className="p-3">{r.handed_in || '-'}</td><td className="p-3">{r.on_duty ? 'Yes' : ''}</td><td className="p-3 text-slate-500">{r.notes}</td>{canManage && <td className="p-3"><button onClick={() => deleteHandIn(r.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></td>}</tr>)}</tbody></table></div></CardContent></Card>
      </>)}

      {tab === 'duty' && (<>
        <Card className="border-0 shadow-sm"><CardContent className="pt-5 flex flex-col sm:flex-row gap-3 items-end"><div><label className="text-xs font-medium text-slate-500 mb-1 block">Date</label><input type="date" value={dutyDate} onChange={e => { setDutyDate(e.target.value); loadDuty(e.target.value) }} className="h-10 px-3 rounded-md border text-sm bg-white" /></div><div><label className="text-xs font-medium text-slate-500 mb-1 block">Grade</label><GradeSelect value={dutyGrade} onChange={setDutyGrade} grades={grades} /></div><div className="flex gap-2 ml-auto"><Button size="sm" variant="outline" onClick={exportDuty}><FileText className="w-4 h-4 mr-1" />CSV</Button><Button size="sm" variant="outline" onClick={printDuty}><Download className="w-4 h-4 mr-1" />Print</Button></div></CardContent></Card>
        <div className="grid grid-cols-2 gap-4"><Card className="border-0 shadow-sm"><CardContent className="pt-5 pb-4"><p className="text-2xl font-bold text-slate-800">{dutyCount('b1')}</p><p className="text-xs text-slate-500">1st Break</p></CardContent></Card><Card className="border-0 shadow-sm"><CardContent className="pt-5 pb-4"><p className="text-2xl font-bold text-slate-800">{dutyCount('b2')}</p><p className="text-xs text-slate-500">2nd Break</p></CardContent></Card></div>
        <Card className="border-0 shadow-sm"><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm min-w-[560px]"><thead><tr className="border-b bg-slate-50"><th className="text-left p-3 font-medium text-slate-600">Name</th><th className="text-left p-3 font-medium text-slate-600">Grade</th><th className="text-left p-3 font-medium text-slate-600">Date</th><th className="text-center p-3 font-medium text-slate-600">1st Break</th><th className="text-center p-3 font-medium text-slate-600">2nd Break</th></tr></thead><tbody>{filteredDutyMonitors.map(mn => (<tr key={mn.id} className="border-b hover:bg-slate-50"><td className="p-3"><div className="flex items-center gap-2"><Avatar url={mn.photo_url} name={mn.name} /><span className="font-medium text-slate-800">{mn.name}</span></div></td><td className="p-3">{mn.grade != null ? 'Gr ' + mn.grade : '-'}</td><td className="p-3 text-slate-500">{dutyDate}</td><td className="p-3 text-center"><input type="checkbox" className="w-5 h-5" checked={duty[mn.id]?.b1 || false} onChange={() => toggleDuty(mn.id, 'b1')} /></td><td className="p-3 text-center"><input type="checkbox" className="w-5 h-5" checked={duty[mn.id]?.b2 || false} onChange={() => toggleDuty(mn.id, 'b2')} /></td></tr>))}</tbody></table></div></CardContent></Card>
      </>)}

      {tab === 'demerits' && (<>
        <Card className="border-0 shadow-sm"><CardHeader><CardTitle>Give Monitor Demerit</CardTitle></CardHeader><CardContent className="space-y-3">
          <p className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-lg p-2">These demerits are for monitor duty only and do NOT affect the learner&apos;s normal school demerits.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="text-xs font-medium text-slate-500 mb-1 block">Demerit (choose from list)</label><select value={demForm.type_id} onChange={e => setDemForm({ ...demForm, type_id: e.target.value })} className="w-full h-10 px-3 rounded-md border text-sm bg-white"><option value="">Select demerit...</option>{demTypes.map(t => <option key={t.id} value={t.id}>{t.name} ({t.points} pt{t.points === 1 ? '' : 's'})</option>)}</select>{demTypes.length === 0 && <p className="text-xs text-amber-600 mt-1">No demerit types yet — add them below first.</p>}</div><div><label className="text-xs font-medium text-slate-500 mb-1 block">Date</label><input type="date" value={demForm.date} onChange={e => setDemForm({ ...demForm, date: e.target.value })} className="w-full h-10 px-3 rounded-md border text-sm bg-white" /></div></div>
          {selectedType && <p className="text-xs text-slate-500">Will give <span className="font-semibold text-amber-600">{selectedType.points} point{selectedType.points === 1 ? '' : 's'}</span> for: {selectedType.name}.</p>}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Monitors ({demForm.monitor_ids.length} selected)</label>
            <div className="relative mb-2"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Search monitor..." value={demMonitorSearch} onChange={e => setDemMonitorSearch(e.target.value)} className="pl-9" /></div>
            <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
              {filteredDemMonitors.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">No monitors.</p> : filteredDemMonitors.map(m => { const checked = demForm.monitor_ids.includes(m.id); return <label key={m.id} className={`flex items-center gap-3 p-2.5 cursor-pointer hover:bg-amber-50 ${checked ? 'bg-amber-50' : ''}`}><input type="checkbox" className="w-5 h-5 accent-amber-600" checked={checked} onChange={() => { const ids = checked ? demForm.monitor_ids.filter(x => x !== m.id) : [...demForm.monitor_ids, m.id]; setDemForm({ ...demForm, monitor_ids: ids }) }} /><Avatar url={m.photo_url} name={m.name} /><span className="text-sm font-medium text-slate-800 flex-1">{m.name}</span>{m.grade != null && <span className="text-xs text-slate-400">Gr {m.grade}</span>}</label> })}
            </div>
          </div>
          <Button onClick={saveMonitorDemerit} disabled={savingDem || demForm.monitor_ids.length === 0 || !demForm.type_id} className="w-full" style={{ background: '#F59E0B' }}>{savingDem ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}Give Demerit ({demForm.monitor_ids.length})</Button>
        </CardContent></Card>

        <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="w-5 h-5 text-amber-500" />Demerit List</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><div className="sm:col-span-2"><Input placeholder="Demerit name, e.g. Late for duty" value={newDemType} onChange={e => setNewDemType(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addDemType() }} /></div><div className="flex gap-2"><Input type="number" min="1" placeholder="Points" value={newDemTypePoints} onChange={e => setNewDemTypePoints(e.target.value)} /><Button onClick={addDemType} disabled={addingType || !newDemType.trim()} style={{ background: '#2563EB' }}>{addingType ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}</Button></div></div>
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center"><label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer"><Upload className="w-4 h-4" />Upload list (Word/PDF/Excel/CSV)</label><input type="file" accept=".docx,.pdf,.xlsx,.xls,.csv,.txt" onChange={e => { const f = e.target.files?.[0]; if (f) uploadTypesFile(f) }} className="text-sm" /><span className="text-xs text-slate-400">Each line: <span className="font-mono">Name,Points</span> — e.g. <span className="font-mono">Late for duty,2</span></span>{uploadingTypes && <span className="text-xs text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Uploading…</span>}</div>
          {typeResult && <p className="text-xs text-slate-600">{typeResult.added} added, {typeResult.skipped} skipped (duplicates or blank).</p>}
          <div className="space-y-1.5">{demTypes.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">No demerit types yet.</p> : demTypes.map(t => (<div key={t.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg"><span className="text-sm font-medium text-slate-800">{t.name}</span><div className="flex items-center gap-3"><span className="text-xs font-semibold text-amber-600">{t.points} pt{t.points === 1 ? '' : 's'}</span>{canManage && <button onClick={() => deleteDemType(t.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}</div></div>))}</div>
        </CardContent></Card>

        <Card className="border-0 shadow-sm"><CardHeader><CardTitle>Monitor Demerits ({monitorDemerits.length})</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto">{monitorDemerits.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">No monitor demerits yet.</p> : <table className="w-full text-sm min-w-[560px]"><thead><tr className="border-b bg-slate-50"><th className="text-left p-3 font-medium text-slate-600">Monitor</th><th className="text-left p-3 font-medium text-slate-600">Date</th><th className="text-left p-3 font-medium text-slate-600">Reason</th><th className="text-left p-3 font-medium text-slate-600">Points</th><th className="p-3 w-10"></th></tr></thead><tbody>{monitorDemerits.map(d => <tr key={d.id} className="border-b hover:bg-slate-50"><td className="p-3"><div className="flex items-center gap-2"><Avatar url={d.photo_url} name={d.monitor_name} /><span className="font-medium text-slate-800">{d.monitor_name}</span></div></td><td className="p-3 text-slate-500">{fmt(d.date)}</td><td className="p-3 text-slate-700">{d.reason}</td><td className="p-3 font-semibold text-amber-600">{d.points}</td><td className="p-3"><button onClick={() => deleteMonitorDemerit(d.id)} className="text-slate-300 hover:text-red-500" disabled={!canManage}><Trash2 className="w-4 h-4" /></button></td></tr>)}</tbody></table>}</div></CardContent></Card>
      </>)}

      {tab === 'totals' && (<Card className="border-0 shadow-sm"><CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><CardTitle>Totals Summary</CardTitle><div className="flex gap-2"><GradeSelect value={totGrade} onChange={setTotGrade} grades={grades} /><Button size="sm" variant="outline" onClick={() => exportCSV('monitor-totals.csv', ['Monitor', 'Grade', 'Total Papers', 'Hand-ins', 'Last Hand-in'], filteredTotals.map(t => [t.name, t.grade != null ? 'Gr ' + t.grade : '', String(t.papers), String(t.handins), t.last_date || '-']))}><Download className="w-4 h-4 mr-1" />CSV</Button></div></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm min-w-[560px]"><thead><tr className="border-b bg-slate-50"><th className="text-left p-3 font-medium text-slate-600">Monitor</th><th className="text-left p-3 font-medium text-slate-600">Grade</th><th className="text-left p-3 font-medium text-slate-600">Total Papers</th><th className="text-left p-3 font-medium text-slate-600">Hand-ins</th><th className="text-left p-3 font-medium text-slate-600">Last Hand-in</th></tr></thead><tbody>{filteredTotals.map(t => <tr key={t.monitor_id} className="border-b hover:bg-slate-50"><td className="p-3"><div className="flex items-center gap-2"><Avatar url={t.photo_url} name={t.name} /><span className="font-medium text-slate-800">{t.name}</span></div></td><td className="p-3">{t.grade != null ? 'Gr ' + t.grade : '-'}</td><td className="p-3">{t.papers}</td><td className="p-3">{t.handins}</td><td className="p-3 text-slate-500">{t.last_date ? fmt(t.last_date) : '-'}</td></tr>)}</tbody></table></div></CardContent></Card>)}

      {tab === 'monitors' && (<>
        <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="w-5 h-5 text-pink-500" />Current Monitors ({monitors.length})</CardTitle></CardHeader><CardContent>{monitors.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">No monitors yet — select learners below.</p> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">{monitors.map(m => <div key={m.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg"><div className="flex items-center gap-2 min-w-0"><Avatar url={m.photo_url} name={m.name} /><div className="min-w-0"><p className="text-sm font-medium text-slate-800 truncate">{m.name}</p>{m.grade != null && <p className="text-xs text-slate-400">Gr {m.grade}</p>}</div></div>{canManage && <button onClick={() => removeMonitor(m.id)} className="text-slate-300 hover:text-red-500 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>}</div>)}</div>}</CardContent></Card>
        <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-blue-500" />Select Learners as Monitors</CardTitle></CardHeader><CardContent><div className="flex gap-2 mb-3"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Search learner or register class..." value={mSearch} onChange={e => setMSearch(e.target.value)} className="pl-9" /></div><GradeSelect value={mGrade} onChange={setMGrade} grades={grades} /></div><div className="max-h-96 overflow-y-auto border rounded-lg divide-y">{filteredStudents.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">No learners match.</p> : filteredStudents.map(s => { const g = studentGrade(s); const isMonitor = alreadyMonitors.has(s.id); return <div key={s.id} className="flex items-center justify-between p-2.5 hover:bg-slate-50"><div className="flex items-center gap-3"><Avatar url={s.photo_url} name={s.name + ' ' + s.surname} /><div><p className="font-medium text-slate-800 text-sm">{s.surname}, {s.name}</p>{g != null && <p className="text-xs text-slate-400">Gr {g}{s.register_class ? ' · ' + s.register_class : ''}</p>}</div></div>{isMonitor ? <span className="text-xs text-green-600 font-medium">Already a monitor</span> : <Button size="sm" variant="outline" onClick={() => addMonitorFromStudent(s.id)} disabled={addingMonitor}><Plus className="w-4 h-4 mr-1" />Add</Button>}</div> })}</div></CardContent></Card>
      </>)}
    </div>
  )
}

