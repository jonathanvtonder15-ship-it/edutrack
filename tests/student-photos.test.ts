import test from 'node:test'
import assert from 'node:assert/strict'
import { saveStudentPhoto } from '../lib/student-photos'

test('photo profile writes include both school and student filters', async t => {
  const requests: string[] = []
  t.mock.method(globalThis,'fetch',async (input: string | URL | Request) => {
    const url = String(input)
    requests.push(url)
    return Response.json(url.includes('/storage/') ? {Key:'student-photos/school/student.png'} : {id:'student'})
  })
  await saveStudentPhoto('school','student',new File(['synthetic image bytes'],'photo.png',{type:'image/png'}))
  assert.equal(requests.length,2)
  const update = new URL(requests[1],'http://localhost')
  assert.equal(update.searchParams.get('id'),'eq.student')
  assert.equal(update.searchParams.get('school_id'),'eq.school')
})
