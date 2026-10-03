'use client'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { filterRecipients } from '@/lib/notifications'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Megaphone, Trash2 } from 'lucide-react'

export default function AnnouncementsPage(){
  const user=useAppStore(s=>s.user)
  const [announcements,setAnnouncements]=useState<Array<{id:string;subject:string;body:string;created_at:string;sender_name:string}>>([])
  const [loading,setLoading]=useState(true)
  const [composeOpen,setComposeOpen]=useState(false)
  const [form,setForm]=useState({subject:'',body:''})
  const [sending,setSending]=useState(false)
  const [deleteOpen,setDeleteOpen]=useState<string|null>(null)
  const [deleting,setDeleting]=useState(false)

  const isAdmin = user?.role === 'admin' || user?.role === 'admin-teacher'

  useEffect(()=>{ if(user) load() },[user])

  async function load(){
    if(!user) return
    const { data } = await supabase.from('messages').select('*,sender:users!messages_sender_id_fkey(display_name)').eq('school_id',user.school_id).eq('is_announcement',true).order('created_at',{ascending:false}).limit(100)
    setAnnouncements((data||[]).map((m:Record<string,unknown>)=>({id:m.id as string,subject:m.subject as string,body:m.body as string,created_at:m.created_at as string,sender_name:(m.sender as{display_name:string})?.display_name||''})))
    setLoading(false)
  }

  async function sendAnnouncement(){
    if(!user||!form.subject||!form.body) return
    setSending(true)
    await supabase.from('messages').insert({school_id:user.school_id,sender_id:user.id,recipient_id:null,subject:form.subject,body:form.body,is_announcement:true})
    const { data: staff } = await supabase.from('users').select('id').eq('school_id',user.school_id).in('role',['admin','smt','teacher','admin-teacher'])
    if(staff && staff.length>0){
      const staffIds = await filterRecipients(staff.map((u:{id:string})=>u.id), 'announcement')
      if(staffIds.length>0) await supabase.from('notifications').insert(staffIds.map(uid=>({user_id:uid,type:'announcement',title:form.subject,message:form.body,read:false,school_id:user.school_id})))
    }
    await load()
    setComposeOpen(false)
    setForm({subject:'',body:''})
    setSending(false)
  }

  async function deleteAnnouncement(id:string){
    setDeleting(true)
    await supabase.from('messages').delete().eq('id',id)
    await load()
    setDeleting(false)
    setDeleteOpen(null)
  }

  if(loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>

  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Announcements</h2>
        {isAdmin && <Button size="sm" style={{background:'#2563EB'}} onClick={()=>setComposeOpen(true)}><Megaphone className="w-4 h-4 mr-2" />New Announcement</Button>}
      </div>
      <Card className="border-0 shadow-sm"><CardContent className="p-0">
        {announcements.length===0
          ? <p className="text-center text-slate-400 py-12">No announcements yet</p>
          : <div className="divide-y">{announcements.map(m=>(
              <div key={m.id} className="p-4 hover:bg-slate-50 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0"><Megaphone className="w-4 h-4 text-orange-600" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800">{m.subject}</p>
                  <p className="text-xs text-slate-500 mt-0.5">By {m.sender_name} — {new Date(m.created_at).toLocaleDateString('en-ZA',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
                  <p className="text-sm text-slate-600 mt-1">{m.body}</p>
                </div>
                {isAdmin && <button onClick={()=>setDeleteOpen(m.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1" title="Delete"><Trash2 className="w-4 h-4" /></button>}
              </div>
            ))}</div>
        }
      </CardContent></Card>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}><DialogContent><DialogHeader><DialogTitle>New Announcement</DialogTitle></DialogHeader><div className="space-y-3 pt-2">
        <Input placeholder="Subject" value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} />
        <textarea placeholder="Announcement message..." value={form.body} onChange={e=>setForm({...form,body:e.target.value})} className="w-full h-32 px-3 py-2 rounded-md border text-sm resize-none" />
        <Button onClick={sendAnnouncement} disabled={sending||!form.subject||!form.body} className="w-full" style={{background:'#2563EB'}}>{sending?<Loader2 className="w-4 h-4 animate-spin mr-2" />:<Megaphone className="w-4 h-4 mr-2" />}Send Announcement</Button>
      </div></DialogContent></Dialog>

      <Dialog open={!!deleteOpen} onOpenChange={(o)=>!o&&setDeleteOpen(null)}><DialogContent><DialogHeader><DialogTitle>Delete Announcement</DialogTitle></DialogHeader><div className="space-y-4 pt-2"><p className="text-sm text-slate-600">Delete this announcement? This cannot be undone.</p><div className="flex gap-2"><Button onClick={()=>deleteOpen&&deleteAnnouncement(deleteOpen)} disabled={deleting} className="flex-1" style={{background:'#EF4444'}}>{deleting?<Loader2 className="w-4 h-4 animate-spin" />:'Delete'}</Button><Button variant="outline" onClick={()=>setDeleteOpen(null)} className="flex-1">Cancel</Button></div></div></DialogContent></Dialog>
    </div>
  )
}





