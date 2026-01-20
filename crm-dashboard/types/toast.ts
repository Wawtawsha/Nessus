/**
 * Toast POS Types for Nessus CRM
 */

// Re-export types from the client
export type {
  ToastOrder,
  ToastCheck,
  ToastPayment,
  ToastCustomer,
  ToastDeliveryInfo,
  ToastSelection,
  ToastDiscount,
  ToastServiceCharge,
} from '@/lib/toast/client'

/**
 * Toast integration configuration stored per-client
 */
export interface ToastIntegration {
  id: string
  client_id: string
  restaurant_guid: string
  toast_client_id: string
  // Note: toast_client_secret is never sent to browser
  api_hostname: string
  is_active: boolean
  last_sync_at: string | null
  last_sync_status: 'success' | 'error' | 'in_progress' | null
  last_sync_error: string | null
  created_at: string
}

/**
 * Simplified Toast order stored in our database
 * Schema will be finalized after API discovery
 */
export interface StoredToastOrder {
  id: string
  client_id: string
  toast_order_guid: string
  order_date: string
  business_date: number
  total_amount: number
  tax_amount: number
  tip_amount: number
  discount_amount: number
  // Guest info for lead matching
  guest_email: string | null
  guest_phone: string | null
  guest_first_name: string | null
  guest_last_name: string | null
  // Linked lead
  lead_id: string | null
  // Order details
  source: string | null
  dining_option_guid: string | null
  server_guid: string | null
  number_of_guests: number
  voided: boolean
  // Store raw data for fields we might need later
  raw_data: Record<string, unknown>
  synced_at: string
  created_at: string
}

/**
 * Test endpoint request body
 */
export interface ToastTestRequest {
  clientId: string
  clientSecret: string
  restaurantGuid: string
  apiHostname?: string
  // Optional: fetch orders from this many days ago (default: 1)
  daysBack?: number
}

/**
 * Test endpoint response
 */
export interface ToastTestResponse {
  success: boolean
  error?: string
  authentication?: {
    success: boolean
    tokenType?: string
    expiresIn?: number
  }
  orders?: {
    count: number
    sample: unknown[] // Raw Toast order data for inspection
    dateRange: {
      start: string
      end: string
    }
  }
}

/**
 * Setup endpoint request body
 */
export interface ToastSetupRequest {
  clientId: string // Nessus CRM client_id
  restaurantGuid: string
  toastClientId: string
  toastClientSecret: string
  apiHostname?: string
}

/**
 * Sync endpoint request body
 */
export interface ToastSyncRequest {
  clientId: string // Nessus CRM client_id
  startDate?: string // ISO date, defaults to last sync or 30 days ago
  endDate?: string // ISO date, defaults to now
}

/**
 * Sync endpoint response
 */
export interface ToastSyncResponse {
  success: boolean
  error?: string
  stats?: {
    ordersProcessed: number
    ordersInserted: number
    ordersUpdated: number
    leadsMatched: number
    dateRange: {
      start: string
      end: string
    }
  }
}
