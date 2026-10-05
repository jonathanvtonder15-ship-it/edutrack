import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

// Separate processes exercise module initialization as it runs during a build.
test('production metadata rejects a missing site URL and preserves configured EduTrack metadata', () => {
  const env: NodeJS.ProcessEnv = {...process.env, NODE_ENV:'production'}
  delete env.NEXT_PUBLIC_APP_URL
  const missing = spawnSync(process.execPath,['--import','tsx','-e',"require('./components/root-metadata.tsx')"],{env,encoding:'utf8'})
  assert.notEqual(missing.status,0)
  assert.match(missing.stderr,/NEXT_PUBLIC_APP_URL is required in production/)
  const configured = spawnSync(process.execPath,['--import','tsx','-e',"console.log(JSON.stringify(require('./components/root-metadata.tsx').metadata))"],{env:{...env,NEXT_PUBLIC_APP_URL:'https://edutrack.example.org'},encoding:'utf8'})
  assert.equal(configured.status,0,configured.stderr)
  const metadata = JSON.parse(configured.stdout)
  assert.equal(metadata.metadataBase,'https://edutrack.example.org/')
  assert.equal(metadata.title,'EduTrack v2')
  assert.equal(metadata.icons.icon,'/edutrack.svg')
})

test('logout clears local state immediately and reports HTTP and network failures', async t => {
  const data = new Map<string,string>()
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value),removeItem:(key:string)=>data.delete(key)}})
  Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:globalThis.localStorage}})
  t.after(()=>{Reflect.deleteProperty(globalThis,'localStorage');Reflect.deleteProperty(globalThis,'window')})
  const { useAppStore } = await import('../lib/store')
  const user = {id:'teacher',username:'teacher',display_name:'Teacher',role:'teacher',school_id:'school',school_name:'School'}
  for (const failure of ['http','network','success']) {
    let complete!: (value: Response) => void
    let reject!: (reason: Error) => void
    const request = new Promise<Response>((resolve,fail)=>{complete=resolve;reject=fail})
    const mock = t.mock.method(globalThis,'fetch',()=>request)
    useAppStore.getState().setUser(user)
    useAppStore.getState().logout()
    assert.equal(useAppStore.getState().user,null)
    assert.equal(useAppStore.getState().loginTime,null)
    if (failure==='network') reject(new Error('offline'))
    else complete(new Response(null,{status:failure==='http'?503:200}))
    await new Promise(resolve=>setImmediate(resolve))
    if(failure==='success') assert.equal(useAppStore.getState().logoutWarning,null)
    else assert.match(useAppStore.getState().logoutWarning!,/server sign-out could not be confirmed/)
    mock.mock.restore()
  }
})

test('logout route always expires the app cookie when provider setup/sign-out fails', () => {
  for (const failure of ['setup','network','returned','none']) {
    const result = spawnSync(process.execPath,['--import','tsx','--import','./tests/support/logout-hook.mjs','-e',`(async()=>{ const {POST}=require('./app/api/auth/logout/route.ts'); const response=await POST(new Request('http://localhost:3000/api/auth/logout',{method:'POST'})); console.log(JSON.stringify({status:response.status,cookie:response.headers.get('set-cookie')})); })()`],{env:{...process.env,LOGOUT_TEST_FAILURE:failure},encoding:'utf8'})
    assert.equal(result.status,0,result.stderr)
    const response = JSON.parse(result.stdout)
    assert.equal(response.status,failure==='none'?200:503)
    assert.match(response.cookie,/edutrack_session=;/)
    assert.match(response.cookie,/Max-Age=0/)
    assert.match(response.cookie,/HttpOnly/)
  }
})
