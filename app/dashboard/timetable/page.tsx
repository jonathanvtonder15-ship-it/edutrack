'use client'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Plus, X, FileUp, Sparkles, CheckCircle2 } from 'lucide-react'
import { extractText } from 'unpdf'

const DL5 = ['Mon','Tue','Wed','Thu','Fri']
const DL10 = ['Day 1','Day 2','Day 3','Day 4','Day 5','Day 6','Day 7','Day 8','Day 9','Day 10']

// Distinct teacher colours for the grid
const T_COLORS = [
  '#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6',
  '#F97316','#06B6D4','#84CC16','#EC4899','#6366F1',
]

export default function TimetablePage() {
  const user = useAppStore(s => s.user)
  const [school, setSchool] = useState<{timetable_type:string;periods_per_day:number}|null>(null)
  const [entries, setEntries] = useState<Array<{id:string;day_number:number;period_number:number;class_id:string;subject_id:string|null;teacher_id:string}>>([])
  const [classes, setClasses] = useState<Array<{id:string;name:string;grade:number}>>([])
  const [subjects, setSubjects] = useState<Array<{id:string;name:string;grade:number}>>([])
  const [teachers, setTeachers] = useState<Array<{id:string;display_name:string}>>([])
  const [allocs, setAllocs] = useState<Array<{class_id:string;subject_id:string|null;teacher_id:string;subject_name:string;teacher_name:string}>>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [clickedCell, setClickedCell] = useState<{day:number;period:number}|null>(null)
  const [form, setForm] = useState({period:'1',class_id:'',subject_id:'',teacher_id:''})
  const [saving, setSaving] = useState(false)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parsedEntries, setParsedEntries] = useState<Array<{day_number:number;period_number:number;class_id:string;subject_id:string;teacher_id:string;class_name:string;subject_name:string;teacher_name:string}>>([])
  const [parseError, setParseError] = useState('')
  const [applying, setApplying] = useState(false)
  const [appliedCount, setAppliedCount] = useState(0)
  // Color map: teacher_id → colour
  const [colorMap, setColorMap] = useState<Record<string,string>>({})

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    if (!user) return
    const [sR, eR, cR, subR, tR, aR] = await Promise.all([
      supabase.from('schools').select('timetable_type,periods_per_day').eq('id', user.school_id).single(),
      supabase.from('timetable_entries').select('*').eq('school_id', user.school_id),
      supabase.from('classes').select('id,name,grade').eq('school_id', user.school_id).order('grade').order('name'),
      supabase.from('subjects').select('id,name,grade').eq('school_id', user.school_id).order('name'),
      supabase.from('users').select('id,display_name').eq('school_id', user.school_id).in('role', ['teacher','smt','admin-teacher']),
      supabase.from('allocations').select('class_id,subject_id,user_id,subjects(name),users!allocations_user_id_fkey(display_name)').eq('school_id', user.school_id),
    ])
    if (sR.data) setSchool(sR.data)
    if (eR.data) setEntries(eR.data)
    if (cR.data) setClasses(cR.data)
    if (subR.data) setSubjects(subR.data)
    if (tR.data) {
      setTeachers(tR.data)
      // Assign colors to teachers
      const cm: Record<string,string> = {}
      tR.data.forEach((t: {id:string}, i: number) => { cm[t.id] = T_COLORS[i % T_COLORS.length] })
      setColorMap(cm)
    }
    if (aR.data) setAllocs(aR.data.map((a: Record<string,unknown>) => ({
      class_id: a.class_id as string, subject_id: a.subject_id as string|null, teacher_id: a.user_id as string,
      subject_name: (a.subjects as {name:string})?.name || '', teacher_name: (a.users as {display_name:string})?.display_name || '',
    })))
    setLoading(false)
  }

  function onClassSelect(classId: string) {
    const ca = allocs.filter(a => a.class_id === classId)
    if (ca.length === 1) setForm(f => ({ ...f, class_id: classId, subject_id: ca[0].subject_id || '', teacher_id: ca[0].teacher_id }))
    else setForm(f => ({ ...f, class_id: classId }))
  }

  function openAdd(day: number, period: number) {
    setClickedCell({ day, period })
    setForm({ period: String(period), class_id: '', subject_id: '', teacher_id: '' })
    setAddOpen(true)
  }

  async function addEntry() {
    if (!user || !form.class_id || !form.teacher_id) return
    setSaving(true)
    const day = clickedCell?.day || 1
    await supabase.from('timetable_entries').insert({ school_id: user.school_id, day_number: day, period_number: parseInt(form.period), class_id: form.class_id, subject_id: form.subject_id || null, teacher_id: form.teacher_id })
    const ex = await supabase.from('allocations').select('id').eq('user_id', form.teacher_id).eq('class_id', form.class_id).single()
    if (!ex.data) await supabase.from('allocations').insert({ user_id: form.teacher_id, class_id: form.class_id, subject_id: form.subject_id || null })
    await load()
    setForm({ period: '1', class_id: '', subject_id: '', teacher_id: '' })
    setAddOpen(false)
    setSaving(false)
  }

  async function deleteEntry(id: string) {
    await supabase.from('timetable_entries').delete().eq('id', id)
    setEntries(entries.filter(e => e.id !== id))
  }

  async function handlePdfUpload(file: File) {
    if (!school) return
    setParseError('')
    setParsedEntries([])
    setAppliedCount(0)
    setParsing(true)
    try {
      const dl = school.timetable_type === '10-day' ? DL10 : DL5
      // Extract PDF text in the browser (no upload size limit) so only small text is sent
      let text = ''
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const extracted = await extractText(bytes, { mergePages: true })
        text = (extracted.text as string) || ''
      } catch (err) {
        const name = (err as { name?: string }).name || ''
        const msg = (err as Error).message || ''
        if (name === 'PasswordException' || /password/i.test(msg)) {
          throw new Error('This PDF is password-protected. Please remove the password (or export an unprotected copy) and try again.')
        }
        if (name === 'InvalidPDFException' || name === 'MissingPDFException' || /invalid pdf|not a pdf|missing pdf/i.test(msg)) {
          throw new Error('This file is not a valid PDF. Please export the timetable as a proper PDF (e.g. from Excel or Word).')
        }
        throw new Error('Could not read this PDF. It may be a scanned image or an unsupported format — try exporting a text-based PDF instead.')
      }

      if (!text || text.replace(/\s+/g, ' ').trim().length < 20) {
        throw new Error('No readable text found in this PDF. It is likely a scanned image — please export a text-based PDF from Excel or Word instead.')
      }

      const res = await fetch('/api/timetable/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          classes: classes.map(c => ({ id: c.id, name: c.name, grade: c.grade })),
          subjects: subjects.map(s => ({ id: s.id, name: s.name })),
          teachers: teachers.map(t => ({ id: t.id, name: t.display_name })),
          dayLabels: dl,
          periods: school.periods_per_day,
        }),
      })
      let data: any = {}
      try {
        data = await res.json()
      } catch {
        throw new Error('The server could not process this request. Please try again.')
      }
      if (!res.ok) throw new Error(data.error || 'Parse failed')
      setParsedEntries(data.entries || [])
    } catch (e) {
      setParseError((e as Error).message)
    } finally {
      setParsing(false)
    }
  }

  async function applyParsed() {
    if (!user || parsedEntries.length === 0) return
    setApplying(true)
    const rows = parsedEntries
      .filter(e => e.class_id && e.teacher_id)
      .map(e => ({
        school_id: user.school_id,
        day_number: e.day_number,
        period_number: e.period_number,
        class_id: e.class_id,
        subject_id: e.subject_id || null,
        teacher_id: e.teacher_id,
      }))
    if (rows.length > 0) {
      await supabase.from('timetable_entries').insert(rows)
      // Ensure allocations exist for each class+teacher pair (dedupe by key)
      const seen = new Set<string>()
      const uniqueAllocs: Array<{ user_id: string; class_id: string; subject_id: string | null }> = []
      for (const r of rows) {
        const key = `${r.teacher_id}_${r.class_id}`
        if (!seen.has(key)) { seen.add(key); uniqueAllocs.push({ user_id: r.teacher_id, class_id: r.class_id, subject_id: r.subject_id }) }
      }
      for (const a of uniqueAllocs) {
        const ex = await supabase.from('allocations').select('id').eq('user_id', a.user_id).eq('class_id', a.class_id).single()
        if (!ex.data) await supabase.from('allocations').insert({ user_id: a.user_id, class_id: a.class_id, subject_id: a.subject_id || null })
      }
      setAppliedCount(rows.length)
      await load()
    }
    setApplying(false)
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
  if (!school) return null

  const dl = school.timetable_type === '10-day' ? DL10 : DL5
  const dc = dl.length
  const periods = Array.from({ length: school.periods_per_day }, (_, i) => i + 1)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Timetable</h2>
          <p className="text-sm text-slate-500">{school.timetable_type === '10-day' ? '10-Day Cycle' : '5-Day'} · {school.periods_per_day} periods · click any empty cell to add</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setPdfOpen(true); setParseError(''); setParsedEntries([]); setAppliedCount(0) }}>
            <FileUp className="w-4 h-4 mr-2" /> Upload PDF
          </Button>
          <Button size="sm" style={{ background: '#2563EB' }} onClick={() => { setClickedCell(null); setForm({ period: '1', class_id: '', subject_id: '', teacher_id: '' }); setAddOpen(true) }}>
            <Plus className="w-4 h-4 mr-2" /> Add Entry
          </Button>
        </div>
      </div>

      {/* Teacher colour legend */}
      {teachers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {teachers.filter(t => entries.some(e => e.teacher_id === t.id)).map(t => (
            <div key={t.id} className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded" style={{ background: colorMap[t.id] }} />
              <span className="text-slate-600">{t.display_name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Visual grid */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs min-w-[500px]">
            <thead>
              <tr className="border-b bg-slate-800">
                <th className="p-2.5 text-left text-slate-400 font-medium w-20">Period</th>
                {dl.map((d, i) => (
                  <th key={i} className="p-2.5 text-center text-slate-200 font-semibold">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map(period => (
                <tr key={period} className="border-b">
                  <td className="p-2.5 font-bold text-slate-500 bg-slate-50 border-r">{period}</td>
                  {Array.from({ length: dc }, (_, di) => di + 1).map(day => {
                    const cellEntries = entries.filter(e => e.day_number === day && e.period_number === period)
                    if (cellEntries.length === 0) {
                      return (
                        <td key={day} className="p-1 border-r border-slate-100">
                          <button onClick={() => openAdd(day, period)} className="w-full h-10 rounded border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors flex items-center justify-center text-slate-300 hover:text-blue-400">
                            <Plus className="w-4 h-4" />
                          </button>
                        </td>
                      )
                    }
                    return (
                      <td key={day} className="p-1 border-r border-slate-100">
                        <div className="space-y-1">
                          {cellEntries.map(e => {
                            const cls = classes.find(c => c.id === e.class_id)
                            const sub = subjects.find(s => s.id === e.subject_id)
                            const tch = teachers.find(t => t.id === e.teacher_id)
                            const color = colorMap[e.teacher_id] || '#94A3B8'
                            return (
                              <div key={e.id} className="group relative rounded-lg p-2 text-white" style={{ background: color }}>
                                <p className="font-bold text-xs leading-tight">{cls?.name || '?'}</p>
                                {sub && <p className="text-[10px] opacity-80 leading-tight mt-0.5">{sub.name}</p>}
                                {tch && <p className="text-[10px] opacity-70 leading-tight">{tch.display_name}</p>}
                                <button onClick={() => deleteEntry(e.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-opacity">
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{clickedCell ? `Add: ${dl[clickedCell.day-1]} · Period ${clickedCell.period}` : 'Add Timetable Entry'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {!clickedCell && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-slate-500 mb-1 block">Day</label>
                  <select value={clickedCell ? String((clickedCell as {day:number}).day) : '1'} className="w-full h-10 px-3 rounded-md border text-sm bg-white" onChange={() => {}}>
                    {dl.map((d, i) => <option key={i} value={i+1}>{d}</option>)}
                  </select>
                </div>
                <div><label className="text-xs font-medium text-slate-500 mb-1 block">Period</label>
                  <select value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} className="w-full h-10 px-3 rounded-md border text-sm bg-white">
                    {periods.map(p => <option key={p} value={p}>Period {p}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Class (auto-fills teacher)</label>
              <select value={form.class_id} onChange={e => onClassSelect(e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm bg-white">
                <option value="">Select class...</option>
                {classes.map(c => {
                  const ca = allocs.filter(a => a.class_id === c.id)
                  return <option key={c.id} value={c.id}>{c.name}{ca.length > 0 ? ` (${ca.map(a => a.teacher_name).join(', ')})` : ''}</option>
                })}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Subject</label>
              <select value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} className="w-full h-10 px-3 rounded-md border text-sm bg-white">
                <option value="">Select subject...</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Teacher</label>
              <select value={form.teacher_id} onChange={e => setForm({ ...form, teacher_id: e.target.value })} className="w-full h-10 px-3 rounded-md border text-sm bg-white">
                <option value="">Select teacher...</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.display_name}</option>)}
              </select>
            </div>
            <Button onClick={addEntry} disabled={saving || !form.class_id || !form.teacher_id} className="w-full" style={{ background: '#2563EB' }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add to Timetable'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload PDF timetable dialog */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileUp className="w-5 h-5 text-blue-500" />Upload Timetable PDF</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {parsedEntries.length === 0 && (
              <>
                <p className="text-sm text-slate-500">Upload your timetable PDF. The AI will read it, match classes, subjects and teachers, and build the timetable grid for you.</p>
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl p-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <FileUp className="w-8 h-8 text-slate-400" />
                  <span className="text-sm font-medium text-slate-600">Click to choose a PDF</span>
                  <span className="text-xs text-slate-400">Text-based PDFs work best</span>
                  <input type="file" accept=".pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) handlePdfUpload(e.target.files[0]) }} />
                </label>
              </>
            )}
            {parsing && <div className="flex items-center justify-center gap-2 py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /><span className="text-sm text-slate-600">AI is reading your timetable...</span></div>}
            {parseError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{parseError}</div>}
            {parsedEntries.length > 0 && (
              <>
                {appliedCount > 0 ? (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700"><CheckCircle2 className="w-5 h-5" /><span className="font-medium">{appliedCount} entries added to the timetable!</span></div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-sm text-slate-600"><Sparkles className="w-4 h-4 text-purple-500" />Found <strong>{parsedEntries.length}</strong> entries. Review below, then apply.</div>
                    <div className="max-h-64 overflow-y-auto border rounded-lg">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-50"><tr className="border-b"><th className="text-left p-2 font-medium text-slate-600">Day</th><th className="text-left p-2 font-medium text-slate-600">Period</th><th className="text-left p-2 font-medium text-slate-600">Class</th><th className="text-left p-2 font-medium text-slate-600">Subject</th><th className="text-left p-2 font-medium text-slate-600">Teacher</th></tr></thead>
                        <tbody>{parsedEntries.map((e, i) => <tr key={i} className="border-b"><td className="p-2">{dl[e.day_number - 1] || e.day_number}</td><td className="p-2">P{e.period_number}</td><td className="p-2 font-medium">{e.class_name || '—'}</td><td className="p-2">{e.subject_name || '—'}</td><td className="p-2">{e.teacher_name || '—'}</td></tr>)}</tbody>
                      </table>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={applyParsed} disabled={applying} className="flex-1" style={{ background: '#10B981' }}>{applying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply to Timetable'}</Button>
                      <Button variant="outline" onClick={() => { setPdfOpen(false); setParsedEntries([]) }}>Cancel</Button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}














