import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { createActivityLog } from '@/lib/activity-log'
import { getCurrentUserProfile, hasReviewerRole } from '@/lib/permissions'
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

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (!hasReviewerRole(roles)) {
      return NextResponse.json(
        { error: 'Only Quality Manager or auditors can edit approved manuals.' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { pageIndexes } = body as { pageIndexes?: number[] }

    if (!Array.isArray(pageIndexes) || pageIndexes.length === 0) {
      return NextResponse.json(
        { error: 'pageIndexes must be a non-empty array of page numbers (0-based)' },
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
        { error: 'Document is not a PDF. Remove pages is only for approved PDFs.' },
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

    const toRemove = new Set(
      pageIndexes.filter((i) => Number.isInteger(i) && i >= 0 && i < totalPages)
    )
    if (toRemove.size === 0) {
      return NextResponse.json(
        { error: 'No valid page indexes to remove' },
        { status: 400 }
      )
    }

    const newPdf = await PDFDocument.create()
    const indicesToKeep = Array.from(Array(totalPages).keys()).filter((i) => !toRemove.has(i))
    const pages = await newPdf.copyPages(pdfDoc, indicesToKeep)
    pages.forEach((page) => newPdf.addPage(page))

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
      console.error('Error updating document after remove pages:', updateError)
      return NextResponse.json(
        { error: 'Failed to update document' },
        { status: 500 }
      )
    }

    await supabase.from('DocumentRevision').insert({
      id: randomUUID(),
      documentId: id,
      version: newVersion,
      changeLog: `Removed ${toRemove.size} page(s) from PDF`,
      fileUrl: newFileUrl,
      createdById: user.id,
    })

    await createActivityLog({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Document',
      entityId: id,
      details: `Removed pages from PDF: ${doc.title}`,
      documentId: id,
    })

    return NextResponse.json({
      success: true,
      fileUrl: newFileUrl,
      version: newVersion,
      pagesRemoved: toRemove.size,
    })
  } catch (error) {
    console.error('Error in remove-pages:', error)
    return NextResponse.json(
      { error: 'Failed to remove pages from PDF' },
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
