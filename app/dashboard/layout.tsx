'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { GraduationCap, LayoutDashboard, Users, ClipboardCheck, AlertTriangle, DoorOpen, Calendar, UserCog, Settings, School, LogOut, Bell, ChevronLeft, ChevronRight, ChevronDown, ArrowLeftRight, Menu, X, MessageCircle, BookOpen, BarChart3, Award, Scale, Trash2, Megaphone, SlidersHorizontal, Activity, HeartHandshake, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview', roles: ['admin','teacher','smt','admin-teacher'] },
  { href: '/dashboard/classes', label: 'Classes', icon: BookOpen, group: 'Teaching', roles: ['admin','smt','admin-teacher'] },
  { href: '/dashboard/students', label: 'Students', icon: Users, group: 'Teaching', roles: ['admin','smt','teacher','admin-teacher'] },
  { href: '/dashboard/register', label: 'Register', icon: ClipboardCheck, group: 'Teaching', roles: ['admin','teacher','smt','admin-teacher'] },
  { href: '/dashboard/timetable', label: 'Timetable', icon: Calendar, group: 'Teaching', roles: ['admin','smt','admin-teacher'] },
  { href: '/dashboard/conduct', label: 'Conduct', icon: Scale, group: 'Discipline', roles: ['admin','teacher','smt','admin-teacher'] },
  { href: '/dashboard/leave-register', label: 'Leave Register', icon: DoorOpen, group: 'Discipline', roles: ['admin','teacher','smt','admin-teacher'] },
  { href: '/dashboard/community-service', label: 'Community Service', icon: HeartHandshake, group: 'Discipline', roles: ['admin','teacher','smt','admin-teacher'] },
  { href: '/dashboard/monitors', label: 'Monitors', icon: UsersRound, group: 'Discipline', roles: ['admin','smt','admin-teacher','monitor-guardian'] },
  { href: '/dashboard/announcements', label: 'Announcements', icon: MessageCircle, group: 'Communication', roles: ['admin','teacher','smt','admin-teacher'] },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, group: 'Admin', roles: ['admin','admin-teacher'] },
  { href: '/dashboard/attendance-tracking', label: 'Attendance Tracking', icon: Activity, group: 'Admin', roles: ['admin','smt','admin-teacher'] },
  { href: '/dashboard/users', label: 'Staff', icon: UserCog, group: 'Admin', roles: ['admin','smt','admin-teacher'] },
  { href: '/dashboard/school-info', label: 'School Info', icon: School, group: 'Admin', roles: ['teacher','admin-teacher'] },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, group: 'Admin', roles: ['admin','admin-teacher'] },
  { href: '/dashboard/preferences', label: 'Preferences', icon: SlidersHorizontal, group: 'Admin', roles: ['admin','teacher','smt','admin-teacher'] },
  { href: '/dashboard/account', label: 'My Account', icon: UserCog, group: 'Admin', roles: ['admin','teacher','smt','admin-teacher','monitor-guardian'] },
]
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAppStore()
  const [collapsed, setCollapsed] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const [notifications, setNotifications] = useState<Array<{id:string;title:string;message:string;read:boolean;created_at:string;type?:string}>>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [banner, setBanner] = useState<{id:string;title:string;message:string;created_at:string}|null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    if (!user) { router.push('/'); return }
    if (!useAppStore.getState().isSessionValid()) { logout(); router.push('/'); return }
    loadExtra()
  }, [mounted, user, router])
  async function loadExtra() {
    if (!user) return
    try {
      const { data: school } = await supabase.from('schools').select('logo_url').eq('id', user.school_id).single()
      if (school?.logo_url) setLogoUrl(school.logo_url)
      const { data: n } = await supabase.from('notifications').select('id,title,message,read,created_at,type').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
      if (n) setNotifications(n)
      const ann = (n || []).filter((x: {type?:string}) => x.type === 'announcement').sort((a: {created_at:string}, b: {created_at:string}) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      if (ann) {
        const age = Date.now() - new Date(ann.created_at).getTime()
        if (age < 5 * 60 * 1000) setBanner({ id: ann.id, title: ann.title, message: ann.message, created_at: ann.created_at })
      }
    } catch(e) {}
  }
  async function markAllRead() {
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifications(notifications.map(n => ({ ...n, read: true })))
  }
  async function deleteNotification(id: string) {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(notifications.filter(n => n.id !== id))
  }
  function dismissBanner() {
    if (banner) { supabase.from('notifications').update({ read: true }).eq('id', banner.id) }
    setBanner(null)
  }
  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 3 * 60 * 1000)
    return () => clearTimeout(t)
  }, [banner])
  if (!mounted || !user) return null
  const userRoles = (user?.roles && user.roles.length > 0) ? user.roles : [user.role]
  const filteredNav = navItems.filter(i => i.roles.some(r => userRoles.includes(r)))
  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  const groups = Array.from(new Set(filteredNav.map(i => i.group)))
  const unread = notifications.filter(n => !n.read).length
  const rc: Record<string,string> = { admin:'#F97316', teacher:'#10B981', smt:'#8B5CF6', 'admin-teacher':'#0EA5E9' }
  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed lg:relative z-50 h-full flex flex-col transition-all duration-300 ${collapsed?'w-[68px]':'w-64'} ${mobileOpen?'translate-x-0':'-translate-x-full lg:translate-x-0'}`} style={{background:'#1E293B'}}>
        <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-700">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-contain" /> : <GraduationCap className="w-5 h-5 text-white" />}
          </div>
          {!collapsed && <span className="text-white font-bold text-lg">EduTrack</span>}
          <button onClick={() => setMobileOpen(false)} className="ml-auto lg:hidden text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        {!collapsed && <div className="px-4 py-3 border-b border-slate-700"><p className="text-white text-sm font-medium truncate">{user.display_name}</p><div className="flex items-center gap-2 mt-1"><span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{background:rc[user.role]}}>{user.role.replace('-','+').toUpperCase()}</span><span className="text-slate-400 text-xs truncate">{user.school_name}</span></div></div>}
        <nav className="flex-1 py-3 px-2 overflow-y-auto">
          {groups.map(g => {
            const items = filteredNav.filter(i => i.group === g)
            const isOpen = !collapsedGroups[g]
            return (
              <div key={g} className="mb-2">
                <button onClick={() => setCollapsedGroups({ ...collapsedGroups, [g]: isOpen })} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors">
                  {!collapsed && <><ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? '' : '-rotate-90'}`} /><span>{g}</span></>}
                </button>
                {isOpen && (
                  <div className="space-y-1">
                    {items.map(i => { const a = isActive(i.href); return <Link key={i.href} href={i.href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${a?'bg-blue-600 text-white':'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`} title={collapsed?i.label:undefined}><i.icon className="w-5 h-5 flex-shrink-0" />{!collapsed && <span>{i.label}</span>}</Link> })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
        <div className="border-t border-slate-700 p-2 space-y-1">
          <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-700/50 hover:text-white w-full">{collapsed?<ChevronRight className="w-5 h-5" />:<ChevronLeft className="w-5 h-5" />}{!collapsed && <span>Collapse</span>}</button>
          <button onClick={() => {logout();router.push('/')}} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 w-full"><LogOut className="w-5 h-5 flex-shrink-0" />{!collapsed && <span>Sign Out</span>}</button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-white flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="lg:hidden text-slate-600 w-10 h-10 -ml-2 flex items-center justify-center"><Menu className="w-6 h-6" /></button>
            <h1 className="text-lg font-semibold text-slate-800 truncate">{filteredNav.find(i => isActive(i.href))?.label||'Dashboard'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Button variant="ghost" size="icon" onClick={() => setNotifOpen(!notifOpen)} className="relative">
                <Bell className="w-5 h-5 text-slate-600" />
                {unread>0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">{unread}</span>}
              </Button>
              {notifOpen && <div className="fixed right-3 left-3 sm:absolute sm:right-0 sm:left-auto sm:top-12 sm:w-80 bg-white rounded-xl shadow-xl border z-50 max-h-96 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b"><span className="font-semibold text-sm">Notifications</span>{unread>0 && <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">Mark all read</button>}</div>
                <div className="max-h-72 overflow-y-auto">{notifications.length===0?<p className="text-sm text-slate-400 text-center py-8">No notifications yet</p>:notifications.slice(0,10).map(n => <div key={n.id} className={`group px-4 py-3 border-b text-sm ${!n.read?'bg-blue-50/50':''}`}><div className="flex items-start justify-between gap-2"><div className="flex-1 min-w-0"><p className={!n.read?'font-semibold text-slate-800':'text-slate-600'}>{n.title}</p><p className="text-xs text-slate-500 mt-0.5">{n.message}</p><p className="text-xs text-slate-400 mt-1">{new Date(n.created_at).toLocaleDateString('en-ZA',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p></div><button onClick={()=>deleteNotification(n.id)} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0 p-1" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button></div></div>)}</div>
              </div>}
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{background:rc[user.role]}}>{user.display_name.charAt(0)}</div>
              <span className="text-sm text-slate-600 font-medium">{user.display_name}</span>
            </div>
          </div>
        </header>
        {banner && (
          <div className="flex items-start gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <Megaphone className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{banner.title}</p>
              <p className="text-xs text-blue-100 mt-0.5">{banner.message}</p>
            </div>
            <button onClick={dismissBanner} aria-label="Dismiss announcement" className="text-blue-200 hover:text-white flex-shrink-0"><X className="w-4 h-4" /></button>
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}













