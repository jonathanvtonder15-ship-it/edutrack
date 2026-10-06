'use client'

import { useLoadEffect } from '@/hooks/use-load-effect'
import { useCallback, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, ClipboardCheck, AlertTriangle, Calendar, DoorOpen, Award } from 'lucide-react'
import Link from 'next/link'

function SkeletonCard(){
  return <div className="animate-pulse border-0 shadow-sm rounded-xl bg-white"><div className="pt-5 pb-4 px-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-slate-200" /><div className="space-y-2 flex-1"><div className="h-5 w-12 bg-slate-200 rounded" /><div className="h-3 w-20 bg-slate-100 rounded" /></div></div></div>
}

interface DashboardStats { totalStudents: number; totalClasses: number; todayAttendance: number; totalDemerits: number; totalMerits: number; pendingBatting: number; leaveOut: number }

export default function DashboardPage() {
  const user = useAppStore((s) => s.user)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [allocations, setAllocations] = useState<Array<{ class_id: string; class_name: string; grade: number; subject_name: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [todayAbsent, setTodayAbsent] = useState<Array<{name:string;surname:string;status:string}>>([])
  const [todayStats, setTodayStats] = useState({present:0, absent:0, late:0})

  const loadDashboard = useCallback(async () => {
    if (!user) return
    try {
      const [studentsRes, classesRes, attendanceRes, demeritsRes, meritsRes, battingRes, leaveRes] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', user.school_id),
        supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', user.school_id),
        supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('school_id', user.school_id).eq('date', new Date().toISOString().split('T')[0]),
        supabase.from('demerits').select('id', { count: 'exact', head: true }).eq('school_id', user.school_id),
        supabase.from('merits').select('id', { count: 'exact', head: true }).eq('school_id', user.school_id),
        supabase.from('batting').select('id', { count: 'exact', head: true }).eq('school_id', user.school_id).eq('status', 'pending'),
        supabase.from('leave_register').select('id', { count: 'exact', head: true }).eq('school_id', user.school_id).is('time_in', null),
      ])
      setStats({ totalStudents: studentsRes.count||0, totalClasses: classesRes.count||0, todayAttendance: attendanceRes.count||0, totalDemerits: demeritsRes.count||0, totalMerits: meritsRes.count||0, pendingBatting: battingRes.count||0, leaveOut: leaveRes.count||0 })

      if (user.role === 'admin' || user.role === 'admin-teacher') {
        const today = new Date().toISOString().split('T')[0]
        const { data: todayRecs } = await supabase.from('attendance').select('student_id, status, students(name, surname)').eq('school_id', user.school_id).eq('date', today).in('status', ['absent','late']).order('student_id').limit(500)
        const { count: presentCount } = await supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('school_id', user.school_id).eq('date', today).eq('status', 'present')
        const all = todayRecs || []
        setTodayStats({ present: presentCount||0, absent: all.filter((r: Record<string,unknown>) => r.status === 'absent').length, late: all.filter((r: Record<string,unknown>) => r.status === 'late').length })
        // Dedupe absent/late learners: a learner absent in one class is auto-marked absent
        // across all their classes/periods, so collapse to ONE row per learner.
        const seen = new Set<string>()
        const abs = all.filter((r: Record<string,unknown>) => r.status === 'absent' || r.status === 'late').reduce((acc: Array<{name:string;surname:string;status:string}>, r: Record<string, unknown>) => {
          const sid = r.student_id as string
          if (seen.has(sid)) return acc
          seen.add(sid)
          acc.push({ name: (r.students as {name:string})?.name || '', surname: (r.students as {surname:string})?.surname || '', status: r.status as string })
          return acc
        }, [])
        setTodayAbsent(abs)
      }

      if (user.role === 'teacher' || user.role === 'smt' || user.role === 'admin-teacher') {
        const { data: allocs } = await supabase.from('allocations').select('class_id, classes(name, grade), subjects(name)').eq('user_id', user.id)
        if (allocs) { setAllocations(allocs.map((a: Record<string, unknown>) => ({ class_id: a.class_id as string, class_name: (a.classes as { name: string })?.name || '', grade: (a.classes as { grade: number })?.grade || 0, subject_name: (a.subjects as { name: string })?.name || null }))) }
      }
    } catch (err) { console.error('Dashboard load error:', err) } finally { setLoading(false) }
  }, [user])

  useLoadEffect(loadDashboard)

  if (!user) return null

  const statCards = [
    { label: 'Total Students', value: stats?.totalStudents || 0, icon: Users, color: '#2563EB', href: '/dashboard/students' },
    { label: 'Classes', value: stats?.totalClasses || 0, icon: Calendar, color: '#8B5CF6', href: '/dashboard/classes' },
    { label: "Today's Attendance", value: stats?.todayAttendance || 0, icon: ClipboardCheck, color: '#10B981', href: '/dashboard/register?view=attendance' },
    { label: 'Total Demerits', value: stats?.totalDemerits || 0, icon: AlertTriangle, color: '#F59E0B', href: '/dashboard/conduct?view=demerits' },
    { label: 'Total Merits', value: stats?.totalMerits || 0, icon: Award, color: '#10B981', href: '/dashboard/conduct?view=merits' },
    { label: 'Pending Relief', value: stats?.pendingBatting || 0, icon: Calendar, color: '#EF4444', href: '/dashboard/register?view=batting' },
    { label: 'Learners Out', value: stats?.leaveOut || 0, icon: DoorOpen, color: '#F97316', href: '/dashboard/leave-register' },
  ]

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-slate-800">Welcome back, {user.display_name}</h2><p className="text-slate-500 mt-1">{user.school_name} &mdash; {new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p></div>

      {/* Today's attendance pulse bar */}
      {(todayStats.present + todayStats.absent + todayStats.late) > 0 && (
        <div className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm border">
          <span className="text-sm font-semibold text-slate-600">Today</span>
          <div className="flex items-center gap-1 flex-1">
            <div className="h-2.5 rounded-l-full bg-green-400 transition-all" style={{width:`${(todayStats.present/(todayStats.present+todayStats.absent+todayStats.late))*100}%`,minWidth:'4px'}} />
            <div className="h-2.5 bg-yellow-400 transition-all" style={{width:`${(todayStats.late/(todayStats.present+todayStats.absent+todayStats.late))*100}%`}} />
            <div className="h-2.5 rounded-r-full bg-red-400 transition-all" style={{width:`${(todayStats.absent/(todayStats.present+todayStats.absent+todayStats.late))*100}%`,minWidth:'4px'}} />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-green-600 font-bold">{todayStats.present} present</span>
            {todayStats.late > 0 && <span className="text-yellow-600 font-bold">{todayStats.late} late</span>}
            {todayStats.absent > 0 && <span className="text-red-600 font-bold">{todayStats.absent} absent</span>}
          </div>
        </div>
      )}

      {(user.role === 'admin' || user.role === 'admin-teacher') && stats && (stats.totalStudents === 0 || stats.totalClasses === 0) && (
        <Card className="border-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #EFF6FF, #F0F9FF)' }}><CardContent className="pt-5 pb-5"><h3 className="text-lg font-bold text-blue-800 mb-3">Getting Started</h3><p className="text-sm text-blue-600 mb-4">Complete these steps to set up your school:</p><div className="space-y-2">{[{done:true,label:'Create school & admin account',href:''},{done:(stats?.totalClasses||0)>0,label:'Add your classes',href:'/dashboard/classes'},{done:(stats?.totalStudents||0)>0,label:'Upload or add students',href:'/dashboard/students'},{done:false,label:'Set up your timetable',href:'/dashboard/timetable'},{done:false,label:'Configure CAPS subjects',href:'/dashboard/settings'},{done:false,label:'Add teachers & SMT staff',href:'/dashboard/users'}].map((step,i)=>step.href?<Link key={i} href={step.href} className={`flex items-center gap-3 p-2.5 rounded-lg text-sm transition-all ${step.done?'bg-green-50 text-green-700':'bg-white text-slate-700 hover:bg-blue-50 border border-blue-100'}`}><div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${step.done?'bg-green-500 text-white':'bg-blue-100 text-blue-600'}`}>{step.done?'\u2713':i+1}</div><span className={step.done?'line-through opacity-60':'font-medium'}>{step.label}</span></Link>:<div key={i} className="flex items-center gap-3 p-2.5 rounded-lg text-sm bg-green-50 text-green-700"><div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-green-500 text-white">\u2713</div><span className="line-through opacity-60">{step.label}</span></div>)}</div></CardContent></Card>
      )}

      {/* Stats — skeleton or data */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {loading ? Array.from({length:7}).map((_,i)=><SkeletonCard key={i} />) : statCards.map((stat) => (<Link key={stat.label} href={stat.href} className="group"><Card className="border-0 shadow-sm hover:shadow-md transition-shadow"><CardContent className="pt-4 pb-3 px-3"><div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: stat.color + '15' }}><stat.icon className="w-4 h-4" style={{ color: stat.color }} /></div><div><p className="text-xl font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">{stat.value}</p><p className="text-[11px] text-slate-500">{stat.label}</p></div></div></CardContent></Card></Link>))}
      </div>

      {(user.role === 'admin' || user.role === 'admin-teacher') && !loading && todayAbsent.length > 0 && (
        <Card className="border-0 shadow-sm border-l-4" style={{ borderLeftColor: '#EF4444' }}><CardHeader><CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-500" /> Today&apos;s Absent &amp; Late ({todayAbsent.length})</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-slate-50"><th className="text-left p-3 font-medium text-slate-600">Learner</th><th className="text-left p-3 font-medium text-slate-600">Status</th></tr></thead><tbody>{todayAbsent.map((r,i)=>(<tr key={i} className="border-b hover:bg-slate-50"><td className="p-3 font-medium text-slate-800">{r.surname}, {r.name}</td><td className="p-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status==='absent'?'bg-red-100 text-red-700':'bg-yellow-100 text-yellow-700'}`}>{r.status.toUpperCase()}</span></td></tr>))}</tbody></table></div></CardContent></Card>
      )}

      {(user.role === 'teacher' || user.role === 'smt' || user.role === 'admin-teacher') && allocations.length > 0 && (
        <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-lg">Your Allocated Classes</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{allocations.map((alloc,i)=>(<Link key={i} href="/dashboard/register?view=attendance" onClick={()=>{ if(typeof window!=='undefined') sessionStorage.setItem('edutrack_last_class', alloc.class_id) }} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-blue-50 transition-colors"><div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><span className="text-blue-600 font-bold text-sm">{alloc.grade}</span></div><div><p className="font-semibold text-slate-800">{alloc.class_name}</p>{alloc.subject_name && <p className="text-sm text-slate-500">{alloc.subject_name}</p>}</div></Link>))}</div></CardContent></Card>
      )}

      <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-lg">Quick Actions</CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[
          {label:'Take Attendance',sub:'Mark class register',href:'/dashboard/register?view=attendance',icon:ClipboardCheck,color:'#10B981'},
          {label:'Give Demerit',sub:'Record an infraction',href:'/dashboard/conduct?view=demerits',icon:AlertTriangle,color:'#F59E0B'},
          {label:'Give Merit',sub:'Reward good behaviour',href:'/dashboard/conduct?view=merits',icon:Award,color:'#10B981'},
          {label:'Leave Register',sub:'Sign learner out/in',href:'/dashboard/leave-register',icon:DoorOpen,color:'#F97316'},
        ].map(a=>(<Link key={a.label} href={a.href} className="flex flex-col items-start gap-3 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-95 transition-all border hover:border-slate-200"><div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{background:a.color+'20'}}><a.icon className="w-6 h-6" style={{color:a.color}} /></div><div><p className="font-semibold text-slate-800 text-sm">{a.label}</p><p className="text-xs text-slate-400 mt-0.5">{a.sub}</p></div></Link>))}</div></CardContent></Card>
    </div>
  )
}

