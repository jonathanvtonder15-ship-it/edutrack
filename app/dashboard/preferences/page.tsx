'use client'

import { useLoadEffect } from '@/hooks/use-load-effect'
import { useCallback, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Save, Bell, ArrowLeftRight, AlertTriangle, Award, DoorOpen, Megaphone } from 'lucide-react'

type Prefs = { batting: boolean; demerit: boolean; merit: boolean; leave: boolean; announcement: boolean }

export default function PreferencesPage() {
  const user = useAppStore(s => s.user)
  const [prefs, setPrefs] = useState<Prefs>({ batting: true, demerit: true, merit: true, leave: true, announcement: true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('notification_preferences').select('*').eq('user_id', user.id).single()
    if (data) {
      setPrefs({
        batting: data.batting !== false,
        demerit: data.demerit !== false,
        merit: data.merit !== false,
        leave: data.leave !== false,
        announcement: data.announcement !== false,
      })
    }
    setLoading(false)
  }, [user])

  async function save() {
    if (!user) return
    setSaving(true)
    await supabase.from('notification_preferences').upsert({ user_id: user.id, ...prefs }, { onConflict: 'user_id' })
    setMessage('Saved!')
    setSaving(false)
    setTimeout(() => setMessage(''), 3000)
  }

  function toggle(k: keyof Prefs) {
    setPrefs(p => ({ ...p, [k]: !p[k] }))
  }

  useLoadEffect(load)

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>

  const items: Array<{ key: keyof Prefs; label: string; desc: string; icon: import('lucide-react').LucideIcon }> = [
    { key: 'batting', label: 'Relief / Batting', desc: 'When you are assigned as a replacement teacher or a relief is allocated', icon: ArrowLeftRight },
    { key: 'demerit', label: 'Demerits', desc: 'When demerits are given to a class you teach', icon: AlertTriangle },
    { key: 'merit', label: 'Merits', desc: 'When merits are given to a class you teach', icon: Award },
    { key: 'leave', label: 'Leave Alerts', desc: 'When a learner is signed out to you, arrives, or departs', icon: DoorOpen },
    { key: 'announcement', label: 'Announcements', desc: 'When admin posts a school-wide announcement', icon: Megaphone },
  ]

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Notification Preferences</h2>
        <p className="text-slate-500 mt-1">Choose which notifications you want to receive. Turned off = you stop getting those alerts.</p>
      </div>

      {message && <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700 text-sm font-medium">✓ {message}</div>}

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5 text-blue-500" />Alerts</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.map(it => {
            const on = prefs[it.key]
            return (
              <div key={it.key} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${on ? 'bg-blue-100' : 'bg-slate-200'}`}>
                    <it.icon className={`w-4 h-4 ${on ? 'text-blue-600' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{it.label}</p>
                    <p className="text-xs text-slate-500">{it.desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggle(it.key)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${on ? 'bg-blue-500' : 'bg-slate-300'}`}
                  role="switch"
                  aria-checked={on}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : ''}`} />
                </button>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} style={{ background: '#2563EB' }}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Save Preferences
      </Button>
    </div>
  )
}

