import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PATCH /api/orders/[id]/match
 * Update an order's lead_id to link it to a lead.
 * Body: { leadId: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  // Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse request body
  let body: { leadId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { leadId } = body
  if (!leadId) {
    return NextResponse.json({ error: 'leadId required' }, { status: 400 })
  }

  // Update the order's lead_id
  // RLS policy ensures user can only update orders they have access to
  const { data, error } = await supabase
    .from('toast_orders')
    .update({ lead_id: leadId })
    .eq('id', params.id)
    .select('id, lead_id')
    .single()

  if (error) {
    console.error('Error matching order to lead:', error)
    return NextResponse.json({ error: 'Failed to match order' }, { status: 500 })
  }

  return NextResponse.json({ success: true, order: data })
}
