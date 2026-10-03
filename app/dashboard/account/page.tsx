'use client'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, User, Lock } from 'lucide-react'

export default function AccountPage() {
  const user = useAppStore(s => s.user)
  const setUser = useAppStore(s => s.setUser)
  const [name, setName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameMsg, setNameMsg] = useState('')
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { if (mounted && user) { setName(user.display_name || '') } }, [mounted, user])

  if (!mounted || !user) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>

  async function saveName() {
    if (!user || !name.trim()) return
    setSavingName(true); setNameMsg('')
    const { error } = await supabase.from('users').update({ display_name: name.trim() }).eq('id', user.id)
    if (!error) { setUser({ ...user, display_name: name.trim() }); setNameMsg('Name updated.') }
    else setNameMsg('Could not update name.')
    setSavingName(false)
  }

  async function savePassword() {
    if (!user) return
    setSavingPw(true); setPwMsg('')
    if (!pw.current || !pw.next) { setPwMsg('Fill in current and new password.'); setSavingPw(false); return }
    if (pw.next.length < 6) { setPwMsg('New password must be at least 6 characters.'); setSavingPw(false); return }
    if (pw.next !== pw.confirm) { setPwMsg('New passwords do not match.'); setSavingPw(false); return }
    const bcrypt = (await import('bcryptjs')).default
    const { data } = await supabase.from('users').select('password_hash').eq('id', user.id).single()
    const currentHash = (data as Record<string, unknown> | null)?.password_hash as string | undefined
    if (!currentHash || !bcrypt.compareSync(pw.current, currentHash)) { setPwMsg('Current password is incorrect.'); setSavingPw(false); return }
    const newHash = bcrypt.hashSync(pw.next, 10)
    const { error } = await supabase.from('users').update({ password_hash: newHash }).eq('id', user.id)
    if (!error) { setPw({ current: '', next: '', confirm: '' }); setPwMsg('Password updated. Use it next time you sign in.') }
    else setPwMsg('Could not update password.')
    setSavingPw(false)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div><h2 className="text-xl font-bold text-slate-800">My Account</h2><p className="text-sm text-slate-500">{user.school_name}</p></div>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5 text-blue-500" />Display Name</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><label className="text-xs font-medium text-slate-500 mb-1 block">Username (cannot change)</label><Input value={user.username} disabled className="bg-slate-50" /></div>
          <div><label className="text-xs font-medium text-slate-500 mb-1 block">Display name</label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="flex items-center gap-3">
            <Button onClick={saveName} disabled={savingName || !name.trim()} style={{ background: '#2563EB' }}>{savingName ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Save Name</Button>
            {nameMsg && <span className="text-sm text-slate-600">{nameMsg}</span>}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-amber-500" />Change Password</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><label className="text-xs font-medium text-slate-500 mb-1 block">Current password</label><Input type="password" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-slate-500 mb-1 block">New password</label><Input type="password" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} /></div>
            <div><label className="text-xs font-medium text-slate-500 mb-1 block">Confirm new password</label><Input type="password" value={pw.confirm} onChange={e => setPw({ ...pw, confirm: e.target.value })} /></div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={savePassword} disabled={savingPw} style={{ background: '#F59E0B' }}>{savingPw ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Update Password</Button>
            {pwMsg && <span className="text-sm text-slate-600">{pwMsg}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

