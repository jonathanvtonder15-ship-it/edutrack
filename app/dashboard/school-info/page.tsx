'use client'

import { useLoadEffect } from '@/hooks/use-load-effect'
import { useCallback, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Users, GraduationCap, BookOpen, Clock } from 'lucide-react'

export default function SchoolInfoPage(){
  const user=useAppStore(s=>s.user)
  const [school,setSchool]=useState<{name:string;timetable_type:string;periods_per_day:number;school_start?:string;school_end?:string}|null>(null)
  const [stats,setStats]=useState({students:0,classes:0,teachers:0,subjects:0})
  const [loading,setLoading]=useState(true)

  const load = useCallback(async () => {
    if(!user)return
    const [sR,stR,cR,tR,subR]=await Promise.all([
      supabase.from('schools').select('*').eq('id',user.school_id).single(),
      supabase.from('students').select('id',{count:'exact',head:true}).eq('school_id',user.school_id),
      supabase.from('classes').select('id',{count:'exact',head:true}).eq('school_id',user.school_id),
      supabase.from('users').select('id',{count:'exact',head:true}).eq('school_id',user.school_id),
      supabase.from('subjects').select('id',{count:'exact',head:true}).eq('school_id',user.school_id),
    ])
    if(sR.data)setSchool(sR.data)
    setStats({students:stR.count||0,classes:cR.count||0,teachers:tR.count||0,subjects:subR.count||0})
    setLoading(false)
  }, [user])

  useLoadEffect(load)

  if(loading)return<div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
  if(!school)return null
  const hasTimes = school.school_start || school.school_end
  return(
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">{school.name}</h2>
        <p className="text-slate-500">{school.timetable_type==='10-day'?'10-Day Cycle':'5-Day'} | {school.periods_per_day} periods</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[{label:'Students',value:stats.students,icon:Users,color:'#2563EB'},{label:'Classes',value:stats.classes,icon:GraduationCap,color:'#8B5CF6'},{label:'Staff',value:stats.teachers,icon:Users,color:'#10B981'},{label:'Subjects',value:stats.subjects,icon:BookOpen,color:'#F97316'}].map(s=>(
          <Card key={s.label} className="border-0 shadow-sm"><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:s.color+'15'}}><s.icon className="w-5 h-5" style={{color:s.color}} /></div><div><p className="text-2xl font-bold text-slate-800">{s.value}</p><p className="text-xs text-slate-500">{s.label}</p></div></div></CardContent></Card>
        ))}
      </div>
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-blue-500" />School Times</CardTitle></CardHeader>
        <CardContent>
          {!hasTimes
            ? <p className="text-sm text-slate-400">School times have not been set yet. An admin can set them in Settings.</p>
            : <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><Clock className="w-5 h-5 text-blue-600" /></div>
                  <div><p className="text-xs text-slate-500">School Starts</p><p className="text-lg font-bold text-slate-800">{school.school_start||'-'}</p></div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"><Clock className="w-5 h-5 text-green-600" /></div>
                  <div><p className="text-xs text-slate-500">School Ends</p><p className="text-lg font-bold text-slate-800">{school.school_end||'-'}</p></div>
                </div>
              </div>
          }
        </CardContent>
      </Card>
    </div>
  )
}

