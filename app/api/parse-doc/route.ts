import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    let file: File | null = null
    try {
      const formData = await req.formData()
      file = formData.get('file') as File | null
    } catch {
      return NextResponse.json({ error: 'Expected multipart/form-data with a file field' }, { status: 400 })
    }
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const text = await file.text()
    const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0)

    const firstLine = lines[0] || ''
    let delimiter = '\t'
    if (firstLine.includes('|')) delimiter = '|'
    else if (firstLine.includes('\t')) delimiter = '\t'
    else if (firstLine.split(/\s{2,}/).length > 2) delimiter = '  '

    const rows = lines.map((line: string) => {
      if (delimiter === '  ') return line.split(/\s{2,}/).map((cell: string) => cell.trim())
      return line.split(delimiter).map((cell: string) => cell.trim())
    }).filter((row: string[]) => row.length > 1)

    if (rows.length < 2) {
      const entries = lines.map((line: string) => {
        const parts = line.split(/[,;\t]/).map((p: string) => p.trim()).filter((p: string) => p)
        if (parts.length >= 2) return parts
        const nameParts = line.trim().split(/\s+/)
        if (nameParts.length >= 2) return [nameParts[0], nameParts.slice(1).join(' ')]
        return null
      }).filter(Boolean)
      return NextResponse.json({ type: 'list', headers: ['Name', 'Surname'], rows: entries, total: entries.length })
    }

    return NextResponse.json({ type: 'table', headers: rows[0], rows: rows.slice(1), total: rows.length - 1 })
  } catch (err) {
    console.error('Parse doc error:', err)
    return NextResponse.json({ error: 'Failed to parse document' }, { status: 500 })
  }
}

