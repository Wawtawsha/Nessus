'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Visit } from './shared/types'
import { EngagementOverview } from './sections/EngagementOverview'
import { DownloadMetrics } from './sections/DownloadMetrics'
import { TopPhotos } from './sections/TopPhotos'
import { FeatureUsage } from './sections/FeatureUsage'
import { EngagementFunnel } from './sections/EngagementFunnel'
import { ActivityTimeline } from './sections/ActivityTimeline'
import { PageDistribution } from './sections/PageDistribution'
import { DeviceBrowserOS } from './sections/DeviceBrowserOS'
import { SessionJourneys } from './sections/SessionJourneys'
import { TimeOnPage } from './sections/TimeOnPage'
import { ReferrerAnalysis } from './sections/ReferrerAnalysis'
import { GeoDistribution } from './sections/GeoDistribution'
import { ScrollDepth } from './sections/ScrollDepth'

const SHRIKE_CLIENT_ID = 'da6fa735-8143-4cdf-941c-5b6021cbc961'

type Tab = 'overview' | 'deep-dive'

export function ShrikeAnalytics() {
  const [siteFilter, setSiteFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [visits, setVisits] = useState<Visit[]>([])
  const [siteOptions, setSiteOptions] = useState<{ value: string; label: string }[]>([])

  const supabase = createClient()

  const addFilters = useCallback(
    <T,>(query: T): T => {
      let q = (query as any).eq('client_id', SHRIKE_CLIENT_ID)
      if (siteFilter !== 'all') {
        q = q.eq('website_label', siteFilter)
      }
      return q
    },
    [siteFilter]
  )

  const fetchData = useCallback(async () => {
    setLoading(true)

    const PAGE_SIZE = 1000
    const allVisits: Visit[] = []
    let offset = 0
    let done = false

    while (!done) {
      let query = supabase
        .from('visits')
        .select('event_name, event_data, session_id, page_path, created_at, user_agent, referrer, country, city, region, latitude, longitude')
        .order('created_at', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)
      query = addFilters(query)
      const { data } = await query

      if (data && data.length > 0) {
        allVisits.push(...(data as Visit[]))
        offset += data.length
        if (data.length < PAGE_SIZE) done = true
      } else {
        done = true
      }
    }

    setVisits(allVisits)
    setLoading(false)
  }, [supabase, addFilters])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Discover available site labels
  useEffect(() => {
    async function fetchLabels() {
      const { data } = await supabase
        .from('visits')
        .select('website_label')
        .eq('client_id', SHRIKE_CLIENT_ID)
        .not('website_label', 'is', null)
      if (data) {
        const unique = [...new Set(data.map((r) => r.website_label as string))].sort()
        setSiteOptions(
          unique.map((label) => ({
            value: label,
            label: label.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          }))
        )
      }
    }
    fetchLabels()
  }, [supabase])

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      {/* Header with site filter */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Website Analytics</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
          {[{ value: 'all', label: 'All Sites' }, ...siteOptions].map((option) => (
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

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {[
          { value: 'overview' as Tab, label: 'Overview' },
          { value: 'deep-dive' as Tab, label: 'Deep Dive' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              activeTab === tab.value
                ? 'bg-white text-gray-900 shadow-sm font-medium'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' ? (
        <>
          <EngagementOverview visits={visits} />
          <DownloadMetrics visits={visits} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <TopPhotos visits={visits} />
            <FeatureUsage visits={visits} />
          </div>
          <EngagementFunnel visits={visits} />
          <ActivityTimeline visits={visits} />
          <PageDistribution visits={visits} />
          <DeviceBrowserOS visits={visits} />
        </>
      ) : (
        <>
          <SessionJourneys visits={visits} />
          <TimeOnPage visits={visits} />
          <ReferrerAnalysis visits={visits} />
          <GeoDistribution visits={visits} />
          <ScrollDepth visits={visits} />
        </>
      )}
    </div>
  )
}
