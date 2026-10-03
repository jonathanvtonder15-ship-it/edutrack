'use client'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { filterRecipients } from '@/lib/notifications'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Search, DoorOpen, Check, Clock, LogOut, LogIn, ArrowLeft, Trash2 } from 'lucide-react'

const QUICK_REASONS = ['Bathroom', 'Office', 'Sick Bay', 'Counselor']

type LR = {
  id: string
  student_name: string
  class_name: string
  teacher_name: string
  to_teacher_name: string
  period: number | null
  date: string
  time_out: string
  time_in: string | null
  arrived_at: string | null
  departed_at: string | null
  reason: string | null
}

export default function LeaveRegisterPage(){
  const user = useAppStore(s=>s.user)
  const [records,setRecords] = useState<LR[]>([])
  const [incoming,setIncoming] = useState<LR[]>([])
  const [loading,setLoading] = useState(true)
  const [search,setSearch] = useState('')
  const [signOutOpen,setSignOutOpen] = useState(false)
  const [allStudents,setAllStudents] = useState<Array<{id:string;name:string;surname:string}>>([])
  const [classes,setClasses] = useState<Array<{id:string;name:string}>>([])
  const [teachers,setTeachers] = useState<Array<{id:string;display_name:string}>>([])
  const [studentSearch,setStudentSearch] = useState('')
  const [selectedStudent,setSelectedStudent] = useState<{id:string;name:string;surname:string}|null>(null)
  const [formClass,setFormClass] = useState('')
  const [formPeriod,setFormPeriod] = useState('')
  const [formReason,setFormReason] = useState('')
  const [formTeacher,setFormTeacher] = useState('')
  const [submitting,setSubmitting] = useState(false)
  const [deleteOpen,setDeleteOpen] = useState<string|null>(null)
  const [deleting,setDeleting] = useState(false)

  useEffect(()=>{ if(user) load() },[user])

  function fmt(ts: string | null): string | null {
    if (!ts) return null
    return new Date(ts).toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'})
  }

  async function load(){
    if(!user) return
    const [rR,sR,cR,tR] = await Promise.all([
      supabase.from('leave_register').select('*,students(name,surname),classes(name,id),recorder:users!leave_register_recorded_by_fkey(display_name),to_teacher:users!leave_register_to_teacher_id_fkey(display_name)').eq('school_id',user.school_id).order('created_at',{ascending:false}).limit(300),
      supabase.from('students').select('id,name,surname').eq('school_id',user.school_id).order('surname'),
      supabase.from('classes').select('id,name').eq('school_id',user.school_id),
      supabase.from('users').select('id,display_name').eq('school_id',user.school_id).in('role',['teacher','smt','admin','admin-teacher']),
    ])
    const cids = [...new Set((rR.data||[]).map((r:Record<string,unknown>)=>(r.classes as{id:string})?.id).filter(Boolean))]
    let tm = new Map<string,string>()
    if(cids.length>0){
      const{data:al} = await supabase.from('allocations').select('class_id,users!allocations_user_id_fkey(display_name)').in('class_id',cids)
      ;(al||[]).forEach((a:Record<string,unknown>)=>{ const c=a.class_id as string; const t=(a.users as{display_name:string})?.display_name; if(t&&!tm.has(c)) tm.set(c,t) })
    }
    const mapped = (rR.data||[]).map((r:Record<string,unknown>): LR => {
      const cid = (r.classes as {id:string})?.id || ''
      return {
        id: r.id as string,
        date: r.date as string,
        period: r.period as number|null,
        time_out: fmt(r.time_out as string) || '',
        time_in: fmt(r.time_in as string),
        arrived_at: fmt(r.arrived_at as string | null),
        departed_at: fmt(r.departed_at as string | null),
        reason: r.reason as string|null,
        student_name: `${(r.students as {surname:string})?.surname}, ${(r.students as {name:string})?.name}`,
        class_name: (r.classes as {name:string})?.name || '',
        teacher_name: tm.get(cid) || '',
        to_teacher_name: (r.to_teacher as {display_name:string})?.display_name || '',
      }
    })
    setRecords(mapped)
    setIncoming(mapped.filter(r => r.to_teacher_name && !r.time_in && !r.arrived_at))
    if(sR.data) setAllStudents(sR.data)
    if(cR.data) setClasses(cR.data)
    if(tR.data) setTeachers(tR.data.filter((t:{id:string})=>t.id!==user.id))
    setLoading(false)
  }

  async function signOut(){
    if(!user||!selectedStudent||!formClass) return
    setSubmitting(true)
    const { data: rec } = await supabase.from('leave_register').insert({student_id:selectedStudent.id,class_id:formClass,period:formPeriod?parseInt(formPeriod):null,date:new Date().toISOString().split('T')[0],reason:formReason||null,to_teacher_id:formTeacher||null,recorded_by:user.id,school_id:user.school_id}).select('id').single()
    const className = classes.find(c=>c.id===formClass)?.name || 'class'
    const { data: staff } = await supabase.from('users').select('id').eq('school_id',user.school_id).in('role',['admin','smt','admin-teacher'])
    const targetTeacher = teachers.find(t=>t.id===formTeacher)
    const recipients = new Set<string>()
    if(targetTeacher) recipients.add(targetTeacher.id)
    ;(staff||[]).forEach((u:{id:string})=>recipients.add(u.id))
    if(recipients.size>0){
      const filtered = await filterRecipients(Array.from(recipients), 'leave')
      if(filtered.length>0) await supabase.from('notifications').insert(filtered.map(uid=>({user_id:uid,type:'leave',title:`${selectedStudent.surname}, ${selectedStudent.name} left ${className}`,message:targetTeacher?`Coming to ${targetTeacher.display_name}${formReason?` — ${formReason}`:''}`:formReason||'Left class',read:false,school_id:user.school_id,data_json:rec?{leave_id:rec.id}:null})))
    }
    await load()
    setSignOutOpen(false); setSelectedStudent(null); setFormClass(''); setFormPeriod(''); setFormReason(''); setFormTeacher(''); setSubmitting(false)
  }

  async function signIn(id:string){
    await supabase.from('leave_register').update({time_in:new Date().toISOString()}).eq('id',id)
    await load()
  }

  async function markArrived(id:string){
    await supabase.from('leave_register').update({arrived_at:new Date().toISOString()}).eq('id',id)
    const rec = records.find(r=>r.id===id)
    if(rec && user){
      const { data: staff } = await supabase.from('users').select('id').eq('school_id',user.school_id).in('role',['admin','smt','admin-teacher'])
      const ids = new Set<string>((staff||[]).map((u:{id:string})=>u.id))
      const filtered = await filterRecipients(Array.from(ids), 'leave')
      if(filtered.length>0) await supabase.from('notifications').insert(filtered.map(uid=>({user_id:uid,type:'leave',title:`${rec.student_name} arrived`,message:`Arrived with ${user.display_name}`,read:false,school_id:user.school_id})))
    }
    await load()
  }

  async function markDeparted(id:string){
    await supabase.from('leave_register').update({departed_at:new Date().toISOString()}).eq('id',id)
    const rec = records.find(r=>r.id===id)
    if(rec && user){
      const { data: staff } = await supabase.from('users').select('id').eq('school_id',user.school_id).in('role',['admin','smt','admin-teacher'])
      const ids = new Set<string>((staff||[]).map((u:{id:string})=>u.id))
      const filtered = await filterRecipients(Array.from(ids), 'leave')
      if(filtered.length>0) await supabase.from('notifications').insert(filtered.map(uid=>({user_id:uid,type:'leave',title:`${rec.student_name} departed`,message:`Left ${user.display_name} — returning to class`,read:false,school_id:user.school_id})))
    }
    await load()
  }

  async function deleteRecord(id:string){
    if(!user) return
    setDeleting(true)
    await supabase.from('leave_register').delete().eq('id',id)
    await load()
    setDeleting(false)
    setDeleteOpen(null)
  }

  const fs = allStudents.filter(s=>`${s.name} ${s.surname}`.toLowerCase().includes(studentSearch.toLowerCase()))
  const filtered = records.filter(r=>`${r.student_name} ${r.class_name} ${r.reason||''}`.toLowerCase().includes(search.toLowerCase()))
  const out = filtered.filter(r=>!r.time_in)
  const returned = filtered.filter(r=>r.time_in)
  const today = new Date().toISOString().split('T')[0]
  const todayOut = records.filter(r=>r.date===today).length
  const todayStillOut = records.filter(r=>r.date===today&&!r.time_in).length
  const withMe = records.filter(r=>r.to_teacher_name && !r.time_in && r.arrived_at && !r.departed_at)
  const isAdmin = user?.role === 'admin' || user?.role === 'admin-teacher'

  if(loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>

  return(
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md w-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Search learners, classes, reasons..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-9" /></div>
        <Button className="w-full sm:w-auto h-12 sm:h-9" style={{background:'#F97316'}} onClick={()=>setSignOutOpen(true)}><DoorOpen className="w-5 h-5 sm:w-4 sm:h-4 mr-2" />Sign Out Learner</Button>
      </div>

      {(incoming.length>0 || withMe.length>0) && (
        <Card className="border-0 shadow-sm border-l-4" style={{borderLeftColor:'#2563EB'}}>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><LogIn className="w-5 h-5 text-blue-500" />Learners Coming To You</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {incoming.length>0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Awaiting arrival ({incoming.length})</p>
                <div className="space-y-2">{incoming.map(r=>(
                  <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-blue-50 rounded-lg">
                    <div><p className="font-medium text-slate-800">{r.student_name}</p><p className="text-xs text-slate-500">{r.class_name} | Left {r.time_out}{r.reason?` | ${r.reason}`:''}</p></div>
                    <Button size="sm" onClick={()=>markArrived(r.id)} className="w-full sm:w-auto" style={{background:'#2563EB'}}><Check className="w-4 h-4 mr-1" />Arrived</Button>
                  </div>
                ))}</div>
              </div>
            )}
            {withMe.length>0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">With you now ({withMe.length})</p>
                <div className="space-y-2">{withMe.map(r=>(
                  <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-green-50 rounded-lg">
                    <div><p className="font-medium text-slate-800">{r.student_name}</p><p className="text-xs text-slate-500">{r.class_name} | Arrived {r.arrived_at}</p></div>
                    <Button size="sm" variant="outline" onClick={()=>markDeparted(r.id)} className="w-full sm:w-auto border-amber-300 text-amber-700"><ArrowLeft className="w-4 h-4 mr-1" />Departed</Button>
                  </div>
                ))}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="pt-4 pb-3"><div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center"><DoorOpen className="w-5 h-5 text-orange-600" /></div><div><p className="text-xl font-bold text-slate-800">{out.length}</p><p className="text-xs text-slate-500">Currently Out</p></div></div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="pt-4 pb-3"><div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center"><LogOut className="w-5 h-5 text-blue-600" /></div><div><p className="text-xl font-bold text-slate-800">{todayOut}</p><p className="text-xs text-slate-500">Out Today</p></div></div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="pt-4 pb-3"><div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center"><Clock className="w-5 h-5 text-green-600" /></div><div><p className="text-xl font-bold text-slate-800">{todayStillOut}</p><p className="text-xs text-slate-500">Still Out Today</p></div></div></CardContent></Card>
      </div>

      {out.length>0 && <Card className="border-0 shadow-sm border-l-4" style={{borderLeftColor:'#F97316'}}><CardHeader><CardTitle className="text-lg flex items-center gap-2"><DoorOpen className="w-5 h-5 text-orange-500" />Currently Out ({out.length})</CardTitle></CardHeader><CardContent><div className="space-y-2">{out.map(r=><div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-orange-50 rounded-lg"><div><p className="font-medium text-slate-800">{r.student_name}</p><p className="text-xs text-slate-500">{r.class_name}{r.teacher_name?` (${r.teacher_name})`:''} {r.period?`| P${r.period}`:''} | Left {r.time_out}{r.to_teacher_name?` → ${r.to_teacher_name}`:''}{r.reason?` | ${r.reason}`:''}{r.arrived_at?` | Arrived ${r.arrived_at}`:''}{r.departed_at?` | Departed ${r.departed_at}`:''}</p></div><div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={()=>signIn(r.id)} className="border-green-300 text-green-600 h-10 sm:h-8 active:bg-green-100 w-full sm:w-auto"><Check className="w-4 h-4 mr-1" />Sign In</Button>{isAdmin&&<button onClick={()=>setDeleteOpen(r.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1" title="Delete record"><Trash2 className="w-4 h-4" /></button>}</div></div>)}</div></CardContent></Card>}

      <Card className="border-0 shadow-sm"><CardHeader><CardTitle>History ({returned.length})</CardTitle></CardHeader><CardContent className="p-0">{returned.length===0?<p className="text-sm text-slate-400 p-6">No records yet</p>:<div className="overflow-x-auto"><table className="w-full text-sm min-w-[560px]"><thead><tr className="border-b bg-slate-50"><th className="text-left p-3 font-medium text-slate-600">Date</th><th className="text-left p-3 font-medium text-slate-600">Student</th><th className="text-left p-3 font-medium text-slate-600">Class</th><th className="text-left p-3 font-medium text-slate-600">Teacher</th><th className="text-left p-3 font-medium text-slate-600">Out</th><th className="text-left p-3 font-medium text-slate-600">In</th><th className="text-left p-3 font-medium text-slate-600">Reason</th>{isAdmin&&<th className="p-3 w-10"></th>}</tr></thead><tbody>{returned.map(r=><tr key={r.id} className="border-b hover:bg-slate-50"><td className="p-3 text-slate-500">{r.date}</td><td className="p-3 font-medium">{r.student_name}</td><td className="p-3 text-slate-500">{r.class_name}</td><td className="p-3 text-blue-600">{r.teacher_name||'-'}</td><td className="p-3 text-red-500">{r.time_out}</td><td className="p-3 text-green-500">{r.time_in}</td><td className="p-3 text-slate-500">{r.reason||'-'}</td>{isAdmin&&<td className="p-3"><button onClick={()=>setDeleteOpen(r.id)} className="text-slate-300 hover:text-red-500 transition-colors" title="Delete record"><Trash2 className="w-4 h-4" /></button></td>}</tr>)}</tbody></table></div>}</CardContent></Card>

      <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}><DialogContent><DialogHeader><DialogTitle>Sign Out Learner</DialogTitle></DialogHeader><div className="space-y-3 pt-2">
        <Input placeholder="Search learner..." value={studentSearch} onChange={e=>setStudentSearch(e.target.value)} />
        {studentSearch && <div className="max-h-32 overflow-y-auto border rounded-md">{fs.slice(0,8).map(s=><button key={s.id} onClick={()=>{setSelectedStudent(s);setStudentSearch('')}} className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b">{s.surname}, {s.name}</button>)}</div>}
        {selectedStudent && <div className="flex items-center gap-2 p-2 bg-orange-50 rounded text-sm font-medium"><DoorOpen className="w-4 h-4 text-orange-500" />{selectedStudent.surname}, {selectedStudent.name}<button onClick={()=>setSelectedStudent(null)} className="ml-auto text-slate-400 text-xs">clear</button></div>}
        <select value={formClass} onChange={e=>setFormClass(e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm bg-white"><option value="">Class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <Input type="number" placeholder="Period (optional)" value={formPeriod} onChange={e=>setFormPeriod(e.target.value)} />
        <div><label className="text-xs font-medium text-slate-500 mb-1.5 block">Going to teacher (optional)</label><select value={formTeacher} onChange={e=>setFormTeacher(e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm bg-white"><option value="">Select teacher...</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.display_name}</option>)}</select></div>
        <div><label className="text-xs font-medium text-slate-500 mb-1.5 block">Reason</label><div className="flex flex-wrap gap-1.5">{QUICK_REASONS.map(q=><button key={q} onClick={()=>setFormReason(formReason===q?'':q)} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${formReason===q?'border-orange-400 bg-orange-50 text-orange-700':'border-slate-200 bg-white text-slate-600 hover:border-orange-200'}`}>{q}</button>)}</div></div>
        <Button onClick={signOut} disabled={submitting||!selectedStudent||!formClass} className="w-full" style={{background:'#F97316'}}>{submitting?<Loader2 className="w-4 h-4 animate-spin" />:'Sign Out'}</Button>
        <Button variant="outline" onClick={()=>setSignOutOpen(false)} className="w-full">Cancel</Button>
      </div></DialogContent></Dialog>

      <Dialog open={!!deleteOpen} onOpenChange={(o)=>!o&&setDeleteOpen(null)}><DialogContent><DialogHeader><DialogTitle>Delete Leave Record</DialogTitle></DialogHeader><div className="space-y-4 pt-2"><p className="text-sm text-slate-600">Are you sure you want to delete this leave register entry? This cannot be undone.</p><div className="flex gap-2"><Button onClick={()=>deleteOpen&&deleteRecord(deleteOpen)} disabled={deleting} className="flex-1" style={{background:'#EF4444'}}>{deleting?<Loader2 className="w-4 h-4 animate-spin" />:'Delete'}</Button><Button variant="outline" onClick={()=>setDeleteOpen(null)} className="flex-1">Cancel</Button></div></div></DialogContent></Dialog>
    </div>
  )
}
















