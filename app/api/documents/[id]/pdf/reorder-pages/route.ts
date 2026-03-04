import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { createActivityLog } from '@/lib/activity-log'
import { PDFDocument } from 'pdf-lib'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

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
    const body = await request.json()
    const { pageOrder } = body as { pageOrder?: number[] }

    if (!Array.isArray(pageOrder) || pageOrder.length === 0) {
      return NextResponse.json(
        { error: 'pageOrder must be a non-empty array of 0-based page indices in the new order' },
        { status: 400 }
      )
    }

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
        { error: 'Document is not a PDF. Reorder is only for PDFs.' },
        { status: 400 }
      )
    }

    const filePath = join(process.cwd(), 'public', doc.fileUrl.replace(/^\//, ''))
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Document file not found on server' }, { status: 404 })
    }

    const existingBytes = await readFile(filePath)
    const pdfDoc = await PDFDocument.load(existingBytes)
    const totalPages = pdfDoc.getPageCount()

    const validOrder = pageOrder.filter(
      (i) => Number.isInteger(i) && i >= 0 && i < totalPages
    )
    const unique = new Set(validOrder)
    if (validOrder.length !== totalPages || unique.size !== totalPages) {
      return NextResponse.json(
        { error: 'pageOrder must contain exactly one of each page index 0 to ' + (totalPages - 1) },
        { status: 400 }
      )
    }

    const newPdf = await PDFDocument.create()
    const copiedPages = await newPdf.copyPages(pdfDoc, validOrder)
    copiedPages.forEach((p) => newPdf.addPage(p))

    const newPdfBytes = await newPdf.save()

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
      console.error('Error updating document after reorder:', updateError)
      return NextResponse.json(
        { error: 'Failed to update document' },
        { status: 500 }
      )
    }

    await supabase.from('DocumentRevision').insert({
      id: randomUUID(),
      documentId: id,
      version: newVersion,
      changeLog: 'Reordered pages',
      fileUrl: newFileUrl,
      createdById: user.id,
    })

    await createActivityLog({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Document',
      entityId: id,
      details: `Reordered pages in PDF: ${doc.title}`,
      documentId: id,
    })

    return NextResponse.json({
      success: true,
      fileUrl: newFileUrl,
      version: newVersion,
    })
  } catch (error) {
    console.error('Error in reorder-pages:', error)
    return NextResponse.json(
      { error: 'Failed to reorder pages' },
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
