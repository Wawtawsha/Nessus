import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ToastClient } from '@/lib/toast/client'

interface SetupRequest {
  clientId: string // Nessus CRM client_id
  restaurantGuid: string
  toastClientId: string
  toastClientSecret: string
  apiHostname?: string
}

/**
 * POST /api/toast/setup
 * Save or update Toast credentials for a client.
 * Validates credentials before saving.
 * Admin-only.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()

  // Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Verify admin role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
  }

  // Parse request
  let body: SetupRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate required fields
  if (!body.clientId || !body.restaurantGuid || !body.toastClientId || !body.toastClientSecret) {
    return NextResponse.json({
      success: false,
      error: 'Missing required fields: clientId, restaurantGuid, toastClientId, toastClientSecret'
    }, { status: 400 })
  }

  // Verify the client exists
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', body.clientId)
    .single()

  if (!client) {
    return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 })
  }

  // Test the Toast credentials before saving
  const toastClient = new ToastClient({
    clientId: body.toastClientId,
    clientSecret: body.toastClientSecret,
    restaurantGuid: body.restaurantGuid,
    apiHostname: body.apiHostname,
  })

  const testResult = await toastClient.testConnection()
  if (!testResult.success) {
    return NextResponse.json({
      success: false,
      error: `Toast credentials invalid: ${testResult.error}`
    }, { status: 400 })
  }

  // Upsert the integration
  const { data: integration, error: upsertError } = await supabase
    .from('toast_integrations')
    .upsert({
      client_id: body.clientId,
      restaurant_guid: body.restaurantGuid,
      toast_client_id: body.toastClientId,
      toast_client_secret: body.toastClientSecret,
      api_hostname: body.apiHostname || 'https://ws-api.toasttab.com',
      is_active: true,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'client_id',
    })
    .select()
    .single()

  if (upsertError) {
    console.error('Toast integration upsert error:', upsertError)
    return NextResponse.json({
      success: false,
      error: 'Failed to save integration'
    }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    integration: {
      id: integration.id,
      client_id: integration.client_id,
      restaurant_guid: integration.restaurant_guid,
      is_active: integration.is_active,
      last_sync_at: integration.last_sync_at,
      last_sync_status: integration.last_sync_status,
    }
  })
}

/**
 * GET /api/toast/setup?clientId=xxx
 * Get Toast integration status for a client (without secrets).
 * Admin-only.
 */
export async function GET(request: NextRequest) {
  const supabase = createClient()

  // Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Verify admin role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
  }

  const clientId = request.nextUrl.searchParams.get('clientId')
  if (!clientId) {
    return NextResponse.json({ success: false, error: 'clientId required' }, { status: 400 })
  }

  const { data: integration } = await supabase
    .from('toast_integrations')
    .select('id, client_id, restaurant_guid, api_hostname, is_active, last_sync_at, last_sync_status, last_sync_error, created_at')
    .eq('client_id', clientId)
    .single()

  return NextResponse.json({
    success: true,
    integration: integration || null
  })
}

/**
 * DELETE /api/toast/setup?clientId=xxx
 * Remove Toast integration for a client.
 * Admin-only.
 */
export async function DELETE(request: NextRequest) {
  const supabase = createClient()

  // Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Verify admin role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
  }

  const clientId = request.nextUrl.searchParams.get('clientId')
  if (!clientId) {
    return NextResponse.json({ success: false, error: 'clientId required' }, { status: 400 })
  }

  const { error: deleteError } = await supabase
    .from('toast_integrations')
    .delete()
    .eq('client_id', clientId)

  if (deleteError) {
    return NextResponse.json({ success: false, error: 'Failed to delete integration' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
