'use client'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, User, Lock } from 'lucide-react'

export default function AccountPage() {
  const user = useAppStore(s => s.user)
  const updateDisplayName = useAppStore(s => s.updateDisplayName)
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
    try {
      const res = await fetch('/api/auth/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: name.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      updateDisplayName(user.id, name.trim()); setNameMsg('Name updated.')
    } catch (error) { setNameMsg(error instanceof Error ? error.message : 'Could not update name.') }
    finally { setSavingName(false) }
  }

  async function savePassword() {
    if (!user) return
    setSavingPw(true); setPwMsg('')
    if (!pw.current || !pw.next) { setPwMsg('Fill in current and new password.'); setSavingPw(false); return }
    if (pw.next.length < 8) { setPwMsg('New password must be at least 8 characters.'); setSavingPw(false); return }
    if (pw.next !== pw.confirm) { setPwMsg('New passwords do not match.'); setSavingPw(false); return }
    try {
      const res = await fetch('/api/auth/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: pw.current, password: pw.next }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPw({ current: '', next: '', confirm: '' }); setPwMsg('Password updated. Use it next time you sign in.')
    } catch (error) { setPwMsg(error instanceof Error ? error.message : 'Could not update password.') }
    finally { setSavingPw(false) }
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

