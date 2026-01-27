import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ToastClient, ToastOrder } from '@/lib/toast/client'

interface SyncRequest {
  clientId: string
  startDate?: string // ISO date
  endDate?: string // ISO date
  fullSync?: boolean // Ignore last_sync_at and fetch full history
  daysBack?: number // How many days back to sync (default 30)
}

const BATCH_SIZE = 500 // Supabase recommends <= 1000 rows per upsert

/**
 * POST /api/toast/sync
 * Sync orders from Toast for a client.
 * Uses batch upserts for speed.
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
  let body: SyncRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.clientId) {
    return NextResponse.json({ success: false, error: 'clientId required' }, { status: 400 })
  }

  // Get the Toast integration for this client
  const { data: integration, error: integrationError } = await supabase
    .from('toast_integrations')
    .select('*')
    .eq('client_id', body.clientId)
    .eq('is_active', true)
    .single()

  if (integrationError || !integration) {
    return NextResponse.json({
      success: false,
      error: 'No active Toast integration found for this client'
    }, { status: 404 })
  }

  // Mark sync as in progress
  await supabase
    .from('toast_integrations')
    .update({ last_sync_status: 'in_progress', last_sync_error: null })
    .eq('id', integration.id)

  try {
    // Calculate date range
    const endDate = body.endDate ? new Date(body.endDate) : new Date()
    let startDate: Date
    const daysBack = body.daysBack || 30

    if (body.startDate) {
      startDate = new Date(body.startDate)
    } else if (integration.last_sync_at && !body.fullSync) {
      // Start from last sync (unless fullSync requested)
      startDate = new Date(integration.last_sync_at)
    } else {
      // Full sync: go back specified days (default 30)
      startDate = new Date()
      startDate.setDate(startDate.getDate() - daysBack)
    }

    // Create Toast client
    const toastClient = new ToastClient({
      clientId: integration.toast_client_id,
      clientSecret: integration.toast_client_secret,
      restaurantGuid: integration.restaurant_guid,
      apiHostname: integration.api_hostname,
    })

    // Fetch orders from Toast
    console.log(`[Sync] Fetching orders from ${startDate.toISOString()} to ${endDate.toISOString()}`)
    const orders = await toastClient.getOrders(startDate, endDate)
    console.log(`[Sync] Fetched ${orders.length} orders, starting batch insert...`)

    // Get existing leads for matching
    const { data: leads } = await supabase
      .from('leads')
      .select('id, email, phone')
      .eq('client_id', body.clientId)

    // Build lookup maps for lead matching
    const emailToLead = new Map<string, string>()
    const phoneToLead = new Map<string, string>()

    for (const lead of leads || []) {
      if (lead.email) {
        emailToLead.set(lead.email.toLowerCase(), lead.id)
      }
      if (lead.phone) {
        const normalizedPhone = lead.phone.replace(/\D/g, '')
        phoneToLead.set(normalizedPhone, lead.id)
      }
    }

    // Transform all orders to DB format
    const orderRows = orders.map(order => {
      const data = extractOrderData(order, body.clientId)

      // Try to match to a lead
      if (data.customer_email) {
        data.lead_id = emailToLead.get(data.customer_email.toLowerCase()) || null
      }
      if (!data.lead_id && data.customer_phone) {
        const normalizedPhone = data.customer_phone.replace(/\D/g, '')
        data.lead_id = phoneToLead.get(normalizedPhone) || null
      }

      return data
    })

    // Count leads matched
    const leadsMatched = orderRows.filter(o => o.lead_id).length

    // Batch upsert orders
    let ordersInserted = 0
    for (let i = 0; i < orderRows.length; i += BATCH_SIZE) {
      const batch = orderRows.slice(i, i + BATCH_SIZE)
      console.log(`[Sync] Upserting orders batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(orderRows.length / BATCH_SIZE)} (${batch.length} orders)`)

      const { error } = await supabase
        .from('toast_orders')
        .upsert(batch, {
          onConflict: 'client_id,toast_order_guid',
        })

      if (error) {
        console.error(`[Sync] Batch upsert error:`, error)
      } else {
        ordersInserted += batch.length
      }
    }

    console.log(`[Sync] Orders complete. Now syncing line items and payments...`)

    // Get all order IDs we just inserted (for line items/payments)
    const { data: orderRecords } = await supabase
      .from('toast_orders')
      .select('id, toast_order_guid')
      .eq('client_id', body.clientId)
      .in('toast_order_guid', orders.map(o => o.guid))

    const guidToId = new Map<string, string>()
    for (const rec of orderRecords || []) {
      guidToId.set(rec.toast_order_guid, rec.id)
    }

    // Collect all line items and payments
    const allLineItems: Record<string, unknown>[] = []
    const allPayments: Record<string, unknown>[] = []

    for (const order of orders) {
      const orderId = guidToId.get(order.guid)
      if (!orderId) continue

      // Collect line items from ALL checks
      for (const check of order.checks || []) {
        for (const selection of check.selections || []) {
          allLineItems.push({
            order_id: orderId,
            client_id: body.clientId,
            toast_selection_guid: selection.guid,
            toast_item_guid: selection.item?.guid || null,
            display_name: selection.displayName || 'Unknown Item',
            quantity: selection.quantity || 1,
            unit_price: selection.preDiscountPrice / (selection.quantity || 1),
            pre_discount_price: selection.preDiscountPrice || 0,
            price: selection.price || 0,
            tax: selection.tax || 0,
            voided: selection.voided || false,
            seat_number: selection.seatNumber || null,
            is_modifier: false,
            parent_item_id: null,
          })
          // Note: skipping nested modifiers for speed - they complicate batching
        }

        // Collect payments
        for (const payment of check.payments || []) {
          allPayments.push({
            order_id: orderId,
            client_id: body.clientId,
            toast_payment_guid: payment.guid,
            payment_type: payment.type || 'OTHER',
            amount: payment.amount || 0,
            tip_amount: payment.tipAmount || 0,
            amount_tendered: payment.amountTendered || 0,
            card_type: payment.cardType || null,
            last_four: payment.lastFour || null,
            paid_date: payment.paidDate || null,
            refund_status: payment.refundStatus || null,
            voided: payment.voidInfo !== null,
          })
        }
      }
    }

    // Batch upsert line items
    let itemsInserted = 0
    for (let i = 0; i < allLineItems.length; i += BATCH_SIZE) {
      const batch = allLineItems.slice(i, i + BATCH_SIZE)
      console.log(`[Sync] Upserting line items batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allLineItems.length / BATCH_SIZE)}`)

      const { error } = await supabase
        .from('toast_order_items')
        .upsert(batch, {
          onConflict: 'order_id,toast_selection_guid',
        })

      if (!error) {
        itemsInserted += batch.length
      }
    }

    // Batch upsert payments
    let paymentsInserted = 0
    for (let i = 0; i < allPayments.length; i += BATCH_SIZE) {
      const batch = allPayments.slice(i, i + BATCH_SIZE)
      console.log(`[Sync] Upserting payments batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allPayments.length / BATCH_SIZE)}`)

      const { error } = await supabase
        .from('toast_payments')
        .upsert(batch, {
          onConflict: 'order_id,toast_payment_guid',
        })

      if (!error) {
        paymentsInserted += batch.length
      }
    }

    console.log(`[Sync] Complete! Orders: ${ordersInserted}, Items: ${itemsInserted}, Payments: ${paymentsInserted}`)

    // Update integration status
    await supabase
      .from('toast_integrations')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'success',
        last_sync_error: null,
      })
      .eq('id', integration.id)

    return NextResponse.json({
      success: true,
      stats: {
        ordersProcessed: orders.length,
        ordersInserted,
        leadsMatched,
        itemsInserted,
        paymentsInserted,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        }
      }
    })

  } catch (error) {
    // Update integration with error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Sync] Error:`, errorMessage)

    await supabase
      .from('toast_integrations')
      .update({
        last_sync_status: 'error',
        last_sync_error: errorMessage,
      })
      .eq('id', integration.id)

    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 })
  }
}

/**
 * Extract relevant data from a Toast order
 */
