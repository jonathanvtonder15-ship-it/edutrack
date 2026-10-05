'use client'

import { useLoadEffect } from '@/hooks/use-load-effect'
import { useCallback, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, ClipboardList, Plus, Search, Trash2, Coffee, Users, CalendarDays, Pencil, Download, FileText, Settings2, Table } from 'lucide-react'

interface CS { id: string; student_id: string; student_name: string; photo_url: string | null; register_class: string | null; activity: string; breaks: number; service_date: string; recorded_by_name: string }
type ServiceType = { id: string; name: string }
type RegStudent = { id: string; name: string; surname: string; photo_url: string | null; register_class: string | null }
const BREAK1 = '__break1__'
const BREAK2 = '__break2__'
function fmt(d: string) { const x = new Date(d + 'T00:00'); return isNaN(x.getTime()) ? d : x.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) }
function fmtShort(d: string) { const x = new Date(d + 'T00:00'); return isNaN(x.getTime()) ? d : x.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) }
function Avatar({ url, name, size }: { url: string | null; name: string; size?: 'sm' }) { const cls = 'w-7 h-7 rounded-full flex-shrink-0'; if (url) return <img src={url} alt="" className={cls + ' object-cover'} />; return <div className={cls + ' bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500'}>{(name || '?').charAt(0)}</div> }
interface LearnerSummary { name: string; register_class: string | null; activities: string[]; total_breaks: number; met: string }

