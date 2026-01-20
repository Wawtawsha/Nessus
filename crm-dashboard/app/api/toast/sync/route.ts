import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ToastClient, ToastOrder, ToastSelection, ToastPayment } from '@/lib/toast/client'
import { SupabaseClient } from '@supabase/supabase-js'

interface SyncRequest {
  clientId: string
  startDate?: string // ISO date
  endDate?: string // ISO date
}

/**
 * POST /api/toast/sync
 * Sync orders from Toast for a client.
 * Matches orders to leads by email/phone.
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

    if (body.startDate) {
      startDate = new Date(body.startDate)
    } else if (integration.last_sync_at) {
      // Start from last sync
      startDate = new Date(integration.last_sync_at)
    } else {
      // Default: 30 days back
      startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)
    }

    // Create Toast client
    const toastClient = new ToastClient({
      clientId: integration.toast_client_id,
      clientSecret: integration.toast_client_secret,
      restaurantGuid: integration.restaurant_guid,
      apiHostname: integration.api_hostname,
    })

    // Fetch orders from Toast
    const orders = await toastClient.getOrders(startDate, endDate)

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
        // Normalize phone: remove non-digits
        const normalizedPhone = lead.phone.replace(/\D/g, '')
        phoneToLead.set(normalizedPhone, lead.id)
      }
    }

    // Process orders
    let ordersInserted = 0
    let leadsMatched = 0
    let itemsInserted = 0
    let paymentsInserted = 0

    for (const order of orders) {
      const orderData = extractOrderData(order, body.clientId)

      // Try to match to a lead
      let leadId: string | null = null
      if (orderData.customer_email) {
        leadId = emailToLead.get(orderData.customer_email.toLowerCase()) || null
      }
      if (!leadId && orderData.customer_phone) {
        const normalizedPhone = orderData.customer_phone.replace(/\D/g, '')
        leadId = phoneToLead.get(normalizedPhone) || null
      }

      if (leadId) {
        orderData.lead_id = leadId
        leadsMatched++
      }

      // Upsert the order
      const { error: upsertError } = await supabase
        .from('toast_orders')
        .upsert(orderData, {
          onConflict: 'client_id,toast_order_guid',
        })

      if (!upsertError) {
        ordersInserted++

        // Query to get the order ID (upsert doesn't reliably return ID on conflict)
        const { data: orderRecord } = await supabase
          .from('toast_orders')
          .select('id')
          .eq('client_id', body.clientId)
          .eq('toast_order_guid', order.guid)
          .single()

        if (!orderRecord) continue
        const orderId = orderRecord.id

        // Extract and insert line items
        const check = order.checks?.[0]
        if (check?.selections) {
          const itemCount = await insertLineItems(
            supabase,
            orderId,
            body.clientId,
            check.selections
          )
          itemsInserted += itemCount
        }

        // Extract and insert payments
        if (check?.payments) {
          const paymentCount = await insertPayments(
            supabase,
            orderId,
            body.clientId,
            check.payments
          )
          paymentsInserted += paymentCount
        }
      }
    }

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
  // Get first check (most orders have one check)
  const check = order.checks?.[0]
  const customer = check?.customer
  const payments = check?.payments || []

  // Sum up tips from all payments
  const tipAmount = payments.reduce((sum, p) => sum + (p.tipAmount || 0), 0)

  // Extract delivery info if present
  const delivery = order.deliveryInfo

  return {
    client_id: clientId,
    toast_order_guid: order.guid,
    toast_check_guid: check?.guid || null,
    toast_customer_guid: customer?.guid || null,
    display_number: order.displayNumber || null,
    business_date: order.businessDate,
    opened_date: order.openedDate || null,
    closed_date: order.closedDate || null,
    paid_date: order.paidDate || null,
    source: order.source || null,
    voided: order.voided || false,
    number_of_guests: order.numberOfGuests || 1,
    subtotal: check?.amount || 0,
    tax_amount: check?.taxAmount || 0,
    tip_amount: tipAmount,
    total_amount: check?.totalAmount || 0,
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
    lead_id: null as string | null, // Will be set if matched
  }
}

/**
 * Insert line items from Toast selections
 * Handles nested modifiers recursively
 */
async function insertLineItems(
  supabase: SupabaseClient,
  orderId: string,
  clientId: string,
  selections: ToastSelection[],
  parentItemId: string | null = null
): Promise<number> {
  let count = 0

  for (const selection of selections) {
    const itemData = {
      order_id: orderId,
      client_id: clientId,
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
      is_modifier: parentItemId !== null,
      parent_item_id: parentItemId,
    }

    // Upsert the line item
    const { data: insertedItem, error } = await supabase
      .from('toast_order_items')
      .upsert(itemData, {
        onConflict: 'order_id,toast_selection_guid',
      })
      .select('id')
      .single()

    if (!error && insertedItem) {
      count++

      // Recursively insert modifiers
      if (selection.modifiers && selection.modifiers.length > 0) {
        const modifierCount = await insertLineItems(
          supabase,
          orderId,
          clientId,
          selection.modifiers,
          insertedItem.id
        )
        count += modifierCount
      }
    }
  }

  return count
}

/**
 * Insert payments from Toast check
 */
async function insertPayments(
  supabase: SupabaseClient,
  orderId: string,
  clientId: string,
  payments: ToastPayment[]
): Promise<number> {
  let count = 0

  for (const payment of payments) {
    const paymentData = {
      order_id: orderId,
      client_id: clientId,
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
    }

    // Upsert the payment
    const { error } = await supabase
      .from('toast_payments')
      .upsert(paymentData, {
        onConflict: 'order_id,toast_payment_guid',
      })

    if (!error) {
      count++
    }
  }

  return count
}
