'use client'

import { useLoadEffect } from '@/hooks/use-load-effect'
import { useCallback, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { filterRecipients } from '@/lib/notifications'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Plus, UserCheck, AlertCircle } from 'lucide-react'
export default function BattingPage(){
  const user=useAppStore(s=>s.user)
  const [records,setRecords]=useState<Array<{id:string;date:string;period_number:number;class_name:string;absent_teacher:string;replacement_teacher:string|null;status:string}>>([])
  const [loading,setLoading]=useState(true)
  const [declareOpen,setDeclareOpen]=useState(false)
  const [allocateOpen,setAllocateOpen]=useState<string|null>(null)
  const [classes,setClasses]=useState<Array<{id:string;name:string}>>([])
  const [teachers,setTeachers]=useState<Array<{id:string;display_name:string}>>([])
  const [formDate,setFormDate]=useState(new Date().toISOString().split('T')[0])
  const [formPeriods,setFormPeriods]=useState<number[]>([])
  const [formClass,setFormClass]=useState('')
  const [formReplacement,setFormReplacement]=useState('')
  const [ppd,setPpd]=useState(8)
  const [submitting,setSubmitting]=useState(false)

  const load = useCallback(async () => {if(!user)return;const[bR,cR,tR,sR]=await Promise.all([supabase.from('batting').select('*,classes(name),absent:users!batting_absent_teacher_id_fkey(display_name),replacement:users!batting_replacement_teacher_id_fkey(display_name)').eq('school_id',user.school_id).order('date',{ascending:false}).order('period_number'),supabase.from('classes').select('id,name').eq('school_id',user.school_id),supabase.from('users').select('id,display_name').eq('active', true).eq('school_id',user.school_id).in('role',['teacher','smt','admin-teacher']),supabase.from('schools').select('periods_per_day').eq('id',user.school_id).single()]);setRecords((bR.data||[]).map((b:Record<string,unknown>)=>({id:b.id as string,date:b.date as string,period_number:b.period_number as number,class_name:(b.classes as{name:string})?.name||'',status:b.status as string,absent_teacher:(b.absent as{display_name:string})?.display_name||'',replacement_teacher:(b.replacement as{display_name:string})?.display_name||null})));if(cR.data)setClasses(cR.data);if(tR.data)setTeachers(tR.data);if(sR.data)setPpd(sR.data.periods_per_day);setLoading(false)}, [user])

  async function declareAbsence(){if(!user||!formClass||!formPeriods.length)return;setSubmitting(true);await supabase.from('batting').insert(formPeriods.map(p=>({absent_teacher_id:user.id,date:formDate,period_number:p,class_id:formClass,school_id:user.school_id,status:'pending'})));await load();setDeclareOpen(false);setFormPeriods([]);setFormClass('');setSubmitting(false)}
  async function allocateReplacement(bid:string){if(!formReplacement||!user)return;await supabase.from('batting').update({replacement_teacher_id:formReplacement,status:'allocated'}).eq('id',bid);const rec=records.find(r=>r.id===bid);const replacement=teachers.find(t=>t.id===formReplacement);const recipIds=new Set<string>();if(formReplacement)recipIds.add(formReplacement);const{data:staff}=await supabase.from('users').select('id').eq('active', true).eq('school_id',user.school_id).in('role',['admin','smt','admin-teacher']);(staff||[]).forEach((u:{id:string})=>{if(u.id!==formReplacement)recipIds.add(u.id)});if(recipIds.size>0&&replacement){const filtered=await filterRecipients(Array.from(recipIds),'batting');if(filtered.length>0)await supabase.from('notifications').insert(filtered.map(uid=>({user_id:uid,type:'batting',title:`Relief: ${replacement.display_name} assigned`,message:`${rec?.class_name||'Class'} | Period ${rec?.period_number||'-'} | ${rec?.absent_teacher||'Teacher'} absent on ${rec?.date||''}`,read:false,school_id:user.school_id})))}await load();setAllocateOpen(null);setFormReplacement('')}
  const canAllocate=user?.role==='admin'||user?.role==='smt'||user?.role==='admin-teacher'
  const pending=records.filter(r=>r.status==='pending')
  const allocated=records.filter(r=>r.status!=='pending')

  useLoadEffect(load)

  if(loading)return<div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
  return(<div className="space-y-4">
    <div className="flex justify-end"><Button size="sm" style={{background:'#2563EB'}} onClick={()=>setDeclareOpen(true)}><Plus className="w-4 h-4 mr-2" />Declare Absence</Button></div>
    {pending.length>0&&<Card className="border-0 shadow-sm border-l-4" style={{borderLeftColor:'#EF4444'}}><CardHeader><CardTitle className="text-lg flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-500" />Pending ({pending.length})</CardTitle></CardHeader><CardContent><div className="space-y-2">{pending.map(r=><div key={r.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg"><div><p className="font-medium text-slate-800">{r.absent_teacher} - {r.class_name}</p><p className="text-xs text-slate-500">{r.date} | Period {r.period_number}</p></div>{canAllocate&&<Button size="sm" variant="outline" onClick={()=>setAllocateOpen(r.id)}><UserCheck className="w-4 h-4 mr-1" />Allocate</Button>}</div>)}</div></CardContent></Card>}
    <Card className="border-0 shadow-sm"><CardHeader><CardTitle>History</CardTitle></CardHeader><CardContent className="p-0">{allocated.length===0?<p className="text-sm text-slate-400 p-6">No records</p>:<table className="w-full text-sm"><thead><tr className="border-b bg-slate-50"><th className="text-left p-3 font-medium text-slate-600">Date</th><th className="text-left p-3 font-medium text-slate-600">Period</th><th className="text-left p-3 font-medium text-slate-600">Class</th><th className="text-left p-3 font-medium text-slate-600">Absent</th><th className="text-left p-3 font-medium text-slate-600">Replacement</th></tr></thead><tbody>{allocated.map(r=><tr key={r.id} className="border-b"><td className="p-3 text-slate-500">{r.date}</td><td className="p-3">{r.period_number}</td><td className="p-3 font-medium">{r.class_name}</td><td className="p-3 text-red-500">{r.absent_teacher}</td><td className="p-3 text-green-600 font-medium">{r.replacement_teacher||'-'}</td></tr>)}</tbody></table>}</CardContent></Card>
    <Dialog open={declareOpen} onOpenChange={setDeclareOpen}><DialogContent><DialogHeader><DialogTitle>Declare Absence</DialogTitle></DialogHeader><div className="space-y-3 pt-2"><input type="date" value={formDate} onChange={e=>setFormDate(e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm" /><select value={formClass} onChange={e=>setFormClass(e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm bg-white"><option value="">Class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><div><label className="text-sm font-medium mb-1 block">Periods</label><div className="flex items-center gap-2 mb-2"><Button size="sm" variant="outline" type="button" onClick={()=>formPeriods.length===ppd?setFormPeriods([]):setFormPeriods(Array.from({length:ppd},(_,i)=>i+1))}>{formPeriods.length===ppd?'Deselect All':'Select All'}</Button><span className="text-xs text-slate-500">{formPeriods.length} selected</span></div><div className="flex flex-wrap gap-2">{Array.from({length:ppd},(_,i)=>i+1).map(p=><button key={p} onClick={()=>setFormPeriods(formPeriods.includes(p)?formPeriods.filter(x=>x!==p):[...formPeriods,p])} className={`w-10 h-10 rounded-lg text-sm font-medium ${formPeriods.includes(p)?'bg-blue-500 text-white':'bg-slate-100 text-slate-600'}`}>{p}</button>)}</div></div><Button onClick={declareAbsence} disabled={submitting} className="w-full" style={{background:'#2563EB'}}>{submitting?<Loader2 className="w-4 h-4 animate-spin" />:'Submit'}</Button></div></DialogContent></Dialog>
    <Dialog open={!!allocateOpen} onOpenChange={()=>setAllocateOpen(null)}><DialogContent><DialogHeader><DialogTitle>Allocate Replacement</DialogTitle></DialogHeader><div className="space-y-3 pt-2"><select value={formReplacement} onChange={e=>setFormReplacement(e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm bg-white"><option value="">Teacher</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.display_name}</option>)}</select><Button onClick={()=>allocateOpen&&allocateReplacement(allocateOpen)} disabled={!formReplacement} className="w-full" style={{background:'#10B981'}}>Allocate</Button></div></DialogContent></Dialog>
  </div>)
}

