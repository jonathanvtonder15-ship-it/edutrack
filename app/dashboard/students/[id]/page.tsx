'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, ArrowLeft, Save, Camera, Plus, X, BookOpen, AlertTriangle, Award, Trash2, UsersRound } from 'lucide-react'

export default function StudentProfilePage() {
  const params = useParams()
  const router = useRouter()
  const user = useAppStore((s) => s.user)
  const studentId = params.id as string

  // ── Hydration guard ──────────────────────────────────────────────────────────
  // Zustand persist reads localStorage ASYNC. On first render user is null.
  // mounted becomes true only after useEffect fires, guaranteeing hydration.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const isAdmin = mounted && (user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'admin-teacher')
  const isSmt   = mounted && user?.role?.toLowerCase() === 'smt'
  const isGuardian = mounted && (useAppStore.getState().hasRole('monitor-guardian') || user?.role === 'admin' || user?.role === 'admin-teacher' || user?.role === 'smt')
  const canEdit = isAdmin || isSmt
  // ─────────────────────────────────────────────────────────────────────────────

  const [student, setStudent] = useState<{
    id: string; name: string; surname: string; student_number: string
    grade: number | null; photo_url: string | null; register_class?: string | null
  } | null>(null)
  const [sc, setSc] = useState<Array<{ id: string; name: string; grade: number }>>([])
  const [ac, setAc] = useState<Array<{ id: string; name: string; grade: number }>>([])
  const [demerits, setDemerits] = useState<Array<{ date: string; type_name: string; points: number; notes: string | null; teacher_name: string }>>([])
  const [merits, setMerits] = useState<Array<{ date: string; type_name: string; points: number; notes: string | null; teacher_name: string }>>([])
  const [monitorDemerits, setMonitorDemerits] = useState<Array<{ date: string; reason: string; points: number }>>([])
  const [allocs, setAllocs] = useState<Array<{ subject_name: string; teacher_name: string; class_name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [ef, setEf] = useState({ name: '', surname: '', student_number: '', grade: '', register_class: '' })
  const [addClassOpen, setAddClassOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [bigPhoto, setBigPhoto] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { if (user && studentId) load() }, [user, studentId])

  async function load() {
    if (!user) return
    const [sR, csR, cR, dR, mR] = await Promise.all([
      supabase.from('students').select('*').eq('id', studentId).single(),
      supabase.from('class_students').select('class_id, classes(id, name, grade)').eq('student_id', studentId),
      supabase.from('classes').select('id, name, grade').eq('school_id', user.school_id).order('grade').order('name'),
      supabase.from('demerits').select('date, notes, demerit_types(name, points), given_by_user:users!demerits_given_by_fkey(display_name)').eq('student_id', studentId).order('date', { ascending: false }).limit(20),
      supabase.from('merits').select('date, notes, merit_types(name, points), given_by_user:users!merits_given_by_fkey(display_name)').eq('student_id', studentId).order('date', { ascending: false }).limit(20),
    ])
    if (sR.data) {
      setStudent(sR.data)
      setEf({ name: sR.data.name, surname: sR.data.surname, student_number: sR.data.student_number || '', grade: sR.data.grade?.toString() || '', register_class: sR.data.register_class || '' })
    }
    const s = (csR.data || []).map((c: Record<string, unknown>) => c.classes as { id: string; name: string; grade: number }).filter(Boolean)
    setSc(s)
    if (cR.data) setAc(cR.data)
    setDemerits((dR.data || []).map((d: Record<string, unknown>) => ({ date: d.date as string, notes: d.notes as string | null, type_name: (d.demerit_types as { name: string })?.name || '', points: (d.demerit_types as { points: number })?.points || 0, teacher_name: (d.given_by_user as { display_name: string })?.display_name || '' })))
    setMerits((mR.data || []).map((d: Record<string, unknown>) => ({ date: d.date as string, notes: d.notes as string | null, type_name: (d.merit_types as { name: string })?.name || '', points: (d.merit_types as { points: number })?.points || 0, teacher_name: (d.given_by_user as { display_name: string })?.display_name || '' })))
    const { data: monRecs } = await supabase.from('monitors').select('id').eq('student_id', studentId)
    const monIds = (monRecs || []).map((m: Record<string, unknown>) => m.id as string)
    if (monIds.length > 0) {
      const { data: md } = await supabase.from('monitor_demerits').select('date, reason, points').in('monitor_id', monIds).order('date', { ascending: false }).limit(20)
      if (md) setMonitorDemerits(md.map((d: Record<string, unknown>) => ({ date: d.date as string, reason: (d.reason as string) || '', points: Number(d.points) || 0 })))
    } else {
      setMonitorDemerits([])
    }
    const cids = s.map((c: { id: string }) => c.id)
    if (cids.length > 0) {
      const { data: al } = await supabase.from('allocations').select('class_id, subjects(name), users!allocations_user_id_fkey(display_name), classes(name)').in('class_id', cids)
      if (al) setAllocs(al.map((a: Record<string, unknown>) => ({ subject_name: (a.subjects as { name: string })?.name || 'General', teacher_name: (a.users as { display_name: string })?.display_name || '-', class_name: (a.classes as { name: string })?.name || '' })))
    }
    setLoading(false)
  }

  async function saveProfile() {
    if (!student) return
    setSaving(true)
    await supabase.from('students').update({
      name: ef.name, surname: ef.surname,
      student_number: ef.student_number || null,
      grade: ef.grade ? parseInt(ef.grade) : null,
      register_class: isAdmin ? ef.register_class || null : undefined,
    }).eq('id', student.id)
    setStudent({ ...student, name: ef.name, surname: ef.surname, student_number: ef.student_number, grade: ef.grade ? parseInt(ef.grade) : null })
    setEditing(false)
    setSaving(false)
    await load()
  }

  async function addToClass(cid: string) {
    await supabase.from('class_students').upsert({ student_id: studentId, class_id: cid }, { onConflict: 'student_id,class_id' })
    await load()
    setAddClassOpen(false)
  }

  async function removeFromClass(cid: string) {
    await supabase.from('class_students').delete().eq('student_id', studentId).eq('class_id', cid)
    setSc(sc.filter((c) => c.id !== cid))
  }

  async function uploadPhoto(file: File) {
    if (!student) return
    const p = `${student.id}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('student-photos').upload(p, file, { upsert: true })
    if (!error) {
      const { data: u } = supabase.storage.from('student-photos').getPublicUrl(p)
      await supabase.from('students').update({ photo_url: u.publicUrl + '?t=' + Date.now() }).eq('id', student.id)
      setStudent({ ...student, photo_url: u.publicUrl + '?t=' + Date.now() })
    }
    setPhotoOpen(false)
  }

  async function deleteStudent() {
    if (!student) return
    setDeleting(true)
    // All related records (attendance, demerits, merits, leave, class_students)
    // cascade on delete via foreign keys, so deleting the student cleans everything.
    const { error } = await supabase.from('students').delete().eq('id', student.id)
    if (!error) {
      setDeleteOpen(false)
      router.push('/dashboard/students')
    }
    setDeleting(false)
  }

  const avail = ac.filter((c) => !sc.some((s) => s.id === c.id))
  const pts = demerits.reduce((s, d) => s + d.points, 0)
  const mpts = merits.reduce((s, d) => s + d.points, 0)

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
  if (!student) return <div className="text-center py-12 text-slate-500">Student not found</div>

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="w-5 h-5" /></Button>
        <h2 className="text-xl font-bold text-slate-800">Student Profile</h2>
        {isAdmin && (
          <button onClick={() => setDeleteOpen(true)} className="ml-auto text-slate-300 hover:text-red-500 transition-colors p-2" title="Delete student"><Trash2 className="w-5 h-5" /></button>
        )}
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <div className="relative flex-shrink-0">
              {student.photo_url
                ? <img src={student.photo_url} alt="" className="w-24 h-24 rounded-2xl object-cover cursor-pointer hover:ring-2 hover:ring-blue-500" onClick={() => setBigPhoto(true)} />
                : <div className="w-24 h-24 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 text-2xl font-bold">{student.name.charAt(0)}{student.surname.charAt(0)}</div>
              }
              {canEdit && <button onClick={() => setPhotoOpen(true)} className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg"><Camera className="w-4 h-4" /></button>}
            </div>

            <div className="flex-1">
              {editing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="First Name" value={ef.name} onChange={(e) => setEf({ ...ef, name: e.target.value })} />
                    <Input placeholder="Surname" value={ef.surname} onChange={(e) => setEf({ ...ef, surname: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Student Number" value={ef.student_number} onChange={(e) => setEf({ ...ef, student_number: e.target.value })} />
                    <Input type="number" placeholder="Grade (auto)" value={ef.grade} onChange={(e) => setEf({ ...ef, grade: e.target.value })} className="bg-slate-50" readOnly />
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="text-xs font-semibold text-blue-600 mb-1 block bg-blue-50 px-2 py-1 rounded">Register Class &amp; Grade — Admin Only</label>
                      <Input
                        placeholder="e.g. 11E1 or 8B"
                        value={ef.register_class}
                        onChange={(e) => {
                          const val = e.target.value
                          const gradeMatch = val.match(/^(\d+)/)
                          const extractedGrade = gradeMatch ? gradeMatch[1] : ef.grade
                          setEf({ ...ef, register_class: val, grade: extractedGrade })
                        }}
                      />
                      {ef.register_class && ef.grade && (
                        <p className="text-xs text-green-600 mt-1">✓ Grade {ef.grade} detected from class name</p>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveProfile} disabled={saving} style={{ background: '#2563EB' }}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">{student.surname}, {student.name}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                    {student.student_number && <span>ID: {student.student_number}</span>}
                    {student.grade && <span>Grade {student.grade}</span>}
                    {student.register_class && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium">Register: {student.register_class}</span>}
                    <span className={`font-bold ${pts > 0 ? 'text-red-500' : 'text-green-500'}`}>{pts} demerit pts</span>
                    <span className="font-bold text-green-500">+{mpts} merit pts</span>
                  </div>
                  {canEdit && <Button size="sm" variant="outline" className="mt-3" onClick={() => setEditing(true)}>Edit Profile</Button>}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-purple-500" />Classes &amp; Subjects ({sc.length})</CardTitle>
          {canEdit && <Button size="sm" variant="outline" onClick={() => setAddClassOpen(true)}><Plus className="w-4 h-4 mr-1" />Add to Class</Button>}
        </CardHeader>
        <CardContent>
          {sc.length === 0
            ? <p className="text-sm text-slate-400 text-center py-4">Not assigned yet.</p>
            : <div className="space-y-3">{sc.map((c) => {
                const ca = allocs.filter((a) => a.class_name === c.name)
                return (
                  <div key={c.id} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{c.name}</span>
                        <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">Gr {c.grade}</span>
                      </div>
                      {canEdit && <button onClick={() => removeFromClass(c.id)} className="text-red-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>}
                    </div>
                    {ca.length > 0
                      ? <div className="space-y-1 ml-4">{ca.map((a, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span className="text-slate-600">{a.subject_name}</span>
                            <span className="text-slate-300">&mdash;</span>
                            <span className="text-blue-600 font-medium">{a.teacher_name}</span>
                          </div>
                        ))}</div>
                      : <p className="text-xs text-slate-400 ml-4">No subjects linked</p>
                    }
                  </div>
                )
              })}</div>
          }
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-yellow-500" />Demerits ({demerits.length})</CardTitle></CardHeader>
        <CardContent>
          {demerits.length === 0
            ? <p className="text-sm text-slate-400 text-center py-4">None.</p>
            : <div className="space-y-2">{demerits.map((d, i) => (
                <div key={i} className="p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800 text-sm">{d.type_name}</span>
                    <span className="text-xs text-red-600 font-bold">{d.points} pts</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    {d.teacher_name && <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">By {d.teacher_name}</span>}
                    <span className="text-slate-400">{d.date}</span>
                    {d.notes && <span className="italic">{d.notes}</span>}
                  </div>
                </div>
              ))}</div>
          }
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2"><Award className="w-5 h-5 text-green-500" />Merits ({merits.length})</CardTitle></CardHeader>
        <CardContent>
          {merits.length === 0
            ? <p className="text-sm text-slate-400 text-center py-4">None yet.</p>
            : <div className="space-y-2">{merits.map((d, i) => (
                <div key={i} className="p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800 text-sm">{d.type_name}</span>
                    <span className="text-xs text-green-600 font-bold">+{d.points} pts</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    {d.teacher_name && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">By {d.teacher_name}</span>}
                    <span className="text-slate-400">{d.date}</span>
                    {d.notes && <span className="italic">{d.notes}</span>}
                  </div>
                </div>
              ))}</div>
          }
        </CardContent>
      </Card>

      {isGuardian && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="w-5 h-5 text-amber-500" />Monitor Demerits ({monitorDemerits.length})</CardTitle></CardHeader>
          <CardContent>
            {monitorDemerits.length === 0
              ? <p className="text-sm text-slate-400 text-center py-4">No monitor demerits.</p>
              : <div className="space-y-2">{monitorDemerits.map((d, i) => (
                  <div key={i} className="p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800 text-sm">{d.reason || 'Demerit'}</span>
                      <span className="text-xs text-amber-600 font-bold">{d.points} pts</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{d.date}</div>
                  </div>
                ))}</div>
            }
          </CardContent>
        </Card>
      )}

      {bigPhoto && student.photo_url && (
        <Dialog open={bigPhoto} onOpenChange={() => setBigPhoto(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{student.surname}, {student.name}</DialogTitle></DialogHeader>
            <img src={student.photo_url} alt="" className="w-full max-h-[400px] object-contain rounded-lg" />
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent><DialogHeader><DialogTitle>Upload Photo</DialogTitle></DialogHeader>
          <input type="file" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) uploadPhoto(e.target.files[0]) }} className="text-sm" />
        </DialogContent>
      </Dialog>

      <Dialog open={addClassOpen} onOpenChange={setAddClassOpen}>
        <DialogContent><DialogHeader><DialogTitle>Add to Class</DialogTitle></DialogHeader>
          <div className="max-h-64 overflow-y-auto border rounded-lg mt-2">
            {avail.length === 0
              ? <p className="text-sm text-slate-400 text-center py-6">All classes assigned</p>
              : avail.map((c) => (
                  <button key={c.id} onClick={() => addToClass(c.id)} className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-blue-50 border-b">
                    <span className="font-medium">{c.name} <span className="text-slate-400 text-xs">Gr {c.grade}</span></span>
                    <Plus className="w-4 h-4 text-blue-500" />
                  </button>
                ))
            }
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent><DialogHeader><DialogTitle>Delete Student</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-slate-600">Delete <span className="font-semibold">{student.surname}, {student.name}</span>? This permanently removes the learner <strong>and all their data</strong> — attendance records, demerits, merits, leave history, and class enrollments. This cannot be undone.</p>
            <div className="flex gap-2">
              <Button onClick={deleteStudent} disabled={deleting} className="flex-1" style={{ background: '#EF4444' }}>{deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}</Button>
              <Button variant="outline" onClick={() => setDeleteOpen(false)} className="flex-1">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}




























