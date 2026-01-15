'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/contexts/UserContext'

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

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [campaignStats, setCampaignStats] = useState<CampaignStats[]>([])
  const [sourceStats, setSourceStats] = useState<SourceStats[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [loading, setLoading] = useState(true)
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

    setLoading(false)
  }, [supabase, isAdmin, currentClientId])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Real-time subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel('analytics-leads-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => fetchStats()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Analytics</h1>

      {/* Overview Stats */}
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
