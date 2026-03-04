import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { createActivityLog } from '@/lib/activity-log'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
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

    const body = await request.json()
    const { name, fileUrl, fileType, fileSize } = body

    const { data: document, error } = await supabase
      .from('AuditDocument')
      .insert({
        auditId: params.id,
        name,
        fileUrl,
        fileType,
        fileSize,
        uploadedBy: user.id,
      })
      .select('*')
      .single()

    if (error || !document) {
      console.error('Error creating audit document in Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to create document' },
        { status: 500 }
      )
    }

    await createActivityLog({
      userId: user.id,
      action: 'UPLOAD',
      entityType: 'AuditDocument',
      entityId: document.id,
      details: `Uploaded document: ${name}`,
      auditId: params.id,
      documentId: document.id,
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('Error creating audit document:', error)
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    )
  }
}
