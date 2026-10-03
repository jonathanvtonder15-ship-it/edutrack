import { NextRequest, NextResponse } from 'next/server'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

export const runtime = 'nodejs'
export const maxDuration = 60

const openai = createOpenAI({
  baseURL: `${process.env.CODEWORDS_RUNTIME_URI}/run/openai/v1`,
  apiKey: process.env.CODEWORDS_API_KEY!,
})

type RefItem = { id: string; name: string; grade?: number }

// Extract the JSON object from the model's response, tolerating prose/fences around it.
function extractJson(text: string): any {
  let cleaned = text.trim()
  cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        throw new Error('The AI produced an unreadable result. Please try uploading the PDF again.')
      }
    }
    throw new Error('The AI produced an unreadable result. Please try uploading the PDF again.')
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const text = String(body?.text || '')
    const classes: RefItem[] = Array.isArray(body?.classes) ? body.classes : []
    const subjects: RefItem[] = Array.isArray(body?.subjects) ? body.subjects : []
    const teachers: RefItem[] = Array.isArray(body?.teachers) ? body.teachers : []
    const dayLabels: string[] = Array.isArray(body?.dayLabels) ? body.dayLabels : []
    const periods = parseInt(body?.periods, 10) || 8

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text was provided to parse.' }, { status: 400 })
    }

    const cleanText = text.replace(/\s+/g, ' ').trim()
    if (cleanText.length < 20) {
      return NextResponse.json({ error: 'No readable text found in this PDF. It is likely a scanned image — please export a text-based PDF from Excel or Word instead.' }, { status: 422 })
    }

    const prompt = `You are a school timetable parser. I have extracted the raw text of a school timetable PDF and need you to convert it into structured timetable entries.

The school's timetable has these day labels in order:
${JSON.stringify(dayLabels)}

There are ${periods} periods per day.

The school's real classes (id = database id, name = class name) are:
${JSON.stringify(classes)}

The school's real subjects are:
${JSON.stringify(subjects)}

The school's real teachers are:
${JSON.stringify(teachers)}

Here is the raw text extracted from the timetable PDF:
---
${text}
---

Your task:
1. Identify which rows/columns represent days, periods, classes, subjects, and teachers.
2. For every timetable cell that has content, produce one entry mapping it to:
   - day_number: 1-based index into the dayLabels array
   - period_number: 1-based period
   - class_id: the id of the matching class from the classes list (match by name, e.g. "Gr 8E1" or "8E1"). If no exact match, leave as empty string.
   - subject_id: the id of the matching subject from the subjects list. If no match, leave empty string.
   - teacher_id: the id of the matching teacher from the teachers list (match by surname/name). If no match, leave empty string.
   - teacher_name, class_name, subject_name: the human-readable names you matched (for display).
3. Match names loosely (ignore case, trailing spaces). Do NOT invent ids — only use ids that exist in the provided lists.
4. If the timetable is clearly a grid, parse it as a grid. If it's a list of lines like "Monday Period 1: Gr 8E1 Maths (Mr Smith)", parse those lines.

Return ONLY a valid JSON object (no markdown fences, no commentary) with this exact shape:
{
  "entries": [
    { "day_number": 1, "period_number": 1, "class_id": "...", "subject_id": "...", "teacher_id": "...", "class_name": "...", "subject_name": "...", "teacher_name": "..." }
  ]
}`

    let parsed: any
    try {
      const { text: resultText } = await generateText({
        model: openai('gpt-4.1-mini'),
        prompt,
        temperature: 0,
      })
      parsed = extractJson(resultText)
    } catch (e) {
      console.error('LLM generate error:', e)
      return NextResponse.json({ error: 'The AI could not process this timetable. Please try again, or upload a cleaner text-based PDF.' }, { status: 502 })
    }

    if (!parsed || !Array.isArray(parsed.entries)) {
      return NextResponse.json({ error: 'The AI did not return any timetable entries. The PDF layout may be too unusual — try a simpler grid-based export.' }, { status: 422 })
    }

    return NextResponse.json({ entries: parsed.entries })
  } catch (e) {
    console.error('Timetable parse error:', e)
    return NextResponse.json({ error: 'Failed to parse timetable: ' + (e as Error).message }, { status: 500 })
  }
}

