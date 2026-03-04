import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function POST(
  request: Request,
  { params }: { params: { id: string; responseId: string } }
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

    if (!name || !fileUrl || !fileType || !fileSize) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const { data: response, error: responseError } = await supabase
      .from('AuditChecklistItemResponse')
      .select('id, auditId')
      .eq('id', params.responseId)
      .single()

    if (responseError || !response || response.auditId !== params.id) {
      return NextResponse.json(
        { error: 'Response not found' },
        { status: 404 }
      )
    }

    const { data: evidence, error } = await supabase
      .from('AuditChecklistEvidence')
      .insert({
        responseId: params.responseId,
        name,
        fileUrl,
        fileType,
        fileSize: parseInt(String(fileSize), 10),
        uploadedBy: user.id,
      })
      .select('*')
      .single()

    if (error || !evidence) {
      console.error('Error uploading evidence to Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to upload evidence' },
        { status: 500 }
      )
    }

    return NextResponse.json(evidence)
  } catch (error) {
    console.error('Error uploading evidence:', error)
    return NextResponse.json(
      { error: 'Failed to upload evidence' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; responseId: string } }
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

    const { searchParams } = new URL(request.url)
    const evidenceId = searchParams.get('evidenceId')

    if (!evidenceId) {
      return NextResponse.json(
        { error: 'Evidence ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('AuditChecklistEvidence')
      .delete()
      .eq('id', evidenceId)

    if (error) {
      console.error('Error deleting evidence in Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to delete evidence' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting evidence:', error)
    return NextResponse.json(
      { error: 'Failed to delete evidence' },
      { status: 500 }
    )
  }
}
