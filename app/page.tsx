'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { GraduationCap, Loader2, AlertCircle, School, Users, ClipboardCheck } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const setUser = useAppStore((s) => s.setUser)
  const [mode, setMode] = useState<'login' | 'setup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [keepSignedIn, setKeepSignedIn] = useState(false)
  const [schoolName, setSchoolName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [timetableType, setTimetableType] = useState('5-day')
  const [periodsPerDay, setPeriodsPerDay] = useState('8')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUser(data.user, keepSignedIn); router.push('/dashboard')
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Login failed') } finally { setLoading(false) }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res = await fetch('/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ school_name: schoolName, admin_username: adminUsername, admin_password: adminPassword, admin_display_name: adminName, timetable_type: timetableType, periods_per_day: parseInt(periodsPerDay) }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUser({ id: data.admin.id, username: data.admin.username, display_name: data.admin.display_name, role: 'admin', school_id: data.school.id, school_name: data.school.name })
      router.push('/dashboard')
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Setup failed') } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 50%, #1E293B 100%)' }}>
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 text-white">
        <div className="max-w-md">
          <div className="flex items-center gap-3 mb-8"><div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30"><GraduationCap className="w-8 h-8 text-white" /></div><div><h1 className="text-3xl font-bold">EduTrack</h1><p className="text-blue-300 text-sm">School Management System</p></div></div>
          <h2 className="text-2xl font-semibold mb-4 text-slate-100">Manage your school with ease</h2>
          <div className="space-y-4 text-slate-300">
            <div className="flex items-start gap-3"><ClipboardCheck className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" /><p>Take attendance per period with automatic timetable integration</p></div>
            <div className="flex items-start gap-3"><Users className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" /><p>Manage students, demerits, and classroom movements</p></div>
            <div className="flex items-start gap-3"><School className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" /><p>Support for both 5-day and 10-day timetable cycles</p></div>
          </div>
        </div>
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-2xl border-0" style={{ background: 'white' }}>
          <CardHeader className="text-center pb-2">
            <div className="lg:hidden flex items-center justify-center gap-2 mb-4"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center"><GraduationCap className="w-6 h-6 text-white" /></div><span className="text-xl font-bold text-slate-800">EduTrack</span></div>
            <CardTitle className="text-2xl font-bold text-slate-800">{mode === 'login' ? 'Welcome Back' : 'Set Up Your School'}</CardTitle>
            <CardDescription className="text-slate-500">{mode === 'login' ? 'Sign in to your account' : 'Create your school and admin account'}</CardDescription>
          </CardHeader>
          <CardContent>
            {error && <div className="flex items-center gap-2 p-3 mb-4 rounded-lg text-sm" style={{ background: '#FEF2F2', color: '#DC2626' }}><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Username</label><Input placeholder="Enter your username" value={username} onChange={(e) => setUsername(e.target.value)} required className="h-11" /></div>
                <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Password</label><Input type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11" /></div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input type="checkbox" checked={keepSignedIn} onChange={e => setKeepSignedIn(e.target.checked)} className="w-4 h-4 rounded" />
                  <span className="text-sm text-slate-600">Keep me signed in</span>
                </label>
                <Button type="submit" disabled={loading} className="w-full h-11 text-base font-semibold" style={{ background: '#2563EB' }}>{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}</Button>
                <p className="text-center text-sm text-slate-500">New school? <button type="button" onClick={() => { setMode('setup'); setError('') }} className="text-blue-600 font-medium hover:underline">Set up here</button></p>
              </form>
            ) : (
              <form onSubmit={handleSetup} className="space-y-3">
                <div><label className="text-sm font-medium text-slate-700 mb-1 block">School Name</label><Input placeholder="e.g. Hoerskool Wonderboom" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required className="h-10" /></div>
                <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium text-slate-700 mb-1 block">Timetable</label><select value={timetableType} onChange={(e) => setTimetableType(e.target.value)} className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm bg-white"><option value="5-day">5-Day</option><option value="10-day">10-Day</option></select></div><div><label className="text-sm font-medium text-slate-700 mb-1 block">Periods</label><Input type="number" min="1" max="15" value={periodsPerDay} onChange={(e) => setPeriodsPerDay(e.target.value)} required className="h-10" /></div></div>
                <hr className="my-1" />
                <div><label className="text-sm font-medium text-slate-700 mb-1 block">Admin Full Name</label><Input placeholder="e.g. Mr. Van Tonder" value={adminName} onChange={(e) => setAdminName(e.target.value)} required className="h-10" /></div>
                <div><label className="text-sm font-medium text-slate-700 mb-1 block">Admin Username</label><Input placeholder="e.g. admin" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} required className="h-10" /></div>
                <div><label className="text-sm font-medium text-slate-700 mb-1 block">Admin Password</label><Input type="password" placeholder="Choose a strong password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required className="h-10" /></div>
                <Button type="submit" disabled={loading} className="w-full h-11 text-base font-semibold" style={{ background: '#2563EB' }}>{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create School & Admin'}</Button>
                <p className="text-center text-sm text-slate-500">Already have an account? <button type="button" onClick={() => { setMode('login'); setError('') }} className="text-blue-600 font-medium hover:underline">Sign in</button></p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}




