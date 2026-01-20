/**
 * Toast POS API Client
 *
 * Uses OAuth2 client credentials flow for authentication.
 * Docs: https://doc.toasttab.com/
 */

interface ToastCredentials {
  clientId: string
  clientSecret: string
  restaurantGuid: string
  apiHostname?: string
}

interface ToastAuthResponse {
  '@class': string
  token: {
    tokenType: string
    scope: string | null
    expiresIn: number
    accessToken: string
    idToken: string | null
    refreshToken: string | null
  }
  status: string
}

interface ToastOrdersResponse {
  orders: ToastOrder[]
  // Pagination may be included
}

export interface ToastOrder {
  guid: string
  entityType: string
  externalId: string | null
  openedDate: string
  modifiedDate: string
  promisedDate: string | null
  diningOption: {
    guid: string
    entityType: string
    externalId: string | null
  } | null
  checks: ToastCheck[]
  table: {
    guid: string
    entityType: string
    externalId: string | null
  } | null
  serviceArea: {
    guid: string
    entityType: string
    externalId: string | null
  } | null
  restaurantService: {
    guid: string
    entityType: string
    externalId: string | null
  } | null
  revenueCenter: {
    guid: string
    entityType: string
    externalId: string | null
  } | null
  source: string
  duration: number | null
  deliveryInfo: ToastDeliveryInfo | null
  server: {
    guid: string
    entityType: string
    externalId: string | null
  } | null
  paidDate: string | null
  closedDate: string | null
  deletedDate: string | null
  deleted: boolean
  businessDate: number
  voided: boolean
  voidDate: string | null
  voidBusinessDate: number | null
  estimatedFulfillmentDate: string | null
  numberOfGuests: number
  price: number
  discountAmount: number
  taxAmount: number
  tipAmount: number
  totalAmount: number
  // Raw data for fields we haven't mapped
  [key: string]: unknown
}

export interface ToastCheck {
  guid: string
  entityType: string
  externalId: string | null
  displayNumber: string
  amount: number
  tabName: string | null
  taxAmount: number
  totalAmount: number
  payments: ToastPayment[]
  customer: ToastCustomer | null
  appliedLoyaltyInfo: unknown | null
  voided: boolean
  paidDate: string | null
  closedDate: string | null
  deletedDate: string | null
  deleted: boolean
  selections: ToastSelection[]
  appliedDiscounts: ToastDiscount[]
  appliedServiceCharges: ToastServiceCharge[]
}

export interface ToastPayment {
  guid: string
  entityType: string
  externalId: string | null
  paidDate: string | null
  paidBusinessDate: number | null
  type: string
  amount: number
  tipAmount: number
  amountTendered: number
  cardType: string | null
  lastFour: string | null
  originalProcessingFee: number | null
  refundStatus: string | null
  voidInfo: unknown | null
}

export interface ToastCustomer {
  guid: string
  entityType: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  email: string | null
}

export interface ToastDeliveryInfo {
  address1: string | null
  address2: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  latitude: number | null
  longitude: number | null
  notes: string | null
  deliveredDate: string | null
  dispatchedDate: string | null
  deliveryEmployee: unknown | null
  deliveryState: string | null
}

export interface ToastSelection {
  guid: string
  entityType: string
  externalId: string | null
  item: {
    guid: string
    entityType: string
    externalId: string | null
  }
  itemGroup: {
    guid: string
    entityType: string
    externalId: string | null
  } | null
  optionGroup: unknown | null
  preModifier: unknown | null
  quantity: number
  seatNumber: number | null
  unitOfMeasure: string
  selectionType: string
  salesCategory: {
    guid: string
    entityType: string
    externalId: string | null
  } | null
  preDiscountPrice: number
  price: number
  tax: number
  voided: boolean
  voidDate: string | null
  voidBusinessDate: number | null
  voidReason: unknown | null
  displayName: string
  createdDate: string
  modifiedDate: string
  modifiers: ToastSelection[]
  appliedDiscounts: ToastDiscount[]
}

export interface ToastDiscount {
  guid: string | null
  entityType: string
  externalId: string | null
  name: string | null
  discountAmount: number
  nonTaxDiscountAmount: number
  discount: {
    guid: string
    entityType: string
    externalId: string | null
  } | null
  triggers: unknown[]
  approver: unknown | null
  processingState: string | null
  loyaltyDetails: unknown | null
  comboItems: unknown[]
  appliedPromoCode: unknown | null
}

export interface ToastServiceCharge {
  guid: string
  entityType: string
  externalId: string | null
  name: string | null
  amount: number
  serviceCharge: {
    guid: string
    entityType: string
    externalId: string | null
  } | null
  gratuity: boolean
}

// Token cache (in-memory, per-instance)
const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>()

function getCacheKey(creds: ToastCredentials): string {
  return `${creds.clientId}:${creds.restaurantGuid}`
}

export class ToastClient {
  private credentials: ToastCredentials
  private baseUrl: string

  constructor(credentials: ToastCredentials) {
    this.credentials = credentials
    this.baseUrl = credentials.apiHostname || 'https://ws-api.toasttab.com'
  }

  /**
   * Authenticate using OAuth2 client credentials flow
   * Returns the access token string
   */
  async authenticate(): Promise<string> {
    const cacheKey = getCacheKey(this.credentials)
    const cached = tokenCache.get(cacheKey)

    // Return cached token if still valid (with 5-minute buffer)
    if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
      return cached.accessToken
    }

    const tokenUrl = `${this.baseUrl}/authentication/v1/authentication/login`

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: this.credentials.clientId,
        clientSecret: this.credentials.clientSecret,
        userAccessType: 'TOAST_MACHINE_CLIENT',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Toast authentication failed: ${response.status} - ${errorText}`)
    }

    const authResponse: ToastAuthResponse = await response.json()

    if (authResponse.status !== 'SUCCESS' || !authResponse.token?.accessToken) {
      throw new Error(`Toast authentication failed: ${authResponse.status}`)
    }

    // Cache the token
    tokenCache.set(cacheKey, {
      accessToken: authResponse.token.accessToken,
      expiresAt: Date.now() + (authResponse.token.expiresIn * 1000),
    })

    return authResponse.token.accessToken
  }

  /**
   * Fetch orders for a date range
   * Uses the ordersBulk endpoint for efficient retrieval
   */
  async getOrders(startDate: Date, endDate: Date): Promise<ToastOrder[]> {
    const accessToken = await this.authenticate()

    // Format dates as ISO strings
    const startDateStr = startDate.toISOString()
    const endDateStr = endDate.toISOString()

    const url = new URL(`${this.baseUrl}/orders/v2/ordersBulk`)
    url.searchParams.set('startDate', startDateStr)
    url.searchParams.set('endDate', endDateStr)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Toast-Restaurant-External-ID': this.credentials.restaurantGuid,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Toast orders fetch failed: ${response.status} - ${errorText}`)
    }

    // The response is a JSON array of orders, not wrapped in an object
    const orders: ToastOrder[] = await response.json()
    return orders
  }

  /**
   * Get a single order by GUID
   */
  async getOrder(orderGuid: string): Promise<ToastOrder> {
    const accessToken = await this.authenticate()

    const url = `${this.baseUrl}/orders/v2/orders/${orderGuid}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Toast-Restaurant-External-ID': this.credentials.restaurantGuid,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Toast order fetch failed: ${response.status} - ${errorText}`)
    }

    return await response.json()
  }

  /**
   * Test connection by attempting authentication
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.authenticate()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}
