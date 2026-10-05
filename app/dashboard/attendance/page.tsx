'use client'

import { useLoadEffect } from '@/hooks/use-load-effect'
import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { saveAttendance, type AttendanceRecord } from '@/lib/attendance'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Loader2, Check, X, Clock, Save, Trophy, Printer, MessageSquare } from 'lucide-react'

interface SA { student_id: string; name: string; surname: string; photo_url: string | null; status: 'present' | 'absent' | 'late' | 'sport' | null; note?: string | null }

export default function AttendancePage() {
  const user = useAppStore((s) => s.user)
  const [ac, setAc] = useState<Array<{id:string;name:string;grade:number}>>([])
  const [sc, setSc] = useState('')
  const [sp, setSp] = useState(1)
  const [students, setStudents] = useState<SA[]>([])
  const [ppd, setPpd] = useState(8)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [isOnline, setIsOnline] = useState(true)
  const [pendingSync, setPendingSync] = useState(0)
  const [focusIdx, setFocusIdx] = useState(0)
  const [noteOpen, setNoteOpen] = useState<string|null>(null)
  const [noteText, setNoteText] = useState('')
  const [printOpen, setPrintOpen] = useState(false)
  const [printCols, setPrintCols] = useState(0)
  const [printDate, setPrintDate] = useState(new Date().toISOString().split('T')[0])
  const today = new Date().toISOString().split('T')[0]

  const syncOff = useCallback(async () => {
    if (!user) return
    const pending: Array<{ records: AttendanceRecord[] }> = JSON.parse(localStorage.getItem('edutrack_offline_attendance') || '[]')
    for (let i = 0; i < pending.length; i++) {
      const batch = pending[i]
      if (!batch.records.length || batch.records.some(record => record.school_id !== user.school_id || record.marked_by !== user.id)) continue
      try {
        await saveAttendance(supabase, batch.records)
        pending.splice(i--, 1)
        localStorage.setItem('edutrack_offline_attendance', JSON.stringify(pending))
        setPendingSync(pending.length)
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Could not sync attendance. Your offline records are retained.')
        return
      }
    }
  }, [user])

  const loadStudents = useCallback(async (cid:string,period:number) => {
    if(!user)return
    setSc(cid);setSp(period);setSaved(false);setFocusIdx(0)
    const{data:cs}=await supabase.from('class_students').select('student_id,students(id,name,surname,photo_url)').eq('class_id',cid).limit(500)
    const{data:ex}=await supabase.from('attendance').select('student_id,status,note').eq('class_id',cid).eq('date',today).eq('period',period)
    const am=new Map<string,string>()
    const nm=new Map<string,string>()
    ;(ex||[]).forEach((a:{student_id:string;status:string;note?:string|null})=>{am.set(a.student_id,a.status);if(a.note)nm.set(a.student_id,a.note)})
    setStudents((cs||[]).map((c:Record<string,unknown>)=>{const s=c.students as{id:string;name:string;surname:string;photo_url:string|null};return{student_id:s.id,name:s.name,surname:s.surname,photo_url:s.photo_url,status:(am.get(s.id) as SA['status'])||null,note:nm.get(s.id)||null}}).sort((a:SA,b:SA)=>a.surname.localeCompare(b.surname)))
  }, [user, today])

  const loadInit = useCallback(async () => {
    if(!user)return
    const{data:s}=await supabase.from('schools').select('periods_per_day').eq('id',user.school_id).single()
    if(s)setPpd(s.periods_per_day)
    if(user.role==='admin'||user.role==='admin-teacher'){
      const{data}=await supabase.from('classes').select('id,name,grade').eq('school_id',user.school_id).order('grade').order('name')
      setAc(data||[])
    }else{
      const{data}=await supabase.from('allocations').select('class_id,classes(id,name,grade)').eq('user_id',user.id)
      const m=new Map<string,{id:string;name:string;grade:number}>()
      ;(data||[]).forEach((a:Record<string,unknown>)=>{const c=a.classes as{id:string;name:string;grade:number};if(c)m.set(c.id,c)})
      setAc(Array.from(m.values()))
    }
    const lastCid = typeof window !== 'undefined' ? sessionStorage.getItem('edutrack_last_class') : null
    if (lastCid) { const initialPeriod = Number(localStorage.getItem('edutrack_default_period')) || 1; await loadStudents(lastCid, initialPeriod) }
    setLoading(false)
  }, [user, loadStudents])

  const quickMark = useCallback((st:'present'|'absent'|'late'|'sport') => {
    if(students.length===0||!sc)return
    const unmarked = students.filter(s=>!s.status)
    if(unmarked.length===0)return
    const sid = unmarked[0].student_id
    setStudents(students.map(s=>s.student_id===sid?{...s,status:st}:s))
    setSaved(false)
    const nextUnmarked = students.findIndex(s=>s.student_id===sid)
    setFocusIdx(nextUnmarked >= 0 ? nextUnmarked : 0)
  }, [students, sc])

  const markedCount = students.filter(s=>s.status).length
  const presentCount = students.filter(s=>s.status==='present').length
  const absentCount = students.filter(s=>s.status==='absent').length
  const lateCount = students.filter(s=>s.status==='late').length
  const sportCount = students.filter(s=>s.status==='sport').length
  const pct = students.length > 0 ? Math.round((markedCount/students.length)*100) : 0

  function setStatus(sid:string,st:'present'|'absent'|'late'|'sport'){
    setStudents(students.map(s=>s.student_id===sid?{...s,status:st}:s))
    setSaved(false)
  }

  function markAll(){setStudents(students.map(s=>({...s,status:s.status||'present'})));setSaved(false)}

  function firstUnmarked(){ const idx = students.findIndex(s=>!s.status); return idx >= 0 ? idx : 0 }

  async function saveAtt(){
    if(!user)return
    setSaving(true); setSaved(false); setSaveError('')
    const recs=students.filter(s=>s.status).map(s=>({student_id:s.student_id,class_id:sc,date:today,period:sp,status:s.status!,marked_by:user.id,school_id:user.school_id,note:s.note||null}))
    if(!navigator.onLine){
      const p=JSON.parse(localStorage.getItem('edutrack_offline_attendance')||'[]')
      p.push({class_id:sc,date:today,period:sp,records:recs})
      localStorage.setItem('edutrack_offline_attendance',JSON.stringify(p))
      setPendingSync(p.length); setSaving(false); return
    }
    try{
      await saveAttendance(supabase, recs)
      if(sp===1){
        const absentIds=students.filter(s=>s.status==='absent').map(s=>s.student_id)
        const presentLateIds=students.filter(s=>s.status==='present'||s.status==='late'||s.status==='sport').map(s=>s.student_id)
        const [,{data:otherClasses},{data:existingAll},{data:school}]=await Promise.all([
          presentLateIds.length>0?supabase.from('attendance').delete().eq('date',today).eq('school_id',user.school_id).eq('status','absent').eq('marked_by',user.id).in('student_id',presentLateIds).in('period',Array.from({length:ppd},(_,i)=>i+1).filter(p=>p>sp)).throwOnError():Promise.resolve(null),
          absentIds.length>0?supabase.from('class_students').select('class_id,student_id').in('student_id',absentIds).limit(5000).throwOnError():Promise.resolve({data:[]}),
          absentIds.length>0?supabase.from('attendance').select('student_id,period').eq('date',today).in('student_id',absentIds).in('period',Array.from({length:ppd-1},(_,i)=>i+2)).throwOnError():Promise.resolve({data:[]}),
          supabase.from('schools').select('periods_per_day').eq('id',user.school_id).single().throwOnError()
        ] as const)
        const ppdVal = (school as {periods_per_day:number})?.periods_per_day || ppd
        const existingSet=new Set((existingAll||[]).map((e:{student_id:string;period:number})=>`${e.student_id}_${e.period}`))
        const inserts:Array<{student_id:string;class_id:string;date:string;period:number;status:string;marked_by:string;school_id:string}>=[]
        for(const cs of otherClasses||[]){const sid=cs.student_id as string;for(let p2=2;p2<=ppdVal;p2++){if(!existingSet.has(`${sid}_${p2}`)){ inserts.push({student_id:sid,class_id:cs.class_id as string,date:today,period:p2,status:'absent',marked_by:user.id,school_id:user.school_id}); existingSet.add(`${sid}_${p2}`) }}}
        if(inserts.length>0) await saveAttendance(supabase, inserts)
      }
      setSaved(true)
    }catch(e){ console.error('saveAtt error:',e); setSaved(false); setSaveError(e instanceof Error ? e.message : 'Could not save attendance') }
    setSaving(false)
  }

  async function saveNote(){
    if(!user||!noteOpen)return
    const { data:existing } = await supabase.from('attendance').select('id').eq('class_id',sc).eq('date',today).eq('period',sp).eq('student_id',noteOpen).maybeSingle()
    if(existing){ await supabase.from('attendance').update({note:noteText||null}).eq('id',existing.id) }
    else { await supabase.from('attendance').insert({student_id:noteOpen,class_id:sc,date:today,period:sp,status:'present',note:noteText||null,marked_by:user.id,school_id:user.school_id}) }
    setStudents(students.map(s=>s.student_id===noteOpen?{...s,note:noteText||null}:s))
    setNoteOpen(null); setNoteText(''); setSaved(false)
  }

  function openPrintDialog(){
    setPrintCols(0)
    setPrintDate(today)
    setPrintOpen(true)
  }

  function doPrintBlank(){
    const cls = ac.find(c=>c.id===sc)
    const nameHeader = '<th style="width:200px">Name</th>'
    const extraHeaders = Array.from({length:printCols},(_,i)=>`<th style="width:90px">Col ${i+1}</th>`).join('')
    const rows = students.map(s=>`<tr><td>${s.surname}, ${s.name}</td>${Array.from({length:printCols},()=>'<td></td>').join('')}</tr>`).join('')
    const html = `<!DOCTYPE html><html><head><title>Blank Register — ${cls?.name||'Class'}</title><style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:18px;margin:0}h2{font-size:14px;color:#555;margin:4px 0 16px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #333;padding:8px;text-align:left}th{background:#f1f5f9;text-align:center}.num{width:28px}@media print{@page{margin:1cm}}</style></head><body><h1>${cls?.name||'Class'} — Blank Register</h1><h2>Date: ${printDate} · ${students.length} learners · ${printCols} extra blank columns</h2><table><thead><tr><th class="num">#</th>${nameHeader}${extraHeaders}</tr></thead><tbody>${rows.split('</tr>').map((r,i)=>r+'</tr>').join('')}</tbody></table></body></html>`
    const w = window.open('','_blank')
    if(w){ w.document.write(html); w.document.close(); w.setTimeout(()=>w.print(),400) }
    setPrintOpen(false)
  }

  useEffect(() => { const timer=setTimeout(()=>{setIsOnline(navigator.onLine);setPendingSync(JSON.parse(localStorage.getItem('edutrack_offline_attendance')||'[]').length)},0); const on=()=>{setIsOnline(true);syncOff()}; const off=()=>setIsOnline(false); window.addEventListener('online',on); window.addEventListener('offline',off); return ()=>{clearTimeout(timer);window.removeEventListener('online',on);window.removeEventListener('offline',off)} }, [syncOff])
  useLoadEffect(loadInit)
  useEffect(()=>{
    if(!sc||students.length===0)return
    function onKey(e:KeyboardEvent){
      if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement)return
      if(e.key==='1')quickMark('present')
      else if(e.key==='2')quickMark('absent')
      else if(e.key==='3')quickMark('late')
      else if(e.key==='4')quickMark('sport')
    }
    window.addEventListener('keydown',onKey)
    return ()=>window.removeEventListener('keydown',onKey)
  },[quickMark, sc, students])

  if(loading)return<div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>

  return(
    <div className="space-y-4">
      {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
      {!isOnline&&<div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm font-medium"><div className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" />Offline. Saved locally.</div>}
      {isOnline&&pendingSync>0&&<div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm"><span>{pendingSync} pending</span><Button size="sm" onClick={syncOff} style={{background:'#2563EB'}}>Sync</Button></div>}

      <Card className="border-0 shadow-sm"><CardContent className="pt-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1"><label className="text-sm font-medium text-slate-700 mb-1.5 block">Class</label><select value={sc} onChange={e=>{if(e.target.value)loadStudents(e.target.value,sp)}} className="w-full h-10 px-3 rounded-md border text-sm bg-white"><option value="">Choose...</option>{ac.map(c=><option key={c.id} value={c.id}>{c.name} (Gr {c.grade})</option>)}</select></div>
          <div className="w-full sm:w-40"><label className="text-sm font-medium text-slate-700 mb-1.5 block">Period</label><select value={sp} onChange={e=>{const p=parseInt(e.target.value);if(sc)loadStudents(sc,p);else setSp(p)}} className="w-full h-10 px-3 rounded-md border text-sm bg-white">{Array.from({length:ppd},(_,i)=>i+1).map(p=><option key={p} value={p}>Period {p}</option>)}</select></div>
          <div className="flex items-end"><p className="text-sm text-slate-500 pb-2">{today}</p></div>
        </div>
      </CardContent></Card>

      {sc && students.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">{markedCount}/{students.length} marked <span className="text-slate-400">({pct}%)</span></span>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /><span className="text-slate-600 font-medium">{presentCount}</span></span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /><span className="text-slate-600 font-medium">{absentCount}</span></span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" /><span className="text-slate-600 font-medium">{lateCount}</span></span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /><span className="text-slate-600 font-medium">{sportCount} sport</span></span>
              {markedCount < students.length && <span className="text-amber-600 font-semibold">{students.length - markedCount} unmarked</span>}
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-300" style={{width:`${pct}%`,background:pct===100?'#10B981':'#2563EB'}} /></div>
          {pct === 100 && <p className="text-xs text-green-600 font-medium text-center">✓ All learners marked — ready to save</p>}
          <p className="text-xs text-slate-400 text-center">⌘ Keys: <kbd className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">1</kbd> Present · <kbd className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">2</kbd> Absent · <kbd className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">3</kbd> Late · <kbd className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">4</kbd> Sport</p>
        </div>
      )}

      {sc&&students.length>0&&<Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="text-lg">Register <span className="text-sm font-normal text-slate-500">({students.length})</span></CardTitle>
          <div className="flex gap-2 w-full sm:w-auto flex-wrap">
            <Button size="sm" variant="outline" onClick={openPrintDialog} className="flex-1 sm:flex-none"><Printer className="w-4 h-4 mr-1" />Print</Button>
            <Button size="sm" variant="outline" onClick={markAll} className="flex-1 sm:flex-none">All Present</Button>
            <Button size="sm" onClick={saveAtt} disabled={saving&&saved} className="flex-1 sm:flex-none" style={{background:saved?'#10B981':'#2563EB'}}>
              {saving&&!saved?<Loader2 className="w-4 h-4 animate-spin mr-1" />:saved?<Check className="w-4 h-4 mr-1" />:<Save className="w-4 h-4 mr-1" />}
              {saved?'Saved!':'Save'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {students.map((s,i)=>{
              const isFocused = i===focusIdx&&!s.status
              return <div key={s.student_id} className={`flex items-center justify-between p-3 rounded-lg ${s.status==='present'?'bg-green-50':s.status==='absent'?'bg-red-50':s.status==='late'?'bg-yellow-50':s.status==='sport'?'bg-blue-50':`bg-amber-50 border ${isFocused?'border-blue-400 border-2':'border-amber-200'}`}`}>
                <div className="flex items-center gap-3">
                  {s.photo_url?<img src={s.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />:<div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">{s.name.charAt(0)}{s.surname.charAt(0)}</div>}
                  <div><span className="font-medium text-slate-800 text-sm">{s.surname}, {s.name}</span>{!s.status&&<span className="ml-2 text-xs text-amber-600 font-medium">not marked</span>}{s.note&&<span className="block text-xs text-slate-500 italic mt-0.5">Note: {s.note}</span>}</div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={()=>{setNoteOpen(s.student_id);setNoteText(s.note||'')}} className={`w-11 h-11 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center ${s.note?'bg-indigo-500 text-white':'bg-white border text-slate-400 hover:border-indigo-400'}`} title="Add note"><MessageSquare className="w-5 h-5 sm:w-4 sm:h-4" /></button>
                  <button onClick={()=>setStatus(s.student_id,'present')} className={`w-11 h-11 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center ${s.status==='present'?'bg-green-500 text-white':'bg-white border text-slate-400 hover:border-green-400'}`} title="Present (1)"><Check className="w-5 h-5 sm:w-4 sm:h-4" /></button>
                  <button onClick={()=>setStatus(s.student_id,'absent')} className={`w-11 h-11 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center ${s.status==='absent'?'bg-red-500 text-white':'bg-white border text-slate-400 hover:border-red-400'}`} title="Absent (2)"><X className="w-5 h-5 sm:w-4 sm:h-4" /></button>
                  <button onClick={()=>setStatus(s.student_id,'late')} className={`w-11 h-11 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center ${s.status==='late'?'bg-yellow-500 text-white':'bg-white border text-slate-400 hover:border-yellow-400'}`} title="Late (3)"><Clock className="w-5 h-5 sm:w-4 sm:h-4" /></button>
                  <button onClick={()=>setStatus(s.student_id,'sport')} className={`w-11 h-11 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center ${s.status==='sport'?'bg-blue-500 text-white':'bg-white border text-slate-400 hover:border-blue-400'}`} title="Sport (4)"><Trophy className="w-5 h-5 sm:w-4 sm:h-4" /></button>
                </div>
              </div>
            })}
          </div>
        </CardContent>
      </Card>}

      {sc&&students.length===0&&<Card className="border-0 shadow-sm"><CardContent className="py-12 text-center text-slate-400">No students in this class.</CardContent></Card>}

      {sc&&students.length>0&&<div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t shadow-lg sm:hidden z-40"><div className="flex gap-2"><Button size="sm" variant="outline" onClick={markAll} className="flex-1 h-12 text-base">All Present</Button><Button size="sm" onClick={saveAtt} disabled={saving&&saved} className="flex-1 h-12 text-base" style={{background:saved?'#10B981':'#2563EB'}}>{saving&&!saved?<Loader2 className="w-5 h-5 animate-spin mr-2" />:saved?<Check className="w-5 h-5 mr-2" />:<Save className="w-5 h-5 mr-2" />}{saved?'Saved!':'Save'}</Button></div></div>}

      {/* Note dialog */}
      <Dialog open={!!noteOpen} onOpenChange={(o)=>!o&&setNoteOpen(null)}>
        <DialogContent><DialogHeader><DialogTitle>Attendance Note</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Input placeholder="e.g. Doctor's note" value={noteText} onChange={e=>setNoteText(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={saveNote} className="flex-1" style={{background:'#4F46E5'}}>Save Note</Button>
              <Button variant="outline" onClick={()=>{setNoteOpen(null);setNoteText('')}} className="flex-1">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print setup dialog */}
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent><DialogHeader><DialogTitle>Print Blank Register</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-slate-500">{students.length} learners will be listed with their names. Add extra blank columns for teachers to fill in by hand.</p>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Date on the register</label>
              <input type="date" value={printDate} onChange={e=>setPrintDate(e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm bg-white" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">How many extra blank columns?</label>
              <div className="flex gap-2">{['0','1','2','3','4','5','6','8','10'].map(n=><button key={n} onClick={()=>setPrintCols(parseInt(n))} className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${printCols===parseInt(n)?'border-blue-500 bg-blue-50 text-blue-700':'border-slate-200 text-slate-600 hover:border-blue-300'}`}>{n}</button>)}</div>
            </div>
            <div className="flex gap-2">
              <Button onClick={doPrintBlank} className="flex-1" style={{background:'#2563EB'}}><Printer className="w-4 h-4 mr-2" />Print</Button>
              <Button variant="outline" onClick={()=>setPrintOpen(false)} className="flex-1">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

