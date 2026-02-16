'use client'

import { useMemo } from 'react'
import { Visit } from '../shared/types'
import { StatCard } from '../shared/StatCard'

interface PageScrollStats {
  pagePath: string
  totalSessions: number
  milestoneRates: Record<number, number>
}

export function ScrollDepth({ visits }: { visits: Visit[] }) {
  const stats = useMemo(() => {
    // Filter scroll events
    const scrollEvents = visits.filter(
      (v) => v.event_name === 'scroll_depth' && v.event_data?.percent_scrolled
    )

    if (scrollEvents.length === 0) {
      return null
    }

    // Count total sessions (page views) per page
    const pageViewsByPage = new Map<string, Set<string>>()
    visits
      .filter((v) => !v.event_name && v.page_path && v.session_id)
      .forEach((v) => {
        if (!pageViewsByPage.has(v.page_path!)) {
          pageViewsByPage.set(v.page_path!, new Set())
        }
        pageViewsByPage.get(v.page_path!)!.add(v.session_id!)
      })

    // Group scroll events by page_path, then track which sessions reached each milestone
    const pageScrollData = new Map<string, Map<number, Set<string>>>()
    scrollEvents.forEach((event) => {
      const page = event.page_path || 'Unknown'
      const percent = event.event_data.percent_scrolled as number
      const sessionId = event.session_id
      if (!sessionId) return

      if (!pageScrollData.has(page)) {
        pageScrollData.set(page, new Map())
      }
      const milestones = pageScrollData.get(page)!
      if (!milestones.has(percent)) {
        milestones.set(percent, new Set())
      }
      milestones.get(percent)!.add(sessionId)
    })

    // Calculate achievement rates per page
    const pageStats: PageScrollStats[] = []
    const milestoneValues = [25, 50, 75, 90, 100]

    pageScrollData.forEach((milestoneData, page) => {
      // Get total sessions for this page (fallback to unique sessions from scroll events)
      let totalSessions = pageViewsByPage.get(page)?.size || 0
      if (totalSessions === 0) {
        const uniqueSessions = new Set<string>()
        milestoneData.forEach((sessions) => {
          sessions.forEach((sid) => uniqueSessions.add(sid))
        })
        totalSessions = uniqueSessions.size
      }

      const milestoneRates: Record<number, number> = {}
      milestoneValues.forEach((milestone) => {
        const sessionsReaching = milestoneData.get(milestone)?.size || 0
        milestoneRates[milestone] =
          totalSessions > 0 ? Math.round((sessionsReaching / totalSessions) * 100) : 0
      })

      pageStats.push({
        pagePath: page,
        totalSessions,
        milestoneRates,
      })
    })

    // Sort by total sessions descending (most visited first)
    pageStats.sort((a, b) => b.totalSessions - a.totalSessions)

    // Calculate summary stats
    const pagesTracked = pageStats.length

    // avgMaxScroll: for each session, find max milestone reached, then average
    const sessionMaxScrolls = new Map<string, number>()
    scrollEvents.forEach((event) => {
      const sessionId = event.session_id
      const percent = event.event_data.percent_scrolled as number
      if (!sessionId) return

      const currentMax = sessionMaxScrolls.get(sessionId) || 0
      if (percent > currentMax) {
        sessionMaxScrolls.set(sessionId, percent)
      }
    })

    const avgMaxScroll =
      sessionMaxScrolls.size > 0
        ? Math.round(
            Array.from(sessionMaxScrolls.values()).reduce((sum, val) => sum + val, 0) /
              sessionMaxScrolls.size
          )
        : 0

    // mostReadPage: page with highest 100% achievement rate (or highest average milestone if no 100%)
    let mostReadPage = 'N/A'
    let highestReadScore = -1

    pageStats.forEach((page) => {
      const score100 = page.milestoneRates[100] || 0
      const avgScore =
        milestoneValues.reduce((sum, m) => sum + (page.milestoneRates[m] || 0), 0) /
        milestoneValues.length

      const score = score100 > 0 ? score100 : avgScore
      if (score > highestReadScore) {
        highestReadScore = score
        mostReadPage = page.pagePath
      }
    })

    // Truncate mostReadPage if too long
    if (mostReadPage.length > 30) {
      const segments = mostReadPage.split('/')
      mostReadPage = segments.slice(-2).join('/')
    }

    return {
      pagesTracked,
      avgMaxScroll,
      mostReadPage,
      pageStats: pageStats.slice(0, 10), // Top 10 pages
    }
  }, [visits])

  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Scroll Depth</h2>
        <p className="text-gray-500 text-sm">
          No scroll depth data yet. Scroll tracking will appear here once visitors interact with
          pages that have scroll depth tracking enabled.
        </p>
      </div>
    )
  }

  const milestoneColors: Record<number, string> = {
    25: 'bg-green-400',
    50: 'bg-blue-400',
    75: 'bg-yellow-400',
    90: 'bg-orange-400',
    100: 'bg-red-400',
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Scroll Depth</h2>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Pages Tracked" value={stats.pagesTracked} color="blue" />
        <StatCard label="Avg Max Scroll" value={`${stats.avgMaxScroll}%`} color="green" />
        <StatCard label="Most-Read Page" value={stats.mostReadPage} color="purple" />
      </div>

      {/* Per-page scroll depth */}
      <div className="space-y-6">
        {stats.pageStats.map((page) => {
          const displayPath =
            page.pagePath.length > 30
              ? page.pagePath.split('/').slice(-2).join('/')
              : page.pagePath

          return (
            <div key={page.pagePath} className="border-t pt-4 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">{displayPath}</h3>
                <span className="text-sm text-gray-500">{page.totalSessions} sessions</span>
              </div>

              <div className="space-y-2">
                {[25, 50, 75, 90, 100].map((milestone) => {
                  const rate = page.milestoneRates[milestone] || 0
                  return (
                    <div key={milestone} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 w-12">{milestone}%</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${milestoneColors[milestone]}`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-12 text-right">{rate}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
