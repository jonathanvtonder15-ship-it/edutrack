'use client'

import { useLoadEffect } from '@/hooks/use-load-effect'
import { useCallback, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Plus, Trash2 } from 'lucide-react'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'smt', label: 'SMT' },
  { value: 'monitor-guardian', label: 'Monitor Guardian' },
]

const rc: Record<string,string> = { admin:'#F97316', teacher:'#10B981', smt:'#8B5CF6', 'admin-teacher':'#0EA5E9', 'monitor-guardian':'#DB2777' }

function roleLabel(role: string) { const r = ROLE_OPTIONS.find(o=>o.value===role); return r ? r.label : role }
function toggleRole(arr: string[], role: string): string[] { return arr.includes(role) ? arr.filter(r=>r!==role) : [...arr, role] }

export default function UsersPage(){
  const user=useAppStore(s=>s.user)
  const setUser=useAppStore(s=>s.setUser)
  const [users,setUsers]=useState<Array<{id:string;username:string;display_name:string;role:string;roles?:string[]}>>([])
  const [loading,setLoading]=useState(true)
  const [creating,setCreating]=useState(false)
  const [open,setOpen]=useState(false)
  const [form,setForm]=useState({username:'',password:'',display_name:'',role:'teacher',roles:['teacher'] as string[]})
  const [error,setError]=useState('')
  const [editUser,setEditUser]=useState<{id:string;display_name:string;role:string;roles:string[];username:string}|null>(null)
  const [editForm,setEditForm]=useState({display_name:'',role:'',roles:[] as string[],username:'',password:''})
  const [savingEdit,setSavingEdit]=useState(false)
  const [editError,setEditError]=useState('')
  const [editOk,setEditOk]=useState('')
  const [deleteOpen,setDeleteOpen]=useState<{id:string;name:string}|null>(null)
  const [deleting,setDeleting]=useState(false)

  const load = useCallback(async () => {if(!user)return;const{data}=await supabase.from('users').select('id,username,display_name,role,roles').eq('active', true).eq('school_id',user.school_id).order('display_name');if(data)setUsers(data.map((u:Record<string,unknown>)=>({id:u.id as string,username:u.username as string,display_name:u.display_name as string,role:(u.role as string)||'teacher',roles:(u.roles as string[])||[]})));setLoading(false)}, [user])

  const isAdmin = user?.role === 'admin' || user?.role === 'admin-teacher'
  const editingSelf = !!editUser && !!user && editUser.id === user.id

  function openEdit(u:{id:string;username:string;display_name:string;role:string;roles?:string[]}){const rs=u.roles&&u.roles.length?u.roles:[u.role];setEditUser({id:u.id,display_name:u.display_name,role:u.role,roles:rs,username:u.username});setEditForm({display_name:u.display_name,role:u.role,roles:rs,username:u.username,password:''});setEditError('');setEditOk('')}

  async function createUser(){if(!user)return;setCreating(true);setError('');try{const res=await fetch('/api/auth/create-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:form.username,password:form.password,display_name:form.display_name,role:form.role,roles:form.roles,school_id:user.school_id,requesting_user_role:user.role})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Failed');setUsers([...users,data.user]);setForm({username:'',password:'',display_name:'',role:'teacher',roles:['teacher']});setOpen(false)}catch(err:unknown){setError(err instanceof Error?err.message:'Failed')}finally{setCreating(false)}}

  async function saveUserEdit(){if(!editUser||!editForm.display_name||!user)return;setSavingEdit(true);setEditError('');setEditOk('');try{const isSelf=editUser.id===user.id;const res=await fetch('/api/auth/update-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:editUser.id,username:editForm.username,password:editForm.password,display_name:editForm.display_name,role:isSelf?'':(editForm.roles[0]||editForm.role),roles:isSelf?[]:editForm.roles,requesting_user_role:user.role})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Failed');setUsers(users.map(u=>u.id===editUser.id?{...u,display_name:data.user.display_name,role:data.user.role,roles:data.user.roles||[],username:data.user.username}:u));if(isSelf){setUser({...user,display_name:data.user.display_name,username:data.user.username});setEditOk('Saved. Your details have been updated.')}else{setEditUser(null)}setSavingEdit(false)}catch(err:unknown){setEditError(err instanceof Error?err.message:'Failed');setSavingEdit(false)}}

  async function deleteUser(){if(!user||!deleteOpen)return;setDeleting(true);try{const res=await fetch('/api/auth/delete-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:deleteOpen.id,requesting_user_role:user.role,requesting_user_id:user.id})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Failed');setUsers(users.filter(u=>u.id!==deleteOpen.id));setDeleteOpen(null)}catch(err:unknown){setEditError(err instanceof Error?err.message:'Failed')}finally{setDeleting(false)}}

  useLoadEffect(load)

  if(!user||(user.role!=='admin'&&user.role!=='smt'&&user.role!=='admin-teacher'))return<div className="p-8 text-center text-slate-500">Admin/SMT access required</div>
  if(loading)return<div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>

  return(<div className="space-y-6">
    <Card className="border-0 shadow-sm"><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Staff Members</CardTitle>{isAdmin&&<Button size="sm" onClick={()=>setOpen(true)} style={{background:'#2563EB'}}><Plus className="w-4 h-4 mr-2" />Add User</Button>}</CardHeader><CardContent><div className="grid gap-2">{users.map(u=>{const roles=u.roles&&u.roles.length?u.roles:[u.role];const self=u.id===user.id;return <div key={u.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{background:rc[u.role]||'#64748b'}}>{u.display_name.charAt(0)}</div><div><p className="font-medium text-slate-800">{u.display_name}{self&&<span className="ml-2 text-xs font-normal text-blue-600">(you)</span>}</p><p className="text-xs text-slate-500">@{u.username}</p></div></div><div className="flex items-center gap-2 flex-wrap justify-end">{roles.map((r:string)=><span key={r} className="text-xs font-semibold px-2.5 py-1 rounded-full text-white" style={{background:rc[r]||'#64748b'}}>{roleLabel(r)}</span>)}{self?<button onClick={()=>openEdit(u)} className="ml-2 text-xs font-medium text-blue-600 hover:underline">Edit my profile</button>:(isAdmin&&<><button onClick={()=>openEdit(u)} className="ml-2 text-xs text-blue-600 hover:underline">Edit</button><button onClick={()=>setDeleteOpen({id:u.id,name:u.display_name})} className="text-slate-300 hover:text-red-500 transition-colors p-1" title="Deactivate user"><Trash2 className="w-4 h-4" /></button></>)}</div></div>})}</div></CardContent></Card>

    {isAdmin&&open&&<Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader><div className="space-y-3 pt-2">{error&&<div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}<Input placeholder="Full Name" value={form.display_name} onChange={e=>setForm({...form,display_name:e.target.value})} /><Input placeholder="Username" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} /><Input type="password" placeholder="Password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /><div><p className="text-sm font-medium text-slate-700 mb-2">Roles (tick all that apply)</p><div className="grid grid-cols-2 gap-2">{ROLE_OPTIONS.map(o=><label key={o.value} className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer"><input type="checkbox" checked={form.roles.includes(o.value)} onChange={()=>{const roles=toggleRole(form.roles,o.value);setForm({...form,roles,role:roles[0]||'teacher'})}} className="w-4 h-4" /><span className="text-sm">{o.label}</span></label>)}</div></div><Button onClick={createUser} disabled={creating||!form.roles.length} className="w-full" style={{background:'#2563EB'}}>{creating?<Loader2 className="w-4 h-4 animate-spin" />:'Create User'}</Button></div></DialogContent></Dialog>}

    {editUser&&<Dialog open={!!editUser} onOpenChange={()=>setEditUser(null)}><DialogContent><DialogHeader><DialogTitle>{editingSelf?'My Profile':('Edit: '+editUser.display_name)}</DialogTitle></DialogHeader><div className="space-y-3 pt-2">{editError&&<div className="text-sm text-red-600 bg-red-50 p-2 rounded">{editError}</div>}{editOk&&<div className="text-sm text-green-700 bg-green-50 p-2 rounded">{editOk}</div>}<Input placeholder="Display Name" value={editForm.display_name} onChange={e=>setEditForm({...editForm,display_name:e.target.value})} /><Input placeholder="Username" value={editForm.username} onChange={e=>setEditForm({...editForm,username:e.target.value})} /><Input type="password" placeholder="New password (leave blank to keep current)" value={editForm.password} onChange={e=>setEditForm({...editForm,password:e.target.value})} />{editingSelf?<p className="text-xs text-slate-500 bg-slate-50 p-2 rounded">Your roles are managed by another admin, so they cannot be changed here.</p>:<div><p className="text-sm font-medium text-slate-700 mb-2">Roles (tick all that apply)</p><div className="grid grid-cols-2 gap-2">{ROLE_OPTIONS.map(o=><label key={o.value} className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer"><input type="checkbox" checked={editForm.roles.includes(o.value)} onChange={()=>setEditForm({...editForm,roles:toggleRole(editForm.roles,o.value)})} className="w-4 h-4" /><span className="text-sm">{o.label}</span></label>)}</div></div>}<Button onClick={saveUserEdit} disabled={savingEdit||!editForm.display_name||(!editingSelf&&!editForm.roles.length)} className="w-full" style={{background:'#2563EB'}}>{savingEdit?<Loader2 className="w-4 h-4 animate-spin" />:(editingSelf?'Save My Details':'Save Changes')}</Button></div></DialogContent></Dialog>}

    {deleteOpen&&<Dialog open={!!deleteOpen} onOpenChange={()=>setDeleteOpen(null)}><DialogContent><DialogHeader><DialogTitle>Deactivate User</DialogTitle></DialogHeader><div className="space-y-4 pt-2">{editError&&<div className="text-sm text-red-600 bg-red-50 p-2 rounded">{editError}</div>}<p className="text-sm text-slate-600">Delete <span className="font-semibold">{deleteOpen.name}</span>? Their records will be kept but their name will no longer appear. This cannot be undone.</p><div className="flex gap-2"><Button onClick={deleteUser} disabled={deleting} className="flex-1" style={{background:'#EF4444'}}>{deleting?<Loader2 className="w-4 h-4 animate-spin" />:'Delete'}</Button><Button variant="outline" onClick={()=>setDeleteOpen(null)} className="flex-1">Cancel</Button></div></div></DialogContent></Dialog>}
  </div>)
}