function extractOrderData(order: ToastOrder, clientId: string) {
  // Sum ALL checks (orders can have multiple tabs/splits)
  let subtotal = 0
  let taxAmount = 0
  let tipAmount = 0
  let totalAmount = 0
  let customer: { guid?: string; firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null } | null = null
  let checkGuid: string | null = null

  for (const check of order.checks || []) {
    subtotal += check.amount || 0
    taxAmount += check.taxAmount || 0
    totalAmount += check.totalAmount || 0
    // Sum tips from all payments in all checks
    for (const payment of check.payments || []) {
      tipAmount += payment.tipAmount || 0
    }
    // Use first customer found
    if (!customer && check.customer) {
      customer = check.customer
    }
    // Use first check GUID
    if (!checkGuid && check.guid) {
      checkGuid = check.guid
    }
  }

  // Extract delivery info if present
  const delivery = order.deliveryInfo

  return {
    client_id: clientId,
    toast_order_guid: order.guid,
    toast_check_guid: checkGuid,
    toast_customer_guid: customer?.guid || null,
    display_number: order.displayNumber || null,
    business_date: order.businessDate,
    opened_date: order.openedDate || null,
    closed_date: order.closedDate || null,
    paid_date: order.paidDate || null,
    source: order.source || null,
    voided: order.voided || false,
    number_of_guests: order.numberOfGuests || 1,
    subtotal: subtotal,
    tax_amount: taxAmount,
    tip_amount: tipAmount,
    total_amount: totalAmount,
    customer_first_name: customer?.firstName || null,
    customer_last_name: customer?.lastName || null,
    customer_email: customer?.email || null,
    customer_phone: customer?.phone || null,
    delivery_address: delivery ? `${delivery.address1 || ''} ${delivery.address2 || ''}`.trim() || null : null,
    delivery_city: delivery?.city || null,
    delivery_state: delivery?.state || null,
    delivery_zip: delivery?.zipCode || null,
    raw_data: order,
    synced_at: new Date().toISOString(),
    lead_id: null as string | null,
  }
}
