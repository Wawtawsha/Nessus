import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ToastClient } from '@/lib/toast/client'

/**
 * GET /api/toast/diagnose?clientId=xxx&days=7
 * Quick diagnostic to see what Toast API returns.
 * Does NOT write to database.
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
  const days = parseInt(request.nextUrl.searchParams.get('days') || '7')

  if (!clientId) {
    return NextResponse.json({ success: false, error: 'clientId required' }, { status: 400 })
  }

  // Get the Toast integration
  const { data: integration, error: integrationError } = await supabase
    .from('toast_integrations')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .single()

  if (integrationError || !integration) {
    return NextResponse.json({
      success: false,
      error: 'No active Toast integration found'
    }, { status: 404 })
  }

  try {
    const toastClient = new ToastClient({
      clientId: integration.toast_client_id,
      clientSecret: integration.toast_client_secret,
      restaurantGuid: integration.restaurant_guid,
      apiHostname: integration.api_hostname,
    })

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    console.log(`[Diagnose] Fetching ${days} days of orders...`)
    const orders = await toastClient.getOrders(startDate, endDate)

    // Analyze the orders
    const ordersByDate = new Map<string, { count: number; netSales: number; grossSales: number }>()
    const sources = new Set<string>()
    const revenueCenters = new Set<string>()

    for (const order of orders) {
      // Sum ALL checks (orders can have multiple tabs/splits)
      // Use 'amount' (subtotal/net) not 'totalAmount' (includes tax)
      let orderNetSales = 0
      let orderTotalAmount = 0
      for (const check of order.checks || []) {
        orderNetSales += check.amount || 0  // Net sales (before tax)
        orderTotalAmount += check.totalAmount || 0  // Gross (with tax)
      }

      // Group by business date
      const dateKey = order.businessDate?.toString() || 'unknown'
      const existing = ordersByDate.get(dateKey) || { count: 0, netSales: 0, grossSales: 0 }
      ordersByDate.set(dateKey, {
        count: existing.count + 1,
        netSales: existing.netSales + orderNetSales,
        grossSales: existing.grossSales + orderTotalAmount,
      })

      // Track sources
      if (order.source) sources.add(order.source)

      // Track revenue centers
      if (order.revenueCenter?.guid) {
        revenueCenters.add(order.revenueCenter.guid)
      }
    }

    // Convert business dates (YYYYMMDD integers) to readable format
    const dateBreakdown = Array.from(ordersByDate.entries())
      .map(([date, data]) => {
        const dateStr = date.length === 8
          ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
          : date
        // Also add day of week
        let dayOfWeek = ''
        if (date.length === 8) {
          const d = new Date(parseInt(date.slice(0, 4)), parseInt(date.slice(4, 6)) - 1, parseInt(date.slice(6, 8)))
          dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' })
        }
        return { date: dateStr, dayOfWeek, ...data }
      })
      .sort((a, b) => b.date.localeCompare(a.date))

    // Calculate totals from all checks
    let totalNetSales = 0
    let totalGrossSales = 0
    for (const order of orders) {
      for (const check of order.checks || []) {
        totalNetSales += check.amount || 0
        totalGrossSales += check.totalAmount || 0
      }
    }

    return NextResponse.json({
      success: true,
      config: {
        restaurantGuid: integration.restaurant_guid,
        apiHostname: integration.api_hostname,
      },
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days,
      },
      results: {
        totalOrders: orders.length,
        totalNetSales,      // This should match Toast's "Net Sales"
        totalGrossSales,    // This includes tax
        sources: Array.from(sources),
        revenueCenters: Array.from(revenueCenters),
        dateBreakdown,
      },
      // Include first order as sample
      sampleOrder: orders[0] ? {
        guid: orders[0].guid,
        businessDate: orders[0].businessDate,
        totalAmount: orders[0].totalAmount,
        source: orders[0].source,
        revenueCenter: orders[0].revenueCenter,
        diningOption: orders[0].diningOption,
        checks: orders[0].checks?.length || 0,
      } : null,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
