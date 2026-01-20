'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'

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
  // Joined lead data
  lead?: {
    id: string
    first_name: string
    last_name: string
    status: string
  } | null
}

const SOURCE_COLORS: Record<string, string> = {
  'In Store': 'bg-blue-100 text-blue-800',
  'Online': 'bg-green-100 text-green-800',
  'Phone': 'bg-yellow-100 text-yellow-800',
  'Third Party': 'bg-purple-100 text-purple-800',
}

function formatBusinessDate(dateInt: number): string {
  // business_date is in format YYYYMMDD as integer
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<ToastOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [matchFilter, setMatchFilter] = useState<string>('')
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const [sources, setSources] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const supabase = createClient()
  const { isAdmin, currentClientId } = useUser()

  const fetchOrders = useCallback(async () => {
    let query = supabase
      .from('toast_orders')
      .select(`
        *,
        lead:leads(id, first_name, last_name, status)
      `)
      .order('business_date', { ascending: false })
      .limit(500)

    // Admin filtering by selected client (client users filtered by RLS automatically)
    if (isAdmin && currentClientId) {
      query = query.eq('client_id', currentClientId)
    }

    // Match filter
    if (matchFilter === 'matched') {
      query = query.not('lead_id', 'is', null)
    } else if (matchFilter === 'unmatched') {
      query = query.is('lead_id', null)
    }

    // Source filter
    if (sourceFilter) {
      query = query.eq('source', sourceFilter)
    }

    // Date range filter (business_date is YYYYMMDD integer)
    if (dateFrom) {
      const fromInt = parseInt(dateFrom.replace(/-/g, ''), 10)
      query = query.gte('business_date', fromInt)
    }
    if (dateTo) {
      const toInt = parseInt(dateTo.replace(/-/g, ''), 10)
      query = query.lte('business_date', toInt)
    }

    // Search by customer name or email
    if (search) {
      query = query.or(`customer_first_name.ilike.%${search}%,customer_last_name.ilike.%${search}%,customer_email.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching orders:', error)
    } else {
      setOrders(data || [])
    }
    setLoading(false)
  }, [supabase, matchFilter, sourceFilter, search, dateFrom, dateTo, isAdmin, currentClientId])

  // Fetch unique sources for filter
  const fetchSources = useCallback(async () => {
    let query = supabase
      .from('toast_orders')
      .select('source')
      .not('source', 'is', null)

    if (isAdmin && currentClientId) {
      query = query.eq('client_id', currentClientId)
    }

    const { data } = await query

    if (data) {
      const uniqueSources = [...new Set(data.map((d) => d.source).filter(Boolean))]
      setSources(uniqueSources as string[])
    }
  }, [supabase, isAdmin, currentClientId])

  useEffect(() => {
    fetchOrders()
    fetchSources()
  }, [fetchOrders, fetchSources])

  // Calculate totals
  const totals = orders.reduce(
    (acc, order) => ({
      revenue: acc.revenue + (order.total_amount || 0),
      orders: acc.orders + 1,
      matched: acc.matched + (order.lead_id ? 1 : 0),
    }),
    { revenue: 0, orders: 0, matched: 0 }
  )

  const exportCSV = () => {
    const headers = [
      'Order #',
      'Date',
      'Customer',
      'Email',
      'Phone',
      'Source',
      'Subtotal',
      'Tax',
      'Tip',
      'Total',
      'Matched Lead',
    ]
    const rows = orders.map((order) => [
      order.display_number || order.toast_order_guid,
      formatBusinessDate(order.business_date),
      `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim(),
      order.customer_email || '',
      order.customer_phone || '',
      order.source || '',
      order.subtotal?.toFixed(2) || '0.00',
      order.tax_amount?.toFixed(2) || '0.00',
      order.tip_amount?.toFixed(2) || '0.00',
      order.total_amount?.toFixed(2) || '0.00',
      order.lead ? `${order.lead.first_name} ${order.lead.last_name}` : '',
    ])

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Toast Orders</h1>
        <button
          onClick={exportCSV}
          className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700"
        >
          Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total Revenue</div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(totals.revenue)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total Orders</div>
          <div className="text-2xl font-bold text-gray-900">{totals.orders}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Matched to Leads</div>
          <div className="text-2xl font-bold text-green-600">{totals.matched}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Avg Order Value</div>
          <div className="text-2xl font-bold text-gray-900">
            {totals.orders > 0 ? formatCurrency(totals.revenue / totals.orders) : '$0.00'}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <input
            type="text"
            placeholder="Search customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={matchFilter}
            onChange={(e) => setMatchFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Orders</option>
            <option value="matched">Matched to Lead</option>
            <option value="unmatched">Unmatched</option>
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Sources</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="From"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="To"
          />
          <button
            onClick={() => {
              setSearch('')
              setMatchFilter('')
              setSourceFilter('')
              setDateFrom('')
              setDateTo('')
            }}
            className="px-3 py-2 text-gray-600 hover:text-gray-900"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No orders found. Make sure Toast is connected and synced in Settings.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Matched Lead
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order.id} className={`hover:bg-gray-50 ${order.voided ? 'opacity-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      #{order.display_number || order.toast_order_guid.slice(0, 8)}
                    </div>
                    {order.voided && (
                      <span className="text-xs text-red-600">VOIDED</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {order.customer_first_name || order.customer_last_name
                        ? `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim()
                        : 'Guest'}
                    </div>
                    {order.customer_email && (
                      <div className="text-sm text-gray-500">{order.customer_email}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {order.source && (
                      <span className={`px-2 py-1 text-xs rounded-full ${SOURCE_COLORS[order.source] || 'bg-gray-100 text-gray-800'}`}>
                        {order.source}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(order.total_amount)}
                    </div>
                    {order.tip_amount > 0 && (
                      <div className="text-xs text-gray-500">
                        +{formatCurrency(order.tip_amount)} tip
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {order.lead ? (
                      <Link
                        href={`/leads/${order.lead.id}`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        {order.lead.first_name} {order.lead.last_name}
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatBusinessDate(order.business_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-500">
        Showing {orders.length} order{orders.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
