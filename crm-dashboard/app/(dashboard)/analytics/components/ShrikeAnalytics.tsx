'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ChartContainer } from '@/components/ui/chart'

const SHRIKE_CLIENT_ID = 'da6fa735-8143-4cdf-941c-5b6021cbc961'

// Event categories for color-coding
const EVENT_CATEGORIES: Record<string, { label: string; color: string }> = {
  instant_download: { label: 'Downloads', color: '#22c55e' },
  photo_queued: { label: 'Downloads', color: '#22c55e' },
  photo_dequeued: { label: 'Downloads', color: '#22c55e' },
  download_email_submitted: { label: 'Downloads', color: '#22c55e' },
  queue_blade_opened: { label: 'Downloads', color: '#22c55e' },
  crosslink_collegethursday: { label: 'Navigation', color: '#3b82f6' },
  crosslink_pressclub: { label: 'Navigation', color: '#3b82f6' },
  promo_popup_shown: { label: 'Promo', color: '#eab308' },
  promo_popup_dismissed: { label: 'Promo', color: '#eab308' },
  banner_click: { label: 'Promo', color: '#eab308' },
  zip_downloaded: { label: 'Downloads', color: '#22c55e' },
  lead_form_opened: { label: 'Lead Capture', color: '#a855f7' },
  lead_form_submit: { label: 'Lead Capture', color: '#a855f7' },
  tip_click: { label: 'Engagement', color: '#f97316' },
  book_us_click: { label: 'Engagement', color: '#f97316' },
  calendly_click: { label: 'Engagement', color: '#f97316' },
  instagram_click: { label: 'Engagement', color: '#f97316' },
  like_photo: { label: 'Engagement', color: '#f97316' },
  comment_submitted: { label: 'Engagement', color: '#f97316' },
  photo_lightbox_opened: { label: 'Navigation', color: '#3b82f6' },
  theme_switched: { label: 'Navigation', color: '#3b82f6' },
  gallery_load_more: { label: 'Navigation', color: '#3b82f6' },
}

function getEventColor(eventName: string): string {
  return EVENT_CATEGORIES[eventName]?.color ?? '#6b7280'
}

interface EngagementStats {
  pageViews: number
  uniqueSessions: number
  totalInteractions: number
  avgInteractionsPerSession: number
}

interface DownloadStats {
  instantDownloads: number
  uniquePhotos: number
  queueOpens: number
  emailSubmissions: number
}

interface TopPhoto {
  photoId: string
  filename: string | null
  count: number
  pagePath: string | null
}

interface EventBreakdown {
  eventName: string
  count: number
}

interface FunnelStep {
  label: string
  count: number
}

interface DailyActivity {
  date: string
  count: number
}

interface PageDistribution {
  pagePath: string
  count: number
}

