'use client'

import { useLoadEffect } from '@/hooks/use-load-effect'
import { useCallback, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { filterRecipients } from '@/lib/notifications'
import { cacheGet, cacheSet } from '@/lib/cache'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Search, Plus, Award, Download, Zap, Clock, Trash2 } from 'lucide-react'

interface MR { id: string; date: string; notes: string | null; student_name: string; type_name: string; points: number; given_by_name: string; register_class: string | null; grade: number | null }
interface MT { id: string; name: string; points: number }
interface ST { id: string; name: string; surname: string; grade: number | null }

export default function MeritsPage() {
  const user = useAppStore(s => s.user)
  const [merits, setMerits] = useState<MR[]>([])
  const [meritTypes, setMeritTypes] = useState<MT[]>([])
  const [allStudents, setAllStudents] = useState<ST[]>([])
  const [classes, setClasses] = useState<Array<{ id: string; name: string; grade: number }>>([])
  const [classStudents, setClassStudents] = useState<ST[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'quick' | 'history'>('quick')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterTeacher, setFilterTeacher] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [quickNotes, setQuickNotes] = useState('')
  const [giving, setGiving] = useState(false)
  const [giveOpen, setGiveOpen] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [indivSelected, setIndivSelected] = useState<Set<string>>(new Set())
  const [singleTypes, setSingleTypes] = useState<Set<string>>(new Set())
  const [singleNotes, setSingleNotes] = useState('')
  // Add merit type dialog
  const [typeOpen, setTypeOpen] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypePoints, setNewTypePoints] = useState('1')
  const [addingType, setAddingType] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const tKey = `merit_types_${user.school_id}`
    const sKey = `students_ref_${user.school_id}`
    const cKey = `classes_ref_${user.school_id}`
    const cachedTypes = cacheGet<MT[]>(tKey)
    const cachedStudents = cacheGet<ST[]>(sKey)
    const cachedClasses = cacheGet<Array<{ id: string; name: string; grade: number }>>(cKey)
    const [mR, tR, sR, cR] = await Promise.all([
      supabase.from('merits').select('id,date,notes,grade,students(name,surname,register_class),merit_types(name,points),given_by_user:users!merits_given_by_fkey(display_name)').eq('school_id', user.school_id).order('created_at', { ascending: false }).limit(1000),
      cachedTypes ? Promise.resolve({ data: cachedTypes }) : supabase.from('merit_types').select('*').eq('school_id', user.school_id).order('name'),
      cachedStudents ? Promise.resolve({ data: cachedStudents }) : supabase.from('students').select('id,name,surname,grade').eq('school_id', user.school_id).order('surname'),
      cachedClasses ? Promise.resolve({ data: cachedClasses }) : supabase.from('classes').select('id,name,grade').eq('school_id', user.school_id).order('grade').order('name'),
    ])
    setMerits((mR.data || []).map((d: Record<string, unknown>) => ({ id: d.id as string, date: d.date as string, notes: d.notes as string | null, grade: d.grade as number | null, student_name: `${(d.students as { surname: string })?.surname}, ${(d.students as { name: string })?.name}`, register_class: (d.students as { register_class: string | null })?.register_class || null, type_name: (d.merit_types as { name: string })?.name || '', points: (d.merit_types as { points: number })?.points || 0, given_by_name: (d.given_by_user as { display_name: string })?.display_name || '' })))
    if (tR.data) { setMeritTypes(tR.data); cacheSet(tKey, tR.data, 300000) }
    if (sR.data) { setAllStudents(sR.data); cacheSet(sKey, sR.data, 300000) }
    if (cR.data) { setClasses(cR.data); cacheSet(cKey, cR.data, 300000) }
    setLoading(false)
  }, [user])

  async function loadClassStudents(classId: string) {
    setSelectedClass(classId)
    setSelectedStudents(new Set())
    if (!classId) { setClassStudents([]); return }
    const { data } = await supabase.from('class_students').select('student_id, students(id,name,surname,grade)').eq('class_id', classId)
    setClassStudents((data || []).map((cs: Record<string, unknown>) => cs.students as ST).filter(Boolean).sort((a, b) => a.surname.localeCompare(b.surname)))
  }

  async function giveClassMerits() {
    if (!user || !selectedTypes.size || !selectedStudents.size) return
    setGiving(true)
    const today = new Date().toISOString().split('T')[0]
    const gradeMap = new Map(classStudents.map(s => [s.id, s.grade]))
    const types = meritTypes.filter(dt => selectedTypes.has(dt.id))
    const rows: Array<{student_id:string;merit_type_id:string;given_by:string;date:string;grade:number|null;notes:string|null;school_id:string}> = []
    const newRecords: MR[] = []
    Array.from(selectedStudents).forEach(sid => {
      const s = classStudents.find(cs => cs.id === sid)
      types.forEach(t => {
        rows.push({ student_id: sid, merit_type_id: t.id, given_by: user.id, date: today, grade: gradeMap.get(sid) || null, notes: quickNotes || null, school_id: user.school_id })
        newRecords.push({ id: 'temp-'+Date.now()+'-'+sid+'-'+t.id, date: today, notes: quickNotes, grade: gradeMap.get(sid)||null, student_name: s?`${s.surname}, ${s.name}`:'', type_name: t.name, points: t.points, given_by_name: user.display_name||'', register_class: null })
      })
    })
    await supabase.from('merits').insert(rows)
    setMerits([...newRecords, ...merits])
    const className = classes.find(c => c.id === selectedClass)?.name || 'class'
    const totalPts = types.reduce((sum, t) => sum + t.points, 0) * selectedStudents.size
    const { data: staff } = await supabase.from('users').select('id').eq('active', true).eq('school_id', user.school_id).in('role', ['admin', 'smt', 'admin-teacher'])
    if (staff && staff.length > 0) {
      const staffIds = await filterRecipients(staff.map((u: { id: string }) => u.id), 'merit')
      if (staffIds.length > 0) await supabase.from('notifications').insert(staffIds.map(uid => ({ user_id: uid, type: 'merit', title: `${rows.length} merits given in ${className}`, message: `${types.map(t=>t.name).join(', ')} (+${totalPts} pts) by ${user.display_name}`, read: false, school_id: user.school_id })))
    }
    // Notify the allocated teacher(s) of this class too
    const { data: alloc } = await supabase.from('allocations').select('user_id').eq('class_id', selectedClass)
    if (alloc && alloc.length > 0) {
      const tids = [...new Set(alloc.map((a: Record<string, unknown>) => a.user_id as string))].filter(id => id !== user.id)
      if (tids.length > 0) {
        const filteredTids = await filterRecipients(tids, 'merit')
        if (filteredTids.length > 0) await supabase.from('notifications').insert(filteredTids.map(uid => ({ user_id: uid, type: 'merit', title: `${rows.length} merits given in ${className}`, message: `${types.map(t=>t.name).join(', ')} (+${totalPts} pts) by ${user.display_name}`, read: false, school_id: user.school_id })))
      }
    }
    setSelectedStudents(new Set())
    setSelectedTypes(new Set())
    setQuickNotes('')
    setGiving(false)
  }

  async function giveIndividualMerit() {
    if (!user || !indivSelected.size || !singleTypes.size) return
    setGiving(true)
    const today = new Date().toISOString().split('T')[0]
    const selectedIds = Array.from(indivSelected)
    const types = meritTypes.filter(dt => singleTypes.has(dt.id))
    const rows: Array<{student_id:string;merit_type_id:string;given_by:string;date:string;grade:number|null;notes:string|null;school_id:string}> = []
    const newRecords: MR[] = []
    selectedIds.forEach(sid => {
      const s = allStudents.find(st => st.id === sid)
      types.forEach(t => {
        rows.push({ student_id: sid, merit_type_id: t.id, given_by: user.id, date: today, grade: s?.grade || null, notes: singleNotes || null, school_id: user.school_id })
        newRecords.push({ id: 'temp-'+Date.now()+'-'+sid+'-'+t.id, date: today, notes: singleNotes, grade: s?.grade||null, student_name: s?`${s.surname}, ${s.name}`:'', type_name: t.name, points: t.points, given_by_name: user.display_name||'', register_class: null })
      })
    })
    await supabase.from('merits').insert(rows)
    setMerits([...newRecords, ...merits])
    const totalPts = types.reduce((sum, t) => sum + t.points, 0) * selectedIds.length
    const { data: staff } = await supabase.from('users').select('id').eq('active', true).eq('school_id', user.school_id).in('role', ['admin', 'smt', 'admin-teacher'])
    if (staff && staff.length > 0) {
      const staffIds = await filterRecipients(staff.map((u: { id: string }) => u.id), 'merit')
      if (staffIds.length > 0) await supabase.from('notifications').insert(staffIds.map(uid => ({ user_id: uid, type: 'merit', title: `${rows.length} merits given`, message: `${types.map(t=>t.name).join(', ')} (+${totalPts} pts) by ${user.display_name}`, read: false, school_id: user.school_id })))
    }
    setGiveOpen(false)
    setIndivSelected(new Set())
    setSingleTypes(new Set())
    setSingleNotes('')
    setGiving(false)
  }

  async function addMeritType() {
    if (!newTypeName || !newTypePoints || !user) return
    setAddingType(true)
    const { data } = await supabase.from('merit_types').insert({ name: newTypeName, points: parseInt(newTypePoints), school_id: user.school_id }).select().single()
    if (data) { setMeritTypes([...meritTypes, data]); setNewTypeName(''); setNewTypePoints('1'); setTypeOpen(false) }
    setAddingType(false)
  }

  function toggleStudent(id: string) {
    const n = new Set(selectedStudents)
    n.has(id) ? n.delete(id) : n.add(id)
    setSelectedStudents(n)
  }

  async function deleteMerit(id: string) {
    if (!user) return
    setDeleting(true)
    await supabase.from('merits').delete().eq('id', id)
    setMerits(merits.filter(d => d.id !== id))
    setDeleting(false)
    setDeleteOpen(null)
  }

  function exportPDF() {
    const fd = merits.filter(d => {
      const matchSearch = `${d.student_name} ${d.type_name}`.toLowerCase().includes(search.toLowerCase())
      const matchFrom = !dateFrom || d.date >= dateFrom
      const matchTo = !dateTo || d.date <= dateTo
      const matchTeacher = !filterTeacher || d.given_by_name === filterTeacher
      return matchSearch && matchFrom && matchTo && matchTeacher
    })
    const byTeacher = new Map<string, MR[]>()
    fd.forEach(d => {
      const key = d.given_by_name || 'Unknown'
      if (!byTeacher.has(key)) byTeacher.set(key, [])
      byTeacher.get(key)!.push(d)
    })
    const teacherSections = Array.from(byTeacher.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([teacher, recs]) => {
      const rows = recs.map(d => `<tr><td>${d.date}</td><td>${d.student_name}</td><td>${d.grade ? 'Gr ' + d.grade : '-'}</td><td>${d.register_class || '-'}</td><td>${d.type_name}</td><td>+${d.points}</td><td>${d.notes || '-'}</td></tr>`).join('')
      return `<div class="teacher-page"><h2>${teacher} <span class="sub">(${recs.length} merits, +${recs.reduce((s, d) => s + d.points, 0)} pts)</span></h2><table><thead><tr><th>Date</th><th>Student</th><th>Grade</th><th>Register Class</th><th>Type</th><th>Points</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table></div>`
    }).join('')
    const rangeLabel = dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : dateFrom ? `from ${dateFrom}` : dateTo ? `up to ${dateTo}` : 'all dates'
    const teacherLabel = filterTeacher ? ` — Teacher: ${filterTeacher}` : ''
    const html = `<!DOCTYPE html><html><head><title>Merit Report</title><style>body{font-family:Arial;padding:20px}h1{font-size:20px}h2{font-size:16px;margin-top:24px;border-bottom:2px solid #333;padding-bottom:6px}.sub{font-size:12px;color:#666;font-weight:normal}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}.teacher-page{page-break-after:always}.teacher-page:last-child{page-break-after:auto}@media print{.teacher-page{page-break-after:always}}</style></head><body><h1>Merit Report</h1><p>${user?.school_name || ''} | ${fd.length} records | +${fd.reduce((s, d) => s + d.points, 0)} total points | ${rangeLabel}${teacherLabel}</p>${teacherSections}</body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.setTimeout(() => w.print(), 500) }
  }

  const fs = allStudents.filter(s => `${s.name} ${s.surname}`.toLowerCase().includes(studentSearch.toLowerCase()))
  const fd = merits.filter(d => `${d.student_name} ${d.type_name}`.toLowerCase().includes(search.toLowerCase()) && (!dateFrom || d.date >= dateFrom) && (!dateTo || d.date <= dateTo) && (!filterTeacher || d.given_by_name === filterTeacher))
  const teacherNames = [...new Set(merits.map(d => d.given_by_name).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const isAdmin = user?.role === 'admin' || user?.role === 'smt' || user?.role === 'admin-teacher'

  useLoadEffect(load)

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button onClick={() => setTab('quick')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'quick' ? 'bg-green-500 text-white shadow-sm' : 'bg-white text-slate-600 border hover:bg-slate-50'}`}>
            <Zap className="w-4 h-4" /> Quick Give
          </button>
          <button onClick={() => setTab('history')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'history' ? 'bg-blue-500 text-white shadow-sm' : 'bg-white text-slate-600 border hover:bg-slate-50'}`}>
            <Clock className="w-4 h-4" /> History ({merits.length})
          </button>
        </div>
        <Button size="sm" variant="outline" onClick={() => setGiveOpen(true)}><Plus className="w-4 h-4 mr-2" />Individual</Button>
      </div>

      {tab === 'quick' && (
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">1. Select Class</label>
                  <select value={selectedClass} onChange={e => loadClassStudents(e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm bg-white">
                    <option value="">Choose class...</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} (Gr {c.grade})</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-slate-700">2. Merit Type</label>
                    <button onClick={() => setTypeOpen(true)} className="flex items-center gap-1 text-xs text-green-600 font-medium hover:underline"><Plus className="w-3.5 h-3.5" />New Type</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {meritTypes.map(dt => {
                      const on = selectedTypes.has(dt.id)
                      return (
                      <button key={dt.id} onClick={() => { const n = new Set(selectedTypes); on ? n.delete(dt.id) : n.add(dt.id); setSelectedTypes(n) }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${on ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 bg-white text-slate-600 hover:border-green-300'}`}>
                        {dt.name} <span className="opacity-60">(+{dt.points}pts)</span>
                      </button>
                      )
                    })}
                    {meritTypes.length === 0 && <p className="text-xs text-slate-400">Add merit types in Settings first</p>}
                  </div>
                </div>
              </div>
              {selectedClass && selectedTypes.size > 0 && (
                <div className="mt-4">
                  <Input placeholder="Notes (optional)" value={quickNotes} onChange={e => setQuickNotes(e.target.value)} className="max-w-sm" />
                </div>
              )}
            </CardContent>
          </Card>

          {selectedClass && classStudents.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">3. Select Learners — click to mark</CardTitle>
                  <div className="flex items-center gap-2">
                    {selectedStudents.size > 0 && (
                      <Button onClick={giveClassMerits} disabled={giving || !selectedTypes.size} size="sm" style={{ background: '#10B981' }}>
                        {giving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4 mr-1" />}
                        Give to {selectedStudents.size} learner{selectedStudents.size > 1 ? 's' : ''}
                        {selectedTypes.size > 0 && ` (+${meritTypes.filter(dt=>selectedTypes.has(dt.id)).reduce((s,t)=>s+t.points,0) * selectedStudents.size} pts)`}
                      </Button>
                    )}
                    <button onClick={() => setSelectedStudents(selected => selected.size === classStudents.length ? new Set() : new Set(classStudents.map(s => s.id)))} className="text-xs text-blue-600 hover:underline">
                      {selectedStudents.size === classStudents.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {classStudents.map(s => {
                    const sel = selectedStudents.has(s.id)
                    const todayCount = merits.filter(d => d.student_name.includes(s.surname) && d.date === new Date().toISOString().split('T')[0]).length
                    return (
                      <button key={s.id} onClick={() => toggleStudent(s.id)} className={`flex items-center justify-between p-3 rounded-lg text-left transition-all border-2 ${sel ? 'border-green-400 bg-green-50' : 'border-transparent bg-slate-50 hover:bg-slate-100 hover:border-slate-200'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${sel ? 'bg-green-400 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {sel ? '✓' : s.name.charAt(0) + s.surname.charAt(0)}
                          </div>
                          <span className={`text-sm font-medium ${sel ? 'text-green-800' : 'text-slate-700'}`}>{s.surname}, {s.name}</span>
                        </div>
                        {todayCount > 0 && <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-semibold">{todayCount} today</span>}
                      </button>
                    )
                  })}
                </div>
                {!selectedTypes.size && selectedStudents.size > 0 && <p className="text-xs text-amber-600 mt-3 font-medium">⚠ Select at least one merit type above before giving</p>}
              </CardContent>
            </Card>
          )}

          {selectedClass && classStudents.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">No learners in this class yet.</p>
          )}

          {!selectedClass && (
            <div className="text-center py-10">
              <Award className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Select a class above to see learners</p>
              <p className="text-xs text-slate-300 mt-1">Or use the Individual button for a single learner not in a class</p>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 px-2 rounded-md border text-sm bg-white" title="From" />
              <span className="text-xs text-slate-400">to</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 px-2 rounded-md border text-sm bg-white" title="To" />
              {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(''); setDateTo('') }} className="text-xs text-blue-600 hover:underline">Clear</button>}
              <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)} className="h-9 px-2 rounded-md border text-sm bg-white max-w-[160px]" title="Filter by teacher">
                <option value="">All teachers</option>
                {teacherNames.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {filterTeacher && <button onClick={() => setFilterTeacher('')} className="text-xs text-blue-600 hover:underline">Clear</button>}
              <Button size="sm" variant="outline" onClick={exportPDF}><Download className="w-4 h-4 mr-2" />Export PDF</Button>
            </div>
          </div>
          <Card className="border-0 shadow-sm"><CardContent className="p-0">
            {fd.length === 0 ? <p className="text-center text-slate-400 py-12">No merits yet.</p>
              : <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead><tr className="border-b bg-slate-50">
                    <th className="text-left p-3 font-medium text-slate-600">Date</th>
                    <th className="text-left p-3 font-medium text-slate-600">Student</th>
                    <th className="text-left p-3 font-medium text-slate-600">Grade</th>
                    <th className="text-left p-3 font-medium text-slate-600">Register Class</th>
                    <th className="text-left p-3 font-medium text-slate-600">Type</th>
                    <th className="text-left p-3 font-medium text-slate-600">Pts</th>
                    <th className="text-left p-3 font-medium text-slate-600">Given By</th>
                    <th className="text-left p-3 font-medium text-slate-600">Notes</th>
                    {isAdmin && <th className="p-3 w-10"></th>}
                  </tr></thead>
                  <tbody>{fd.map(d => (
                    <tr key={d.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 text-slate-500">{d.date}</td>
                      <td className="p-3 font-medium text-slate-800">{d.student_name}</td>
                      <td className="p-3">{d.grade ? <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">Gr {d.grade}</span> : <span className="text-slate-400">-</span>}</td>
                      <td className="p-3">{d.register_class ? <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium">{d.register_class}</span> : <span className="text-slate-400">-</span>}</td>
                      <td className="p-3">{d.type_name ? <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">{d.type_name}</span> : <span className="text-slate-400">—</span>}</td>
                      <td className="p-3 font-bold text-green-600">+{d.points}</td>
                      <td className="p-3 text-slate-500">{d.given_by_name}</td>
                      <td className="p-3 text-slate-400 text-xs">{d.notes || '-'}</td>
                      {isAdmin && <td className="p-3"><button onClick={() => setDeleteOpen(d.id)} className="text-slate-300 hover:text-red-500 transition-colors" title="Delete merit"><Trash2 className="w-4 h-4" /></button></td>}
                    </tr>
                  ))}</tbody>
                </table></div>
            }
          </CardContent></Card>
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(null)}>
        <DialogContent><DialogHeader><DialogTitle>Delete Merit</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-slate-600">Are you sure you want to delete this merit? This action cannot be undone.</p>
            <div className="flex gap-2">
              <Button onClick={() => deleteOpen && deleteMerit(deleteOpen)} disabled={deleting} className="flex-1" style={{ background: '#EF4444' }}>{deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}</Button>
              <Button variant="outline" onClick={() => setDeleteOpen(null)} className="flex-1">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Merit Type dialog */}
      <Dialog open={typeOpen} onOpenChange={setTypeOpen}>
        <DialogContent><DialogHeader><DialogTitle>Add Merit Type</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Input placeholder="Type name (e.g. Good Behaviour)" value={newTypeName} onChange={e => setNewTypeName(e.target.value)} />
            <Input type="number" placeholder="Points" value={newTypePoints} onChange={e => setNewTypePoints(e.target.value)} />
            <Button onClick={addMeritType} disabled={addingType || !newTypeName || !newTypePoints} className="w-full" style={{ background: '#10B981' }}>{addingType ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Merit Type'}</Button>
            <Button variant="outline" onClick={() => setTypeOpen(false)} className="w-full">Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={giveOpen} onOpenChange={setGiveOpen}>
        <DialogContent><DialogHeader><DialogTitle>Give Merit — Individual</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Input placeholder="Search learner..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
            {studentSearch && <div className="max-h-40 overflow-y-auto border rounded-md">{fs.slice(0, 10).map(s => { const sel=indivSelected.has(s.id); return <button key={s.id} onClick={() => { const n=new Set(indivSelected); sel?n.delete(s.id):n.add(s.id); setIndivSelected(n); setStudentSearch('') }} className={`w-full text-left px-3 py-2 text-sm border-b ${sel?'bg-green-50':''}`}><span className="font-medium">{s.surname}, {s.name}</span>{sel&&<span className="ml-2 text-green-600 text-xs">\u2713 selected</span>}</button> })}</div>}
            {indivSelected.size > 0 && <div className="max-h-40 overflow-y-auto border rounded-md">{Array.from(indivSelected).map(sid => { const s=allStudents.find(st=>st.id===sid); return <div key={sid} className="flex items-center justify-between px-3 py-2 text-sm border-b bg-green-50"><span className="font-medium">{s?`${s.surname}, ${s.name}`:sid}</span><button onClick={()=>{const n=new Set(indivSelected);n.delete(sid);setIndivSelected(n)}} className="text-red-400 text-xs">remove</button></div> })}</div>}
            <div className="flex flex-wrap gap-2">{meritTypes.map(dt => { const on = singleTypes.has(dt.id); return <button key={dt.id} onClick={() => { const n = new Set(singleTypes); on ? n.delete(dt.id) : n.add(dt.id); setSingleTypes(n) }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 ${on ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 bg-white text-slate-600'}`}>{dt.name} (+{dt.points}pts)</button> })}</div>
            <Input placeholder="Notes (optional)" value={singleNotes} onChange={e => setSingleNotes(e.target.value)} />
            <Button onClick={giveIndividualMerit} disabled={giving || !indivSelected.size || !singleTypes.size} className="w-full" style={{ background: '#10B981' }}>{giving ? <Loader2 className="w-4 h-4 animate-spin" /> : `Give Merit to ${indivSelected.size} learner${indivSelected.size !== 1 ? 's' : ''}${singleTypes.size > 1 ? ` (${singleTypes.size} types)` : ''}`}</Button>
            <Button variant="outline" onClick={() => { setGiveOpen(false); setIndivSelected(new Set()); setStudentSearch('') }} className="w-full">Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

