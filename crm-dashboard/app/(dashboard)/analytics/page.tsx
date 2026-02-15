'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/contexts/UserContext'
import { RevenueChart } from './components/RevenueChart'
import { ChartControls } from './components/ChartControls'
import { ShrikeAnalytics } from './components/ShrikeAnalytics'

const SHRIKE_CLIENT_ID = 'da6fa735-8143-4cdf-941c-5b6021cbc961'

interface Stats {
  totalLeads: number
  newLeads: number
  contactedLeads: number
  qualifiedLeads: number
  convertedLeads: number
  conversionRate: number
}

interface CampaignStats {
  campaign: string
  count: number
}

interface SourceStats {
  source: string
  count: number
}

interface DailyStats {
  date: string
  count: number
}

interface RevenueStats {
  totalRevenue: number
  orderCount: number
  avgOrderValue: number
  totalTips: number
  matchedOrders: number
  oldestOrderDate: string | null
}

interface PaymentStats {
  type: string
  cardType: string | null
  count: number
  amount: number
}

interface TopItem {
  name: string
  count: number
  revenue: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function AnalyticsPage() {
  const { currentClientId } = useUser()

  if (currentClientId === SHRIKE_CLIENT_ID) {
    return <ShrikeAnalytics />
  }

  return <DefaultAnalytics />
}

function DefaultAnalytics() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [campaignStats, setCampaignStats] = useState<CampaignStats[]>([])
  const [sourceStats, setSourceStats] = useState<SourceStats[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null)
  const [paymentStats, setPaymentStats] = useState<PaymentStats[]>([])
  const [topItems, setTopItems] = useState<TopItem[]>([])
  const [loading, setLoading] = useState(true)
  const [includeInvoices, setIncludeInvoices] = useState<boolean>(false)
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day')
  const [dateRange, setDateRange] = useState(() => {
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - 30)
    return { from, to }
  })
  const [revenueChartData, setRevenueChartData] = useState<{period: string; revenue: number; order_count: number}[]>([])

  const supabase = createClient()
  const { isAdmin, currentClientId } = useUser()

  const fetchStats = useCallback(async () => {
    // Helper to add client filter
    const addClientFilter = <T,>(query: T): T => {
      if (isAdmin && currentClientId) {
        return (query as any).eq('client_id', currentClientId)
      }
      return query
    }

    // Total leads by status
    let statusQuery = supabase.from('leads').select('status')
    statusQuery = addClientFilter(statusQuery)
    const { data: statusData } = await statusQuery

    if (statusData) {
      const total = statusData.length
      const newCount = statusData.filter((l) => l.status === 'new').length
      const contactedCount = statusData.filter((l) => l.status === 'contacted').length
      const qualifiedCount = statusData.filter((l) => l.status === 'qualified').length
      const convertedCount = statusData.filter((l) => l.status === 'converted').length

      setStats({
        totalLeads: total,
        newLeads: newCount,
        contactedLeads: contactedCount,
        qualifiedLeads: qualifiedCount,
        convertedLeads: convertedCount,
        conversionRate: total > 0 ? (convertedCount / total) * 100 : 0,
      })
    }

    // Leads by campaign
    let campaignQuery = supabase.from('leads').select('utm_campaign')
    campaignQuery = addClientFilter(campaignQuery)
    const { data: campaignData } = await campaignQuery

    if (campaignData) {
      const campaignCounts: Record<string, number> = {}
      campaignData.forEach((l) => {
        const campaign = l.utm_campaign || 'Direct'
        campaignCounts[campaign] = (campaignCounts[campaign] || 0) + 1
      })
      setCampaignStats(
        Object.entries(campaignCounts)
          .map(([campaign, count]) => ({ campaign, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      )
    }

    // Leads by source
    let sourceQuery = supabase.from('leads').select('utm_source')
    sourceQuery = addClientFilter(sourceQuery)
    const { data: sourceData } = await sourceQuery

    if (sourceData) {
      const sourceCounts: Record<string, number> = {}
      sourceData.forEach((l) => {
        const source = l.utm_source || 'Direct'
        sourceCounts[source] = (sourceCounts[source] || 0) + 1
      })
      setSourceStats(
        Object.entries(sourceCounts)
          .map(([source, count]) => ({ source, count }))
          .sort((a, b) => b.count - a.count)
      )
    }

    // Leads over time (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    let timeQuery = supabase
      .from('leads')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
    timeQuery = addClientFilter(timeQuery)
    const { data: timeData } = await timeQuery

    if (timeData) {
      const dateCounts: Record<string, number> = {}
      timeData.forEach((l) => {
        const date = new Date(l.created_at).toLocaleDateString()
        dateCounts[date] = (dateCounts[date] || 0) + 1
      })
      setDailyStats(
        Object.entries(dateCounts)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      )
    }

    // Revenue Stats from Toast Orders
    let ordersQuery = supabase
      .from('toast_orders')
      .select('total_amount, tip_amount, lead_id, business_date, source')
    ordersQuery = addClientFilter(ordersQuery)
    if (!includeInvoices) {
      ordersQuery = ordersQuery.neq('source', 'Invoice')
    }
    const { data: ordersData } = await ordersQuery

    if (ordersData && ordersData.length > 0) {
      const totalRevenue = ordersData.reduce((sum, o) => sum + (o.total_amount || 0), 0)
      const totalTips = ordersData.reduce((sum, o) => sum + (o.tip_amount || 0), 0)
      const matchedOrders = ordersData.filter(o => o.lead_id).length

      // Find oldest order date (business_date is YYYYMMDD integer)
      const oldestDate = ordersData.reduce((min, o) => {
        const bd = o.business_date
        return bd && (!min || bd < min) ? bd : min
      }, null as number | null)

      // Format YYYYMMDD to MM/DD/YY
      let oldestOrderDate: string | null = null
      if (oldestDate) {
        const dateStr = oldestDate.toString()
        const year = dateStr.slice(2, 4)
        const month = dateStr.slice(4, 6)
        const day = dateStr.slice(6, 8)
        oldestOrderDate = `${month}/${day}/${year}`
      }

      setRevenueStats({
        totalRevenue,
        orderCount: ordersData.length,
        avgOrderValue: totalRevenue / ordersData.length,
        totalTips,
        matchedOrders,
        oldestOrderDate,
      })
    }

    // Payment breakdown
    let paymentsQuery = supabase
      .from('toast_payments')
      .select('payment_type, card_type, amount')
    paymentsQuery = addClientFilter(paymentsQuery)
    const { data: paymentsData } = await paymentsQuery

    if (paymentsData && paymentsData.length > 0) {
      const paymentCounts: Record<string, { count: number; amount: number }> = {}
      paymentsData.forEach((p) => {
        const key = p.card_type ? `${p.payment_type} (${p.card_type})` : p.payment_type
        if (!paymentCounts[key]) {
          paymentCounts[key] = { count: 0, amount: 0 }
        }
        paymentCounts[key].count++
        paymentCounts[key].amount += p.amount || 0
      })
      setPaymentStats(
        Object.entries(paymentCounts)
          .map(([key, data]) => ({
            type: key,
            cardType: null,
            count: data.count,
            amount: data.amount,
          }))
          .sort((a, b) => b.amount - a.amount)
      )
    }

    // Top selling items
    let itemsQuery = supabase
      .from('toast_order_items')
      .select('display_name, quantity, price')
      .eq('is_modifier', false)
      .eq('voided', false)
    itemsQuery = addClientFilter(itemsQuery)
    const { data: itemsData } = await itemsQuery

    if (itemsData && itemsData.length > 0) {
      const itemCounts: Record<string, { count: number; revenue: number }> = {}
      itemsData.forEach((item) => {
        const name = item.display_name || 'Unknown'
        if (!itemCounts[name]) {
          itemCounts[name] = { count: 0, revenue: 0 }
        }
        itemCounts[name].count += item.quantity || 1
        itemCounts[name].revenue += item.price || 0
      })
      setTopItems(
        Object.entries(itemCounts)
          .map(([name, data]) => ({
            name,
            count: data.count,
            revenue: data.revenue,
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10)
      )
    }

    setLoading(false)
  }, [supabase, isAdmin, currentClientId, includeInvoices])

  // Fetch revenue chart data via RPC
  const fetchRevenueChartData = useCallback(async () => {
    const clientIdParam = isAdmin && currentClientId ? currentClientId : null

    const { data, error } = await supabase.rpc('get_revenue_by_period', {
      p_granularity: granularity,
      p_start_date: dateRange.from.toISOString().split('T')[0],
      p_end_date: dateRange.to.toISOString().split('T')[0],
      p_client_id: clientIdParam,
      p_include_invoices: includeInvoices
    })

    if (!error && data) {
      setRevenueChartData(data)
    } else {
      setRevenueChartData([])
    }
  }, [supabase, granularity, dateRange, isAdmin, currentClientId, includeInvoices])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    fetchRevenueChartData()
  }, [fetchRevenueChartData])

  // Poll for updates every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchStats])

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={includeInvoices}
            onChange={(e) => setIncludeInvoices(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-600">Include invoices</span>
        </label>
      </div>

      {/* Revenue Stats */}
      {revenueStats && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-700">{formatCurrency(revenueStats.totalRevenue)}</div>
              <div className="text-sm text-green-600">Total Revenue</div>
              {revenueStats.oldestOrderDate && (
                <div className="text-xs text-green-500 mt-1">since {revenueStats.oldestOrderDate}</div>
              )}
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-700">{revenueStats.orderCount}</div>
              <div className="text-sm text-blue-600">Orders</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-700">{formatCurrency(revenueStats.avgOrderValue)}</div>
              <div className="text-sm text-purple-600">Avg Order</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-700">{formatCurrency(revenueStats.totalTips)}</div>
              <div className="text-sm text-yellow-600">Tips</div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-indigo-700">{revenueStats.matchedOrders}</div>
              <div className="text-sm text-indigo-600">Matched to Leads</div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Over Time Chart */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Revenue Over Time</h2>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <ChartControls
            granularity={granularity}
            onGranularityChange={setGranularity}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
          <div className="mt-4">
            <RevenueChart data={revenueChartData} granularity={granularity} />
          </div>
        </div>
      </div>

      {/* Lead Stats */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Lead Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="Total Leads" value={stats?.totalLeads || 0} />
        <StatCard label="New" value={stats?.newLeads || 0} color="blue" />
        <StatCard label="Contacted" value={stats?.contactedLeads || 0} color="yellow" />
        <StatCard label="Qualified" value={stats?.qualifiedLeads || 0} color="green" />
        <StatCard label="Converted" value={stats?.convertedLeads || 0} color="purple" />
        <StatCard
          label="Conversion Rate"
          value={`${(stats?.conversionRate || 0).toFixed(1)}%`}
          color="indigo"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Campaign */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Leads by Campaign</h2>
          {campaignStats.length === 0 ? (
            <p className="text-gray-500">No data yet</p>
          ) : (
            <div className="space-y-3">
              {campaignStats.map((stat) => (
                <div key={stat.campaign} className="flex items-center">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{stat.campaign}</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${(stat.count / (campaignStats[0]?.count || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="ml-4 text-sm font-semibold text-gray-600 w-12 text-right">
                    {stat.count}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Source */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Leads by Source</h2>
          {sourceStats.length === 0 ? (
            <p className="text-gray-500">No data yet</p>
          ) : (
            <div className="space-y-3">
              {sourceStats.map((stat) => (
                <div key={stat.source} className="flex items-center">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{stat.source}</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{
                          width: `${(stat.count / (sourceStats[0]?.count || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="ml-4 text-sm font-semibold text-gray-600 w-12 text-right">
                    {stat.count}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Over Time */}
        <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Leads Over Time (Last 30 Days)</h2>
          {dailyStats.length === 0 ? (
            <p className="text-gray-500">No data yet</p>
          ) : (
            <div className="flex items-end h-48 gap-1">
              {dailyStats.map((stat) => {
                const maxCount = Math.max(...dailyStats.map((s) => s.count))
                const height = maxCount > 0 ? (stat.count / maxCount) * 100 : 0
                return (
                  <div
                    key={stat.date}
                    className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 cursor-pointer group relative"
                    style={{ height: `${Math.max(height, 5)}%` }}
                    title={`${stat.date}: ${stat.count} leads`}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                      {stat.count}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Payment Breakdown */}
        {paymentStats.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods</h2>
            <div className="space-y-3">
              {paymentStats.map((stat) => (
                <div key={stat.type} className="flex items-center">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{stat.type}</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{
                          width: `${(stat.amount / (paymentStats[0]?.amount || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-sm font-semibold text-gray-900">{formatCurrency(stat.amount)}</div>
                    <div className="text-xs text-gray-500">{stat.count} txns</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Selling Items */}
        {topItems.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Selling Items</h2>
            <div className="space-y-3">
              {topItems.map((item, i) => (
                <div key={item.name} className="flex items-center">
                  <div className="w-6 text-sm font-medium text-gray-400">{i + 1}.</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{item.name}</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{
                          width: `${(item.revenue / (topItems[0]?.revenue || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-sm font-semibold text-gray-900">{formatCurrency(item.revenue)}</div>
                    <div className="text-xs text-gray-500">{item.count} sold</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  color = 'gray',
}: {
  label: string
  value: number | string
  color?: string
}) {
  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-900',
    blue: 'bg-blue-100 text-blue-900',
    yellow: 'bg-yellow-100 text-yellow-900',
    green: 'bg-green-100 text-green-900',
    purple: 'bg-purple-100 text-purple-900',
    indigo: 'bg-indigo-100 text-indigo-900',
  }

  return (
    <div className={`rounded-lg p-4 ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm opacity-75">{label}</div>
    </div>
  )
}