export function ShrikeAnalytics() {
  const [siteFilter, setSiteFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [engagement, setEngagement] = useState<EngagementStats | null>(null)
  const [downloads, setDownloads] = useState<DownloadStats | null>(null)
  const [topPhotos, setTopPhotos] = useState<TopPhoto[]>([])
  const [eventBreakdown, setEventBreakdown] = useState<EventBreakdown[]>([])
  const [funnel, setFunnel] = useState<FunnelStep[]>([])
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([])
  const [pageDistribution, setPageDistribution] = useState<PageDistribution[]>([])

  const supabase = createClient()

  const addFilters = useCallback(<T,>(query: T): T => {
    let q = (query as any).eq('client_id', SHRIKE_CLIENT_ID)
    if (siteFilter !== 'all') {
      q = q.eq('website_label', siteFilter)
    }
    return q
  }, [siteFilter])

  const fetchData = useCallback(async () => {
    setLoading(true)

    // Fetch all visits for this client in one query to minimize round trips
    let query = supabase
      .from('visits')
      .select('event_name, event_data, session_id, page_path, created_at')
    query = addFilters(query)
    const { data: visits } = await query

    if (!visits || visits.length === 0) {
      setLoading(false)
      return
    }

    // --- Section 1: Engagement Overview ---
    const pageViews = visits.filter(v => !v.event_name).length
    const sessions = new Set(visits.map(v => v.session_id).filter(Boolean))
    const interactions = visits.filter(v => v.event_name)
    const uniqueSessions = sessions.size

    setEngagement({
      pageViews,
      uniqueSessions,
      totalInteractions: interactions.length,
      avgInteractionsPerSession: uniqueSessions > 0
        ? Math.round((interactions.length / uniqueSessions) * 10) / 10
        : 0,
    })

    // --- Section 2: Download Stats ---
    const instantDls = visits.filter(v => v.event_name === 'instant_download')
    const uniquePhotoIds = new Set(
      instantDls.map(v => (v.event_data as any)?.photo_id).filter(Boolean)
    )

    setDownloads({
      instantDownloads: instantDls.length,
      uniquePhotos: uniquePhotoIds.size,
      queueOpens: visits.filter(v => v.event_name === 'queue_blade_opened').length,
      emailSubmissions: visits.filter(v => v.event_name === 'download_email_submitted').length,
    })

    // --- Section 3: Top Downloaded Photos ---
    const photoDownloads: Record<string, { count: number; filename: string | null; pagePath: string | null }> = {}
    instantDls.forEach(v => {
      const data = v.event_data as any
      const photoId = data?.photo_id
      if (!photoId) return
      if (!photoDownloads[photoId]) {
        photoDownloads[photoId] = { count: 0, filename: data?.filename ?? null, pagePath: v.page_path }
      }
      photoDownloads[photoId].count++
      // Update filename if we get one (newer events may have it)
      if (data?.filename) photoDownloads[photoId].filename = data.filename
    })

    setTopPhotos(
      Object.entries(photoDownloads)
        .map(([photoId, d]) => ({ photoId, ...d }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    )

    // --- Section 4: Feature Usage Breakdown ---
    const eventCounts: Record<string, number> = {}
    interactions.forEach(v => {
      const name = v.event_name!
      eventCounts[name] = (eventCounts[name] || 0) + 1
    })

    setEventBreakdown(
      Object.entries(eventCounts)
        .map(([eventName, count]) => ({ eventName, count }))
        .sort((a, b) => b.count - a.count)
    )

    // --- Section 5: Engagement Funnel ---
    const visitCount = new Set(visits.map(v => v.session_id).filter(Boolean)).size
    const promoShown = visits.filter(v => v.event_name === 'promo_popup_shown').length
    const leadFormOpened = visits.filter(v => v.event_name === 'lead_form_opened').length
    const leadFormSubmit = visits.filter(v => v.event_name === 'lead_form_submit').length

    setFunnel([
      { label: 'Unique Sessions', count: visitCount },
      { label: 'Promo Shown', count: promoShown },
      { label: 'Lead Form Opened', count: leadFormOpened },
      { label: 'Lead Submitted', count: leadFormSubmit },
    ])

    // --- Section 6: Activity Over Time (last 30 days) ---
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentVisits = visits.filter(v =>
      new Date(v.created_at) >= thirtyDaysAgo
    )

    const dateCounts: Record<string, number> = {}
    // Pre-fill all dates in range
    for (let d = new Date(thirtyDaysAgo); d <= new Date(); d.setDate(d.getDate() + 1)) {
      dateCounts[d.toISOString().split('T')[0]] = 0
    }
    recentVisits.forEach(v => {
      const date = new Date(v.created_at).toISOString().split('T')[0]
      dateCounts[date] = (dateCounts[date] || 0) + 1
    })

    setDailyActivity(
      Object.entries(dateCounts)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
    )

    // --- Section 7: Page Distribution ---
    const pageCounts: Record<string, number> = {}
    visits.filter(v => !v.event_name).forEach(v => {
      const path = v.page_path || 'Unknown'
      pageCounts[path] = (pageCounts[path] || 0) + 1
    })

    setPageDistribution(
      Object.entries(pageCounts)
        .map(([pagePath, count]) => ({ pagePath, count }))
        .sort((a, b) => b.count - a.count)
    )

    setLoading(false)
  }, [supabase, addFilters])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  const maxEvent = eventBreakdown[0]?.count || 1
  const maxPage = pageDistribution[0]?.count || 1
  const maxFunnel = funnel[0]?.count || 1

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Website Analytics</h1>
        {/* Section 8: Website Selector */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { value: 'all', label: 'All Sites' },
            { value: 'press-club', label: 'Press Club' },
            { value: 'rosemont', label: 'Rosemont' },
          ].map(option => (
            <button
              key={option.value}
              onClick={() => setSiteFilter(option.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                siteFilter === option.value
                  ? 'bg-white text-gray-900 shadow-sm font-medium'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section 1: Engagement Overview */}
      {engagement && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Engagement Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Page Views" value={engagement.pageViews} color="blue" />
            <StatCard label="Unique Sessions" value={engagement.uniqueSessions} color="indigo" />
            <StatCard label="Total Interactions" value={engagement.totalInteractions} color="green" />
            <StatCard label="Avg Per Session" value={engagement.avgInteractionsPerSession} color="purple" />
          </div>
        </div>
      )}

      {/* Section 2: Download Metrics */}
      {downloads && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Download Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Instant Downloads" value={downloads.instantDownloads} color="green" />
            <StatCard label="Unique Photos" value={downloads.uniquePhotos} color="teal" />
            <StatCard label="Queue Opens" value={downloads.queueOpens} color="blue" />
            <StatCard label="Email Submissions" value={downloads.emailSubmissions} color="purple" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Section 3: Top Downloaded Photos */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Downloaded Photos</h2>
          {topPhotos.length === 0 ? (
            <p className="text-gray-500">No download data yet</p>
          ) : (
            <div className="space-y-3">
              {topPhotos.map((photo, i) => (
                <div key={photo.photoId} className="flex items-center">
                  <div className="w-6 text-sm font-medium text-gray-400">{i + 1}.</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {photo.filename || photo.photoId.slice(0, 8) + '...'}
                    </div>
                    {photo.pagePath && (
                      <div className="text-xs text-gray-500 truncate">{photo.pagePath}</div>
                    )}
                  </div>
                  <div className="ml-4 text-sm font-semibold text-gray-600 w-12 text-right">
                    {photo.count}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 4: Feature Usage Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Feature Usage</h2>
          {eventBreakdown.length === 0 ? (
            <p className="text-gray-500">No interaction data yet</p>
          ) : (
            <div className="space-y-3">
              {eventBreakdown.map(event => (
                <div key={event.eventName} className="flex items-center">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {formatEventName(event.eventName)}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${(event.count / maxEvent) * 100}%`,
                          backgroundColor: getEventColor(event.eventName),
                        }}
                      />
                    </div>
                  </div>
                  <div className="ml-4 text-sm font-semibold text-gray-600 w-12 text-right">
                    {event.count}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 5: Engagement Funnel */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Engagement Funnel</h2>
        <div className="flex items-end gap-4">
          {funnel.map((step, i) => {
            const width = maxFunnel > 0 ? (step.count / maxFunnel) * 100 : 0
            const prevCount = i > 0 ? funnel[i - 1].count : null
            const dropoff = prevCount && prevCount > 0
              ? Math.round(((prevCount - step.count) / prevCount) * 100)
              : null

            return (
              <div key={step.label} className="flex-1 flex flex-col items-center">
                {dropoff !== null && (
                  <div className="text-xs text-red-500 mb-1">-{dropoff}%</div>
                )}
                <div className="w-full flex flex-col items-center">
                  <div className="text-lg font-bold text-gray-900">{step.count}</div>
                  <div
                    className="w-full rounded-lg transition-all"
                    style={{
                      height: `${Math.max(width * 1.2, 8)}px`,
                      backgroundColor: `hsl(${220 - i * 30}, 70%, ${55 + i * 5}%)`,
                    }}
                  />
                  <div className="text-xs text-gray-600 mt-2 text-center">{step.label}</div>
                </div>
                {i < funnel.length - 1 && (
                  <div className="absolute text-gray-400 text-lg" style={{ right: '-12px' }}>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Section 6: Activity Over Time */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity (Last 30 Days)</h2>
        {dailyActivity.length === 0 ? (
          <p className="text-gray-500">No recent activity</p>
        ) : (
          <ChartContainer
            config={{ count: { label: 'Events', color: '#3b82f6' } }}
            className="min-h-[250px] w-full"
          >
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyActivity} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tickFormatter={d => {
                    const parts = d.split('-')
                    return `${parts[1]}/${parts[2]}`
                  }}
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip
                  labelFormatter={d => {
                    const date = new Date(d + 'T00:00:00')
                    return date.toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                    })
                  }}
                  formatter={(value) => [value, 'Events']}
                />
                <Bar dataKey="count" fill="var(--color-count)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </div>

      {/* Section 7: Page Distribution */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Page Views by Page</h2>
        {pageDistribution.length === 0 ? (
          <p className="text-gray-500">No page view data</p>
        ) : (
          <div className="space-y-3">
            {pageDistribution.map(page => (
              <div key={page.pagePath} className="flex items-center">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{page.pagePath}</div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${(page.count / maxPage) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="ml-4 text-sm font-semibold text-gray-600 w-12 text-right">
                  {page.count}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    green: 'bg-green-50 text-green-700',
    purple: 'bg-purple-50 text-purple-700',
    teal: 'bg-teal-50 text-teal-700',
  }

  return (
    <div className={`rounded-lg p-4 ${colors[color] || colors.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm opacity-75">{label}</div>
    </div>
  )
}

function formatEventName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}
