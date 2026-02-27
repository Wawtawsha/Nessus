'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/contexts/UserContext'

function formatLabel(label: string): string {
  return label
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

interface VisitStats {
  totalVisits: number
  uniqueIPs: number
  uniqueSessions: number
}

interface LocationStats {
  country: string
  city: string | null
  count: number
}

interface PageStats {
  page_path: string
  count: number
}

interface ReferrerStats {
  referrer: string
  count: number
}

interface DailyStats {
  date: string
  count: number
}

const addSiteFilters = <T,>(query: T, clientId: string | null, websiteLabel: string): T => {
  let filtered = query as any
  if (clientId) {
    filtered = filtered.eq('client_id', clientId)
  }
  filtered = filtered.eq('website_label', websiteLabel)
  return filtered
}

function WebsiteCard({
  websiteLabel,
  websiteName,
  currentClientId,
  supabase,
}: {
  websiteLabel: string
  websiteName: string
  currentClientId: string | null
  supabase: ReturnType<typeof createClient>
}) {
  const [stats, setStats] = useState<VisitStats | null>(null)
  const [locationStats, setLocationStats] = useState<LocationStats[]>([])
  const [pageStats, setPageStats] = useState<PageStats[]>([])
  const [referrerStats, setReferrerStats] = useState<ReferrerStats[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    // Total visits and unique counts
    let visitsQuery = supabase.from('visits').select('ip_address, session_id')
    visitsQuery = addSiteFilters(visitsQuery, currentClientId, websiteLabel)
    const { data: visitsData } = await visitsQuery

    if (visitsData) {
      const uniqueIPs = new Set(visitsData.map((v) => v.ip_address).filter(Boolean))
      const uniqueSessions = new Set(visitsData.map((v) => v.session_id).filter(Boolean))

      setStats({
        totalVisits: visitsData.length,
        uniqueIPs: uniqueIPs.size,
        uniqueSessions: uniqueSessions.size,
      })
    }

    // Visits by location
    let locationQuery = supabase.from('visits').select('country, city')
    locationQuery = addSiteFilters(locationQuery, currentClientId, websiteLabel)
    const { data: locationData } = await locationQuery

    if (locationData) {
      const locationCounts: Record<string, { country: string; city: string | null; count: number }> = {}
      locationData.forEach((v) => {
        const key = `${v.country || 'Unknown'}|${v.city || ''}`
        if (!locationCounts[key]) {
          locationCounts[key] = { country: v.country || 'Unknown', city: v.city, count: 0 }
        }
        locationCounts[key].count++
      })
      setLocationStats(
        Object.values(locationCounts)
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      )
    }

    // Visits by page
    let pageQuery = supabase.from('visits').select('page_path')
    pageQuery = addSiteFilters(pageQuery, currentClientId, websiteLabel)
    const { data: pageData } = await pageQuery

    if (pageData) {
      const pageCounts: Record<string, number> = {}
      pageData.forEach((v) => {
        const path = v.page_path || '/'
        pageCounts[path] = (pageCounts[path] || 0) + 1
      })
      setPageStats(
        Object.entries(pageCounts)
          .map(([page_path, count]) => ({ page_path, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      )
    }

    // Visits by referrer
    let referrerQuery = supabase.from('visits').select('referrer')
    referrerQuery = addSiteFilters(referrerQuery, currentClientId, websiteLabel)
    const { data: referrerData } = await referrerQuery

    if (referrerData) {
      const referrerCounts: Record<string, number> = {}
      referrerData.forEach((v) => {
        const ref = v.referrer || 'Direct'
        referrerCounts[ref] = (referrerCounts[ref] || 0) + 1
      })
      setReferrerStats(
        Object.entries(referrerCounts)
          .map(([referrer, count]) => ({ referrer, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      )
    }

    // Visits over time (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    let timeQuery = supabase
      .from('visits')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
    timeQuery = addSiteFilters(timeQuery, currentClientId, websiteLabel)
    const { data: timeData } = await timeQuery

    if (timeData) {
      const dateCounts: Record<string, number> = {}
      timeData.forEach((v) => {
        const date = new Date(v.created_at).toLocaleDateString()
        dateCounts[date] = (dateCounts[date] || 0) + 1
      })
      setDailyStats(
        Object.entries(dateCounts)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      )
    }

    setLoading(false)
  }, [supabase, currentClientId, websiteLabel])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Poll for updates every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchStats])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{websiteName}</h2>
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="h-16 bg-gray-200 rounded-lg" />
            <div className="h-16 bg-gray-200 rounded-lg" />
            <div className="h-16 bg-gray-200 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-48 bg-gray-200 rounded-lg" />
            <div className="h-48 bg-gray-200 rounded-lg" />
          </div>
          <div className="h-48 bg-gray-200 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">{websiteName}</h2>

      {/* Overview Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Visits" value={stats?.totalVisits || 0} color="blue" />
        <StatCard label="Unique IPs" value={stats?.uniqueIPs || 0} color="green" />
        <StatCard label="Unique Sessions" value={stats?.uniqueSessions || 0} color="purple" />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Locations */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Visits by Location</h3>
          {locationStats.length === 0 ? (
            <p className="text-gray-500 text-sm">No data yet</p>
          ) : (
            <div className="space-y-2">
              {locationStats.map((stat, i) => (
                <div key={i} className="flex items-center">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-gray-900">
                      {stat.city ? `${stat.city}, ` : ''}{stat.country}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full"
                        style={{
                          width: `${(stat.count / (locationStats[0]?.count || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="ml-3 text-xs font-semibold text-gray-600 w-10 text-right">
                    {stat.count}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Pages */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Pages</h3>
          {pageStats.length === 0 ? (
            <p className="text-gray-500 text-sm">No data yet</p>
          ) : (
            <div className="space-y-2">
              {pageStats.map((stat) => (
                <div key={stat.page_path} className="flex items-center">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-gray-900 truncate" title={stat.page_path}>
                      {stat.page_path}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-green-600 h-1.5 rounded-full"
                        style={{
                          width: `${(stat.count / (pageStats[0]?.count || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="ml-3 text-xs font-semibold text-gray-600 w-10 text-right">
                    {stat.count}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Referrers */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Referrers</h3>
          {referrerStats.length === 0 ? (
            <p className="text-gray-500 text-sm">No data yet</p>
          ) : (
            <div className="space-y-2">
              {referrerStats.map((stat) => (
                <div key={stat.referrer} className="flex items-center">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-gray-900 truncate" title={stat.referrer}>
                      {stat.referrer === 'Direct' ? 'Direct' : (() => {
                        try {
                          return new URL(stat.referrer).hostname
                        } catch {
                          return stat.referrer
                        }
                      })()}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-purple-600 h-1.5 rounded-full"
                        style={{
                          width: `${(stat.count / (referrerStats[0]?.count || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="ml-3 text-xs font-semibold text-gray-600 w-10 text-right">
                    {stat.count}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Session Stats */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Session Stats</h3>
          <div className="text-sm text-gray-600 space-y-2">
            <div className="flex justify-between">
              <span>Avg visits/session:</span>
              <span className="font-medium">
                {stats && stats.uniqueSessions > 0
                  ? (stats.totalVisits / stats.uniqueSessions).toFixed(1)
                  : '0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Returning visitors:</span>
              <span className="font-medium">
                {stats && stats.totalVisits > 0
                  ? (((stats.totalVisits - stats.uniqueIPs) / stats.totalVisits) * 100).toFixed(1)
                  : '0'}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Visits Over Time */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Visits Over Time (Last 30 Days)</h3>
        {dailyStats.length === 0 ? (
          <p className="text-gray-500 text-sm">No data yet</p>
        ) : (
          <div className="flex items-end h-36 gap-0.5">
            {dailyStats.map((stat) => {
              const maxCount = Math.max(...dailyStats.map((s) => s.count))
              const height = maxCount > 0 ? (stat.count / maxCount) * 100 : 0
              return (
                <div
                  key={stat.date}
                  className="flex-1 bg-indigo-500 rounded-t hover:bg-indigo-600 cursor-pointer group relative"
                  style={{ height: `${Math.max(height, 5)}%` }}
                  title={`${stat.date}: ${stat.count} visits`}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                    {stat.count}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function VisitsPage() {
  const supabase = createClient()
  const { isAdmin, currentClientId } = useUser()
  const [websites, setWebsites] = useState<{ label: string; name: string }[]>([])
  const [loadingLabels, setLoadingLabels] = useState(true)

  useEffect(() => {
    async function fetchLabels() {
      let query = supabase
        .from('visits')
        .select('website_label')
        .not('website_label', 'is', null)
      if (currentClientId) {
        query = query.eq('client_id', currentClientId)
      }
      const { data } = await query
      if (data) {
        const unique = [...new Set(data.map((r) => r.website_label as string))]
        unique.sort()
        setWebsites(unique.map((label) => ({ label, name: formatLabel(label) })))
      }
      setLoadingLabels(false)
    }
    fetchLabels()
  }, [supabase, currentClientId])

  // Non-admin users must have a client selected
  if (!isAdmin && !currentClientId) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Select a client to view visitor analytics</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Visitor Analytics</h1>

      {loadingLabels ? (
        <div className="animate-pulse grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-gray-200 rounded-lg" />
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      ) : websites.length === 0 ? (
        <p className="text-gray-500">No visit data found</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {websites.map((site) => (
            <WebsiteCard
              key={site.label}
              websiteLabel={site.label}
              websiteName={site.name}
              currentClientId={currentClientId}
              supabase={supabase}
            />
          ))}
        </div>
      )}
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