function getWeekdaysInRange(from: string, to: string): string[] {
  const dates: string[] = []
  const start = new Date(from + 'T00:00')
  const end = new Date(to + 'T00:00')
  const cur = new Date(start)
  while (cur <= end && dates.length < 14) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) dates.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export default function CommunityServicePage() {
  const user = useAppStore(s => s.user)
  const [view, setView] = useState<'history' | 'register'>('history')
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<CS[]>([])
  const [registerClasses, setRegisterClasses] = useState<string[]>([])
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [selClass, setSelClass] = useState('')
  const [students, setStudents] = useState<Array<{ id: string; name: string; surname: string; photo_url: string | null }>>([])
  const [selStudent, setSelStudent] = useState('')
  const [activity, setActivity] = useState('')
  const [breaks, setBreaks] = useState('1')
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [deleteOpen, setDeleteOpen] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [period, setPeriod] = useState<{ id: string | null; start_date: string; end_date: string; required_breaks: number | null }>({ id: null, start_date: '', end_date: '', required_breaks: null })
  const [periodEditOpen, setPeriodEditOpen] = useState(false)
  const [periodDraft, setPeriodDraft] = useState({ start_date: '', end_date: '', required_breaks: '' })
  const [savingPeriod, setSavingPeriod] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [typesOpen, setTypesOpen] = useState(false)
  const [newType, setNewType] = useState('')
  const [addingType, setAddingType] = useState(false)
  // Register tab state
  const [regClass, setRegClass] = useState('')
  const [regStudents, setRegStudents] = useState<RegStudent[]>([])
  const [regLoading, setRegLoading] = useState(false)
  const [regDateFrom, setRegDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().split('T')[0] })
  const [regDateTo, setRegDateTo] = useState(new Date().toISOString().split('T')[0])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [csR, stR, pR, tyR] = await Promise.all([
        supabase.from('community_service').select('id,activity,breaks,service_date,student_id,students(name,surname,photo_url,register_class),recorded_by_user:users!community_service_recorded_by_fkey(display_name)').eq('school_id', user.school_id).order('service_date', { ascending: false }).limit(2000),
        supabase.from('students').select('id,name,surname,photo_url,register_class').eq('school_id', user.school_id).order('surname'),
        supabase.from('community_service_settings').select('*').eq('school_id', user.school_id).maybeSingle(),
        supabase.from('community_service_types').select('id,name').eq('school_id', user.school_id).order('name'),
      ])
      const rcs = [...new Set((stR.data || []).map((s: Record<string, unknown>) => (s.register_class as string || '').trim()).filter(Boolean))].sort() as string[]
      setRegisterClasses(rcs)
      setServiceTypes((tyR.data || []) as ServiceType[])
      setRecords((csR.data || []).map((r: Record<string, unknown>) => ({
        id: r.id as string, student_id: r.student_id as string, activity: r.activity as string, breaks: Number(r.breaks) || 0, service_date: r.service_date as string,
        student_name: `${(r.students as { surname: string })?.surname}, ${(r.students as { name: string })?.name}`,
        photo_url: (r.students as { photo_url: string | null })?.photo_url || null,
        register_class: (r.students as { register_class: string | null })?.register_class || null,
        recorded_by_name: (r.recorded_by_user as { display_name: string })?.display_name || '',
      })))
      if (pR.data) { setPeriod({ id: pR.data.id, start_date: pR.data.start_date || '', end_date: pR.data.end_date || '', required_breaks: pR.data.required_breaks ?? null }) }
    } catch (e) { console.error('community_service load error:', e) } finally { setLoading(false) }
  }, [user])

  const isAdmin = user?.role === 'admin' || user?.role === 'smt' || user?.role === 'admin-teacher'
  const canDelete = user?.role === 'admin' || user?.role === 'admin-teacher'

  async function loadStudents(rc: string) { setSelClass(rc); setSelStudent(''); const { data } = await supabase.from('students').select('id,name,surname,photo_url').eq('school_id', user!.school_id).eq('register_class', rc).order('surname'); setStudents(data || []) }
  async function loadRegStudents(cls: string) {
    setRegClass(cls)
    if (!cls || !user) { setRegStudents([]); return }
    setRegLoading(true)
    const { data } = await supabase.from('students').select('id,name,surname,photo_url,register_class').eq('school_id', user.school_id).eq('register_class', cls).order('surname')
    setRegStudents((data || []) as RegStudent[])
    setRegLoading(false)
  }

  async function recordService() { if (!user || !selStudent || !activity) return; setSubmitting(true); const b = parseInt(breaks) || 0; await supabase.from('community_service').insert({ student_id: selStudent, activity: activity, breaks: b, service_date: serviceDate, recorded_by: user.id, school_id: user.school_id }); setSelStudent(''); setActivity(''); setBreaks('1'); setSubmitting(false); await load(); if (selClass) { const { data } = await supabase.from('students').select('id,name,surname,photo_url').eq('school_id', user.school_id).eq('register_class', selClass).order('surname'); setStudents(data || []) } }

  async function toggleCell(sid: string, d: string, slot: '1st' | '2nd', checked: boolean) {
    if (!user) return
    const activityTag = slot === '1st' ? BREAK1 : BREAK2
    if (checked) {
      await supabase.from('community_service').insert({ student_id: sid, activity: activityTag, breaks: 1, service_date: d, recorded_by: user.id, school_id: user.school_id })
    } else {
      await supabase.from('community_service').delete().eq('student_id', sid).eq('service_date', d).eq('activity', activityTag).eq('school_id', user.school_id)
    }
    await load()
  }

  async function deleteRecord(id: string) { setDeleting(true); await supabase.from('community_service').delete().eq('id', id); setRecords(records.filter(r => r.id !== id)); setDeleting(false); setDeleteOpen(null) }
  async function addServiceType() { if (!user || !newType.trim()) return; setAddingType(true); const { data } = await supabase.from('community_service_types').insert({ school_id: user.school_id, name: newType.trim() }).select().single(); if (data) { setServiceTypes([...serviceTypes, data as ServiceType]); setNewType('') }; setAddingType(false) }
  async function deleteServiceType(id: string) { await supabase.from('community_service_types').delete().eq('id', id); setServiceTypes(serviceTypes.filter(t => t.id !== id)) }
  function openPeriodEdit() { setPeriodDraft({ start_date: period.start_date, end_date: period.end_date, required_breaks: period.required_breaks != null ? String(period.required_breaks) : '' }); setPeriodEditOpen(true) }
  async function savePeriod() { if (!user) return; setSavingPeriod(true); const req = periodDraft.required_breaks === '' ? null : parseInt(periodDraft.required_breaks) || 0; const body = { school_id: user.school_id, start_date: periodDraft.start_date || null, end_date: periodDraft.end_date || null, required_breaks: req }; if (period.id) { await supabase.from('community_service_settings').update(body).eq('id', period.id) } else { const { data } = await supabase.from('community_service_settings').insert(body).select().single(); if (data) setPeriod({ id: data.id, start_date: periodDraft.start_date, end_date: periodDraft.end_date, required_breaks: req }) }; setPeriod({ ...period, start_date: periodDraft.start_date, end_date: periodDraft.end_date, required_breaks: req }); setSavingPeriod(false); setPeriodEditOpen(false) }

  // Split records: log-duty records vs checklist records
  const logDutyRecords = records.filter(r => r.activity !== BREAK1 && r.activity !== BREAK2)
  const checklistRecords = records.filter(r => r.activity === BREAK1 || r.activity === BREAK2)
  // Set of ticked cells: 'student_id|date|1st' or 'student_id|date|2nd'
  const checklistCells = new Set(checklistRecords.map(r => r.student_id + '|' + r.service_date + '|' + (r.activity === BREAK1 ? '1st' : '2nd')))

  function buildSummaries(): LearnerSummary[] {
    const m = new Map<string, LearnerSummary>()
    logDutyRecords.forEach(r => {
      if (!m.has(r.student_id)) m.set(r.student_id, { name: r.student_name, register_class: r.register_class, activities: [], total_breaks: 0, met: 'no-req' })
      const s = m.get(r.student_id)!
      s.activities.push(r.activity + ' (' + fmt(r.service_date) + ')')
      s.total_breaks += r.breaks
    })
    const req = period.required_breaks
    return Array.from(m.values()).map(s => { const met = req == null ? 'no-req' : (s.total_breaks >= req ? 'met' : 'not-met'); return { ...s, met } }).sort((a, b) => a.name.localeCompare(b.name))
  }
  function metLabel(m: string) { if (m === 'met') return 'Completed'; if (m === 'not-met') return 'Not completed'; return '\u2014' }

  function exportCSV() {
    const sums = buildSummaries()
    const req = period.required_breaks != null ? String(period.required_breaks) : ''
    const esc = (v: string) => '"' + (v || '').replace(/"/g, '""') + '"'
    const header = ['Learner', 'Register Class', 'Service', 'Total Breaks', 'Required Breaks', 'Completed'].join(',')
    const lines = sums.map(s => [esc(s.name), esc(s.register_class || ''), esc(s.activities.join('; ')), String(s.total_breaks), req, metLabel(s.met)].join(','))
    const csv = [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'community-service.csv'; a.click(); URL.revokeObjectURL(url)
    setExportOpen(false)
  }

  function exportRegister() {
    const dates = getWeekdaysInRange(regDateFrom, regDateTo)
    const students = regStudents
    const tick = '&#10003;'
    const img = (p: string | null) => p ? '<img src="' + p + '" style="width:20px;height:20px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:6px">' : ''
    const dateHeaders = dates.map(d => '<th colspan="2" style="text-align:center;background:#e2e8f0;">' + fmtShort(d) + '</th>').join('')
    const breakHeaders = dates.map(() => '<th class="c">1st</th><th class="c">2nd</th>').join('')
    const body = students.map(st => {
      const cells = dates.map(d => {
        const k1 = st.id + '|' + d + '|1st'; const k2 = st.id + '|' + d + '|2nd'
        return '<td class="c">' + (checklistCells.has(k1) ? tick : '') + '</td><td class="c">' + (checklistCells.has(k2) ? tick : '') + '</td>'
      }).join('')
      return '<tr><td>' + img(st.photo_url) + st.surname + ', ' + st.name + '</td><td>' + (st.register_class || '') + '</td>' + cells + '</tr>'
    }).join('')
    const range = period.start_date && period.end_date ? ' &middot; ' + fmt(period.start_date) + ' to ' + fmt(period.end_date) : ''
    const html = '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Community Service Register</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:12px;color:#0f172a}h1{font-size:18px;margin:0 0 2px}h2{font-size:12px;color:#555;margin:0 0 12px}.toolbar{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px}.hint{font-size:12px;color:#888}.pb{background:#16a34a;color:#fff;border:0;padding:9px 16px;border-radius:8px;font-size:14px;cursor:pointer}.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #cbd5e1;background:#fff}table{border-collapse:collapse;width:100%;min-width:640px;font-size:12px}th,td{border:1px solid #334155;padding:6px 8px;text-align:left;white-space:nowrap}thead th{background:#f1f5f9}th:first-child,td:first-child{position:sticky;left:0;background:#fff;z-index:1;border-right:2px solid #334155;font-weight:600}thead th:first-child{z-index:2;background:#e2e8f0}.c{text-align:center}@media print{body{padding:0}.toolbar{display:none}.scroll{overflow:visible;border:none}table{min-width:0;font-size:9px}th,td{padding:3px 4px}th:first-child,td:first-child{position:static}@page{size:A4 landscape;margin:8mm}}</style></head><body><h1>Community Service Register</h1><h2>' + (regClass ? 'Class: ' + regClass + ' &middot; ' : '') + (user?.school_name || '') + range + '</h2><div class="toolbar"><span class="hint">Swipe sideways to see all dates</span><button class="pb" onclick="window.print()">Print / Save PDF</button></div><div class="scroll"><table><thead><tr><th rowspan="2">Name</th><th rowspan="2">Class</th>' + dateHeaders + '</tr><tr>' + breakHeaders + '</tr></thead><tbody>' + body + '</tbody></table></div></body></html>'
    const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close() }
    setExportOpen(false)
  }

  const filtered = logDutyRecords.filter(r => `${r.student_name} ${r.activity}`.toLowerCase().includes(search.toLowerCase()) && (!filterClass || r.register_class === filterClass))
  const totalBreaks = logDutyRecords.reduce((s, r) => s + r.breaks, 0)
  const distinctLearners = new Set(logDutyRecords.map(r => r.student_name)).size
  const periodSet = period.start_date && period.end_date
  const regDates = getWeekdaysInRange(regDateFrom, regDateTo)

  useLoadEffect(load)

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-green-500" /></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-800">Community Service</h2><p className="text-sm text-slate-500">{user?.school_name} &middot; register</p></div></div>
      <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
        <button onClick={() => setView('history')} className={'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ' + (view === 'history' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}><ClipboardList className="w-4 h-4" />Log Service</button>
        <button onClick={() => setView('register')} className={'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ' + (view === 'register' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}><Table className="w-4 h-4" />Register</button>
      </div>

      {view === 'history' && (<>
        <Card className="border-0 shadow-sm" style={{ background: 'linear-gradient(135deg,#F0FDF4,#F8FAFC)' }}><CardContent className="pt-4 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center"><CalendarDays className="w-5 h-5 text-green-600" /></div><div><p className="text-sm font-semibold text-slate-800">Community Service Period</p><p className="text-sm text-slate-600">{periodSet ? `${fmt(period.start_date)} to ${fmt(period.end_date)}` : 'Not set yet'}{period.required_breaks != null ? ` \u00b7 required: ${period.required_breaks} break${period.required_breaks === 1 ? '' : 's'}` : ''}</p></div></div>{isAdmin && <Button size="sm" variant="outline" onClick={openPeriodEdit}><Pencil className="w-4 h-4 mr-1" />{periodSet ? 'Change period' : 'Set period'}</Button>}</CardContent></Card>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm"><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center"><ClipboardList className="w-5 h-5 text-green-600" /></div><div><p className="text-2xl font-bold text-slate-800">{logDutyRecords.length}</p><p className="text-xs text-slate-500">Sessions Logged</p></div></div></CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><Coffee className="w-5 h-5 text-blue-600" /></div><div><p className="text-2xl font-bold text-slate-800">{totalBreaks}</p><p className="text-xs text-slate-500">Total Breaks Served</p></div></div></CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center"><Users className="w-5 h-5 text-slate-600" /></div><div><p className="text-2xl font-bold text-slate-800">{distinctLearners}</p><p className="text-xs text-slate-500">Learners Assigned</p></div></div></CardContent></Card>
        </div>
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-green-500" />Assign Learner to Service</CardTitle>{isAdmin && <Button size="sm" variant="outline" onClick={() => { setTypesOpen(true); setNewType('') }}><Settings2 className="w-4 h-4 mr-1" />Service Types</Button>}</CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">1. Register Class</label><select value={selClass} onChange={e => loadStudents(e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm bg-white"><option value="">Select register class...</option>{registerClasses.map(rc => <option key={rc} value={rc}>{rc}</option>)}</select></div>
              <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">2. Learner</label><select value={selStudent} onChange={e => setSelStudent(e.target.value)} disabled={!selClass} className="w-full h-10 px-3 rounded-md border text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400"><option value="">{selClass ? (students.length ? 'Select learner...' : 'No learners in this class') : 'Select a class first'}</option>{students.map(s => <option key={s.id} value={s.id}>{s.surname}, {s.name}</option>)}</select></div>
            </div>
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">3. Service type</label><select value={activity} onChange={e => setActivity(e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm bg-white"><option value="">Select service type...</option>{serviceTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select>{serviceTypes.length === 0 && <p className="text-xs text-amber-600 mt-1">No service types yet \u2014 an admin/SMT needs to add them first.</p>}</div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Breaks served</label><Input type="number" min="0" step="1" value={breaks} onChange={e => setBreaks(e.target.value)} /></div>
              <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Date</label><input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm bg-white" /></div>
            </div>
            <Button onClick={recordService} disabled={submitting || !selStudent || !activity} className="w-full" style={{ background: '#16A34A' }}>{submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ClipboardList className="w-4 h-4 mr-2" />}Assign Service</Button>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><CardTitle>Service History ({filtered.length})</CardTitle>{isAdmin && <Button size="sm" variant="outline" onClick={() => setExportOpen(true)}><Download className="w-4 h-4 mr-1" />Export</Button>}</CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Search learner or service..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div><select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="h-10 px-3 rounded-md border text-sm bg-white sm:w-44"><option value="">All register classes</option>{registerClasses.map(rc => <option key={rc} value={rc}>{rc}</option>)}</select></div>
            <div className="overflow-x-auto">{filtered.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">No community service logged yet.</p> : <table className="w-full text-sm min-w-[640px]"><thead><tr className="border-b bg-slate-50"><th className="text-left p-3 font-medium text-slate-600">Learner</th><th className="text-left p-3 font-medium text-slate-600">Register Class</th><th className="text-left p-3 font-medium text-slate-600">Service</th><th className="text-left p-3 font-medium text-slate-600">Breaks</th><th className="text-left p-3 font-medium text-slate-600">Date</th><th className="text-left p-3 font-medium text-slate-600">Assigned By</th>{canDelete && <th className="p-3 w-10"></th>}</tr></thead><tbody>{filtered.map(r => (<tr key={r.id} className="border-b hover:bg-slate-50"><td className="p-3"><div className="flex items-center gap-2"><Avatar url={r.photo_url} name={r.student_name} /><span className="font-medium text-slate-800">{r.student_name}</span></div></td><td className="p-3">{r.register_class ? <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">{r.register_class}</span> : <span className="text-slate-400">-</span>}</td><td className="p-3 text-slate-700">{r.activity}</td><td className="p-3 font-semibold text-green-600">{r.breaks}</td><td className="p-3 text-slate-500">{fmt(r.service_date)}</td><td className="p-3 text-slate-500">{r.recorded_by_name}</td>{canDelete && <td className="p-3"><button onClick={() => setDeleteOpen(r.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></td>}</tr>))}</tbody></table>}</div>
          </CardContent>
        </Card>
      </>)}

      {view === 'register' && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2"><Table className="w-5 h-5 text-green-500" />Community Service Register</CardTitle>
            <Button size="sm" variant="outline" onClick={exportRegister}><Download className="w-4 h-4 mr-1" />Print</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500">Select a class and date range, then tick the boxes to mark 1st or 2nd break served per learner per day.</p>
            <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
              <select value={regClass} onChange={e => loadRegStudents(e.target.value)} className="h-10 px-3 rounded-md border text-sm bg-white sm:w-44">
                <option value="">Select class...</option>
                {registerClasses.map(rc => <option key={rc} value={rc}>{rc}</option>)}
              </select>
              <div className="flex items-center gap-2">
                <input type="date" value={regDateFrom} onChange={e => setRegDateFrom(e.target.value)} className="h-10 px-3 rounded-md border text-sm bg-white" />
                <span className="text-sm text-slate-400">to</span>
                <input type="date" value={regDateTo} onChange={e => setRegDateTo(e.target.value)} className="h-10 px-3 rounded-md border text-sm bg-white" />
              </div>
            </div>
            {regLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-green-500" /></div>
            ) : !regClass ? (
              <p className="text-sm text-slate-400 text-center py-8">Select a register class above to view the register.</p>
            ) : regStudents.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No learners found in this class.</p>
            ) : regDates.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No weekdays in the selected date range.</p>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:-mx-0">
                <table className="w-full text-sm border-collapse" style={{minWidth: '400px'}}>
                  <thead>
                    <tr>
                      <th className="text-left p-3 font-medium text-slate-600 border border-slate-200 bg-slate-100 sticky left-0 z-20" rowSpan={2}>Name</th>
                      {regDates.map(d => (
                        <th key={d} className="text-center p-2 text-xs font-semibold text-slate-700 border border-slate-200 bg-slate-100" colSpan={2}>{fmtShort(d)}</th>
                      ))}
                    </tr>
                    <tr>
                      {regDates.flatMap(d => [
                        <th key={d + 'a'} className="text-center p-1.5 text-xs font-medium text-slate-500 border border-slate-200 bg-slate-50 w-10">1st</th>,
                        <th key={d + 'b'} className="text-center p-1.5 text-xs font-medium text-slate-500 border border-slate-200 bg-slate-50 w-10">2nd</th>
                      ])}
                    </tr>
                  </thead>
                  <tbody>
                    {regStudents.map(st => (
                      <tr key={st.id} className="border-b hover:bg-green-50/30">
                        <td className="p-2.5 border border-slate-200 sticky left-0 bg-white z-10">
                          <div className="flex items-center gap-2">
                            <Avatar url={st.photo_url} name={st.surname + ' ' + st.name} />
                            <div>
                              <span className="font-medium text-slate-800 text-sm">{st.surname}, {st.name}</span>
                              {st.register_class && <span className="block text-xs text-slate-400">{st.register_class}</span>}
                            </div>
                          </div>
                        </td>
                        {regDates.flatMap(d => {
                          const k1 = st.id + '|' + d + '|1st'
                          const k2 = st.id + '|' + d + '|2nd'
                          return [
                            <td key={d + 'a'} className="p-2 text-center border border-slate-200">
                              <input type="checkbox" className="w-4 h-4 accent-green-600 cursor-pointer" checked={checklistCells.has(k1)} onChange={e => toggleCell(st.id, d, '1st', e.target.checked)} />
                            </td>,
                            <td key={d + 'b'} className="p-2 text-center border border-slate-200">
                              <input type="checkbox" className="w-4 h-4 accent-green-600 cursor-pointer" checked={checklistCells.has(k2)} onChange={e => toggleCell(st.id, d, '2nd', e.target.checked)} />
                            </td>
                          ]
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={typesOpen} onOpenChange={setTypesOpen}><DialogContent><DialogHeader><DialogTitle>Manage Service Types</DialogTitle></DialogHeader><div className="space-y-3 pt-2"><p className="text-sm text-slate-500">Add community service options teachers can choose from.</p><div className="flex gap-2"><Input placeholder="e.g. Gardening" value={newType} onChange={e => setNewType(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addServiceType() }} /><Button onClick={addServiceType} disabled={addingType || !newType.trim()} style={{ background: '#16A34A' }}>{addingType ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}</Button></div><div className="space-y-1.5 max-h-56 overflow-y-auto">{serviceTypes.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">No service types yet.</p> : serviceTypes.map(t => (<div key={t.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg"><span className="text-sm font-medium text-slate-800">{t.name}</span><button onClick={() => deleteServiceType(t.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></div>))}</div><Button variant="outline" onClick={() => setTypesOpen(false)} className="w-full">Done</Button></div></DialogContent></Dialog>

      <Dialog open={periodEditOpen} onOpenChange={setPeriodEditOpen}><DialogContent><DialogHeader><DialogTitle>Set Community Service Period</DialogTitle></DialogHeader><div className="space-y-3 pt-2"><p className="text-sm text-slate-500">Set the date range learners must serve and how many breaks complete their service.</p><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-medium text-slate-500 mb-1 block">From</label><input type="date" value={periodDraft.start_date} onChange={e => setPeriodDraft({ ...periodDraft, start_date: e.target.value })} className="w-full h-10 px-3 rounded-md border text-sm bg-white" /></div><div><label className="text-xs font-medium text-slate-500 mb-1 block">To</label><input type="date" value={periodDraft.end_date} onChange={e => setPeriodDraft({ ...periodDraft, end_date: e.target.value })} className="w-full h-10 px-3 rounded-md border text-sm bg-white" /></div></div><div><label className="text-xs font-medium text-slate-500 mb-1 block">Required breaks (optional)</label><Input type="number" min="0" step="1" placeholder="e.g. 5" value={periodDraft.required_breaks} onChange={e => setPeriodDraft({ ...periodDraft, required_breaks: e.target.value })} /></div><div className="flex gap-2"><Button onClick={savePeriod} disabled={savingPeriod || !periodDraft.start_date || !periodDraft.end_date} className="flex-1" style={{ background: '#16A34A' }}>{savingPeriod ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Save Period</Button><Button variant="outline" onClick={() => setPeriodEditOpen(false)} className="flex-1">Cancel</Button></div></div></DialogContent></Dialog>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}><DialogContent><DialogHeader><DialogTitle>Export Community Service</DialogTitle></DialogHeader><div className="space-y-3 pt-2"><p className="text-sm text-slate-500">Export the service log or print the register.</p><Button onClick={exportCSV} className="w-full" style={{ background: '#16A34A' }}><FileText className="w-4 h-4 mr-2" />Download CSV (service log)</Button><Button onClick={exportRegister} variant="outline" className="w-full"><Download className="w-4 h-4 mr-2" />Print Register (grid)</Button></div></DialogContent></Dialog>

      <Dialog open={!!deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(null)}><DialogContent><DialogHeader><DialogTitle>Delete Entry</DialogTitle></DialogHeader><div className="space-y-4 pt-2"><p className="text-sm text-slate-600">Delete this community service entry? This cannot be undone.</p><div className="flex gap-2"><Button onClick={() => deleteOpen && deleteRecord(deleteOpen)} disabled={deleting} className="flex-1" style={{ background: '#EF4444' }}>{deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}</Button><Button variant="outline" onClick={() => setDeleteOpen(null)} className="flex-1">Cancel</Button></div></div></DialogContent></Dialog>
    </div>
  )
}

