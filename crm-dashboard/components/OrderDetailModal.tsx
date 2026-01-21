'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LeadMatchingPanel } from './LeadMatchingPanel'

interface ToastOrder {
  id: string
  client_id: string
  toast_order_guid: string
  display_number: string | null
  business_date: number
  opened_date: string | null
  closed_date: string | null
  paid_date: string | null
  source: string | null
  voided: boolean
  number_of_guests: number
  subtotal: number
  tax_amount: number
  tip_amount: number
  total_amount: number
  customer_first_name: string | null
  customer_last_name: string | null
  customer_email: string | null
  customer_phone: string | null
  lead_id: string | null
  synced_at: string
}

interface ToastOrderItem {
  id: string
  order_id: string
  parent_item_id: string | null
  display_name: string
  quantity: number
  unit_price: number
  price: number
  tax: number
  voided: boolean
  is_modifier: boolean
  created_at: string
}

interface ToastPayment {
  id: string
  order_id: string
  payment_type: string
  amount: number
  tip_amount: number
  card_type: string | null
  last_four: string | null
  paid_date: string | null
  voided: boolean
}

interface OrderDetailModalProps {
  order: ToastOrder
  onClose: () => void
}

interface NestedItem extends ToastOrderItem {
  modifiers: ToastOrderItem[]
}

function formatBusinessDate(dateInt: number): string {
  const str = String(dateInt)
  if (str.length !== 8) return str
  const year = str.slice(0, 4)
  const month = str.slice(4, 6)
  const day = str.slice(6, 8)
  return `${month}/${day}/${year}`
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatPaymentType(type: string, cardType: string | null): string {
  if (type === 'CASH') return 'Cash'
  if (type === 'CREDIT' && cardType) {
    const formatted = cardType.charAt(0) + cardType.slice(1).toLowerCase()
    return `Credit (${formatted})`
  }
  if (type === 'CREDIT') return 'Credit Card'
  // Capitalize first letter, lowercase rest
  return type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, ' ')
}

