import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { PDFDocument } from 'pdf-lib'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const { data: doc, error: docError } = await supabase
      .from('Document')
      .select('id, fileUrl, fileType')
      .eq('id', id)
      .single()

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (doc.fileType !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Document is not a PDF' },
        { status: 400 }
      )
    }

    const filePath = join(process.cwd(), 'public', doc.fileUrl.replace(/^\//, ''))
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Document file not found on server' }, { status: 404 })
    }

    const bytes = await readFile(filePath)
    const pdfDoc = await PDFDocument.load(bytes)
    const pageCount = pdfDoc.getPageCount()

    return NextResponse.json({ pageCount })
  } catch (error) {
    console.error('Error getting PDF page count:', error)
    return NextResponse.json(
      { error: 'Failed to get PDF page count' },
      { status: 500 }
    )
  }
}
