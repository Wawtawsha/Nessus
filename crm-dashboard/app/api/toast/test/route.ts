import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ToastClient } from '@/lib/toast/client'
import type { ToastTestRequest, ToastTestResponse } from '@/types/toast'

/**
 * POST /api/toast/test
 *
 * Test endpoint for Toast API discovery.
 * Accepts credentials, authenticates, and fetches sample orders.
 * Admin-only access.
 */
export async function POST(request: NextRequest): Promise<NextResponse<ToastTestResponse>> {
  const supabase = createClient()

  // Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Verify admin role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    )
  }

  // Parse request body
  let body: ToastTestRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  // Validate required fields
  if (!body.clientId || !body.clientSecret || !body.restaurantGuid) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: clientId, clientSecret, restaurantGuid' },
      { status: 400 }
    )
  }

  // Create Toast client
  const toastClient = new ToastClient({
    clientId: body.clientId,
    clientSecret: body.clientSecret,
    restaurantGuid: body.restaurantGuid,
    apiHostname: body.apiHostname,
  })

  // Test authentication first
  const authResult = await toastClient.testConnection()
  if (!authResult.success) {
    return NextResponse.json({
      success: false,
      error: `Authentication failed: ${authResult.error}`,
      authentication: { success: false },
    })
  }

  // Calculate date range (default: 1 day back)
  const daysBack = body.daysBack || 1
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysBack)

  try {
    // Fetch orders
    const orders = await toastClient.getOrders(startDate, endDate)

    // Return sample of orders for inspection (limit to 5 for readability)
    const sample = orders.slice(0, 5)

    return NextResponse.json({
      success: true,
      authentication: {
        success: true,
        tokenType: 'Bearer',
      },
      orders: {
        count: orders.length,
        sample,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch orders',
      authentication: { success: true },
    })
  }
}