export function OrderDetailModal({ order, onClose }: OrderDetailModalProps) {
  const [items, setItems] = useState<ToastOrderItem[]>([])
  const [payments, setPayments] = useState<ToastPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [isMatching, setIsMatching] = useState(false)
  const [matchSuccess, setMatchSuccess] = useState(false)
  const supabase = createClient()

  const handleMatch = async (leadId: string) => {
    try {
      const response = await fetch(`/api/orders/${order.id}/match`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      })

      if (!response.ok) {
        throw new Error('Failed to match')
      }

      setMatchSuccess(true)
      setIsMatching(false)

      // Close modal after brief delay to show success
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (error) {
      console.error('Match error:', error)
    }
  }

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        // Fetch line items - explicitly includes id field for nesting
        const { data: itemsData, error: itemsError } = await supabase
          .from('toast_order_items')
          .select('id, order_id, parent_item_id, display_name, quantity, unit_price, price, tax, voided, is_modifier, created_at')
          .eq('order_id', order.id)
          .order('created_at')

        if (itemsError) {
          console.error('Error fetching items:', itemsError)
        } else {
          setItems(itemsData || [])
        }

        // Fetch payments
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('toast_payments')
          .select('*')
          .eq('order_id', order.id)

        if (paymentsError) {
          console.error('Error fetching payments:', paymentsError)
        } else {
          setPayments(paymentsData || [])
        }
      } finally {
        setLoading(false)
      }
    }

    fetchOrderDetails()
  }, [order.id, supabase])

  // Build nested structure
  const rootItems = items.filter(i => !i.parent_item_id)
  const modifiers = items.filter(i => i.parent_item_id)

  const nestedItems: NestedItem[] = rootItems.map(item => ({
    ...item,
    modifiers: modifiers.filter(m => m.parent_item_id === item.id)
  }))

  // Calculate totals
  const itemsTotal = items
    .filter(i => !i.voided)
    .reduce((sum, item) => sum + item.price, 0)

  const paymentsTotal = payments
    .filter(p => !p.voided)
    .reduce((sum, payment) => sum + payment.amount + payment.tip_amount, 0)

  // Handle overlay click to close
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 p-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Order #{order.display_number || order.toast_order_guid.slice(0, 8)}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {formatBusinessDate(order.business_date)}
              </p>
            </div>
            <div className="flex items-start gap-2">
              {order.voided && (
                <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                  VOIDED
                </span>
              )}
              {!order.lead_id && !isMatching && !matchSuccess && (
                <button
                  onClick={() => setIsMatching(true)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Match to Lead
                </button>
              )}
              {matchSuccess && (
                <span className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-md">
                  Matched!
                </span>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {isMatching ? (
          <LeadMatchingPanel
            orderId={order.id}
            clientId={order.client_id}
            customerName={[order.customer_first_name, order.customer_last_name].filter(Boolean).join(' ') || null}
            customerEmail={order.customer_email}
            customerPhone={order.customer_phone}
            onMatch={handleMatch}
            onCancel={() => setIsMatching(false)}
          />
        ) : loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <>
            {/* Customer Section */}
            {(order.customer_first_name || order.customer_last_name || order.customer_email || order.customer_phone) && (
              <div className="border-b border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Customer</h3>
                <div className="text-sm text-gray-600">
                  {(order.customer_first_name || order.customer_last_name) && (
                    <div className="font-medium text-gray-900">
                      {`${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim()}
                    </div>
                  )}
                  {order.customer_email && <div>{order.customer_email}</div>}
                  {order.customer_phone && <div>{order.customer_phone}</div>}
                </div>
              </div>
            )}

            {/* Line Items Section */}
            <div className="border-b border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Items</h3>
              {nestedItems.length === 0 ? (
                <p className="text-sm text-gray-500">No items</p>
              ) : (
                <div className="space-y-2">
                  {nestedItems.map((item) => (
                    <div key={item.id}>
                      {/* Root item */}
                      <div className={`flex justify-between ${item.voided ? 'line-through text-gray-400' : ''}`}>
                        <div className="flex-1">
                          <span className="text-sm">
                            {item.quantity > 1 && `${item.quantity}x `}
                            {item.display_name}
                          </span>
                        </div>
                        <div className="text-sm font-medium">
                          {formatCurrency(item.price)}
                        </div>
                      </div>

                      {/* Modifiers (nested) */}
                      {item.modifiers.length > 0 && (
                        <div className="ml-6 space-y-1 mt-1">
                          {item.modifiers.map((modifier) => (
                            <div
                              key={modifier.id}
                              className={`flex justify-between text-sm text-gray-600 ${modifier.voided ? 'line-through text-gray-400' : ''}`}
                            >
                              <span>+ {modifier.display_name}</span>
                              {modifier.price !== 0 && (
                                <span>{formatCurrency(modifier.price)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="pt-2 mt-2 border-t border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium">{formatCurrency(order.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tax</span>
                      <span className="font-medium">{formatCurrency(order.tax_amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold mt-1">
                      <span>Total</span>
                      <span>{formatCurrency(order.total_amount)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Section */}
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment</h3>
              {payments.length === 0 ? (
                <p className="text-sm text-gray-500">No payment information</p>
              ) : (
                <div className="space-y-2">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className={payment.voided ? 'opacity-50 line-through' : ''}
                    >
                      <div className="flex justify-between text-sm">
                        <div>
                          <div className="font-medium">
                            {formatPaymentType(payment.payment_type, payment.card_type)}
                            {payment.last_four && ` ****${payment.last_four}`}
                          </div>
                          {payment.tip_amount > 0 && (
                            <div className="text-xs text-gray-500">
                              Tip: {formatCurrency(payment.tip_amount)}
                            </div>
                          )}
                        </div>
                        <div className="font-medium">
                          {formatCurrency(payment.amount + payment.tip_amount)}
                        </div>
                      </div>
                    </div>
                  ))}

                  {payments.length > 1 && (
                    <div className="pt-2 mt-2 border-t border-gray-200">
                      <div className="flex justify-between text-sm font-semibold">
                        <span>Total Paid</span>
                        <span>{formatCurrency(paymentsTotal)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
