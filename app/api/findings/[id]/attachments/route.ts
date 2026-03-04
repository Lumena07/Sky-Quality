import { randomUUID } from 'crypto'
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

    const { data: finding, error: findingError } = await supabase
      .from('Finding')
      .select('assignedToId')
      .eq('id', params.id)
      .single()

    if (findingError || !finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    if (finding.assignedToId !== user.id) {
      return NextResponse.json(
        { error: 'Only the person assigned to this finding can upload evidence' },
        { status: 403 }
      )
    }

    const { data: ca } = await supabase
      .from('CorrectiveAction')
      .select('capStatus')
      .eq('findingId', params.id)
      .single()

    if (!ca || (ca as { capStatus?: string }).capStatus !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Corrective Action Plan must be approved before you can upload evidence' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, fileUrl, fileType, fileSize } = body

    const { data: attachment, error } = await supabase
      .from('FindingAttachment')
      .insert({
        id: randomUUID(),
        findingId: params.id,
        name,
        fileUrl,
        fileType,
        fileSize,
        uploadedBy: user.id,
      })
      .select('*')
      .single()

    if (error || !attachment) {
      console.error('Error creating finding attachment in Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to create attachment' },
        { status: 500 }
      )
    }

    await createActivityLog({
      userId: user.id,
      action: 'UPLOAD',
      entityType: 'FindingAttachment',
      entityId: attachment.id,
      details: `Uploaded evidence: ${name}`,
      findingId: params.id,
    })

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    console.error('Error creating finding attachment:', error)
    return NextResponse.json(
      { error: 'Failed to create attachment' },
      { status: 500 }
    )
  }
}
