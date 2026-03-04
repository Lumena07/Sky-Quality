import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { createActivityLog } from '@/lib/activity-log'
import { PDFDocument } from 'pdf-lib'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const PDF_MIME = 'application/pdf'

export async function POST(
  request: Request,
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
      .select('id, fileUrl, fileType, version, title')
      .eq('id', id)
      .single()

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (doc.fileType !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Document is not a PDF. Add pages is only for approved PDFs.' },
        { status: 400 }
      )
    }

    const filePath = join(process.cwd(), 'public', doc.fileUrl.replace(/^\//, ''))
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Document file not found on server' }, { status: 404 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    if (!files.length) {
      return NextResponse.json(
        { error: 'At least one PDF file is required' },
        { status: 400 }
      )
    }

    const insertAtRaw = formData.get('insertAt')
    const insertAt =
      insertAtRaw !== null && insertAtRaw !== undefined && insertAtRaw !== ''
        ? parseInt(String(insertAtRaw), 10)
        : null

    const existingBytes = await readFile(filePath)
    const sourcePdf = await PDFDocument.load(existingBytes)
    const sourcePageCount = sourcePdf.getPageCount()

    const insertIndex =
      insertAt !== null && Number.isInteger(insertAt) && insertAt >= 0 && insertAt <= sourcePageCount
        ? insertAt
        : sourcePageCount

    const mainPdf = await PDFDocument.create()

    const beforeIndices = Array.from({ length: insertIndex }, (_, i) => i)
    const afterIndices = Array.from(
      { length: sourcePageCount - insertIndex },
      (_, i) => insertIndex + i
    )

    if (beforeIndices.length > 0) {
      const beforePages = await mainPdf.copyPages(sourcePdf, beforeIndices)
      beforePages.forEach((p) => mainPdf.addPage(p))
    }

    for (const file of files) {
      if (!file?.size) continue
      const type = file.type
      if (type !== PDF_MIME) {
        return NextResponse.json(
          { error: 'Only PDF files are allowed. Please upload PDF(s) only.' },
          { status: 400 }
        )
      }
      const buf = Buffer.from(await file.arrayBuffer())
      const appendedPdf = await PDFDocument.load(buf)
      const pageCount = appendedPdf.getPageCount()
      const indices = Array.from({ length: pageCount }, (_, i) => i)
      const copiedPages = await mainPdf.copyPages(appendedPdf, indices)
      copiedPages.forEach((p) => mainPdf.addPage(p))
    }

    if (afterIndices.length > 0) {
      const afterPages = await mainPdf.copyPages(sourcePdf, afterIndices)
      afterPages.forEach((p) => mainPdf.addPage(p))
    }

    const newPdfBytes = await mainPdf.save()

    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'document')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 12)
    const newFileName = `${timestamp}-${randomStr}.pdf`
    const newFilePath = join(uploadsDir, newFileName)
    await writeFile(newFilePath, newPdfBytes)

    const newFileUrl = `/uploads/document/${newFileName}`
    const newVersion = incrementVersion(doc.version)

    const { error: updateError } = await supabase
      .from('Document')
      .update({
        fileUrl: newFileUrl,
        fileSize: newPdfBytes.length,
        version: newVersion,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating document after add pages:', updateError)
      return NextResponse.json(
        { error: 'Failed to update document' },
        { status: 500 }
      )
    }

    await supabase.from('DocumentRevision').insert({
      id: randomUUID(),
      documentId: id,
      version: newVersion,
      changeLog: `Added ${files.length} file(s) as new page(s)`,
      fileUrl: newFileUrl,
      createdById: user.id,
    })

    await createActivityLog({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Document',
      entityId: id,
      details: `Added pages to PDF: ${doc.title}`,
      documentId: id,
    })

    return NextResponse.json({
      success: true,
      fileUrl: newFileUrl,
      version: newVersion,
      filesAdded: files.length,
    })
  } catch (error) {
    console.error('Error in add-pages:', error)
    return NextResponse.json(
      { error: 'Failed to add pages to PDF' },
      { status: 500 }
    )
  }
}

function incrementVersion(currentVersion: string): string {
  const parts = String(currentVersion || '1.0').split('.')
  const major = parseInt(parts[0], 10) || 1
  const minor = parseInt(parts[1], 10) || 0
  return `${major}.${minor + 1}`
}
