'use client'

import { useMemo } from 'react'
import { Visit } from '../shared/types'
import { StatCard } from '../shared/StatCard'
import { differenceInSeconds } from 'date-fns'

interface PageTimeStats {
  page: string
  avgTime: number
  median: number
  samples: number
}

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const cleanPagePath = (path: string): string => {
  // Remove trailing slashes
  const cleaned = path.replace(/\/$/, '')
  // Show "/" as "Home"
  return cleaned === '' || cleaned === '/' ? 'Home' : cleaned
}

export function TimeOnPage({ visits }: { visits: Visit[] }) {
  const pageTimeStats = useMemo(() => {
    // Group visits by session_id
    const sessionMap = new Map<string, Visit[]>()

    visits.forEach((visit) => {
      if (!visit.session_id) return

      if (!sessionMap.has(visit.session_id)) {
        sessionMap.set(visit.session_id, [])
      }
      sessionMap.get(visit.session_id)!.push(visit)
    })

    // Sort events within each session chronologically
    sessionMap.forEach((events) => {
      events.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    })

    // Calculate time on page for each session
    const pageDurations = new Map<string, number[]>() // path -> array of durations

    sessionMap.forEach((sessionEvents) => {
      // Iterate consecutive pairs (skip last event - no next timestamp)
      for (let i = 0; i < sessionEvents.length - 1; i++) {
        const current = sessionEvents[i]
        const next = sessionEvents[i + 1]

        // Only calculate duration for page views (not interaction events)
        if (current.event_name || !current.page_path) continue

        const duration = differenceInSeconds(
          new Date(next.created_at),
          new Date(current.created_at)
        )

        // Skip unrealistic durations (>30 min = likely abandoned tab)
        if (duration > 1800) continue

        if (!pageDurations.has(current.page_path)) {
          pageDurations.set(current.page_path, [])
        }
        pageDurations.get(current.page_path)!.push(duration)
      }
    })

    // Compute per-page stats
    const stats: PageTimeStats[] = Array.from(pageDurations.entries())
      .map(([page, durations]) => {
        const sorted = [...durations].sort((a, b) => a - b)
        const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        const median = sorted[Math.floor(sorted.length / 2)]

        return {
          page,
          avgTime: avg,
          median,
          samples: durations.length,
        }
      })
      .sort((a, b) => b.avgTime - a.avgTime)

    return stats
  }, [visits])

  const overallStats = useMemo(() => {
    if (pageTimeStats.length === 0) {
      return {
        totalPages: 0,
        overallAvgTime: 0,
        totalSamples: 0,
      }
    }

    const totalSamples = pageTimeStats.reduce((sum, p) => sum + p.samples, 0)
    const weightedTime = pageTimeStats.reduce((sum, p) => sum + p.avgTime * p.samples, 0)

    return {
      totalPages: pageTimeStats.length,
      overallAvgTime: Math.round(weightedTime / totalSamples),
      totalSamples,
    }
  }, [pageTimeStats])

  const maxTime = pageTimeStats.length > 0 ? pageTimeStats[0].avgTime : 1

  if (pageTimeStats.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Time on Page</h2>
        <p className="text-sm text-gray-500 mb-4">
          Based on page transition timing. Last page in each session excluded (no exit timestamp).
        </p>
        <p className="text-gray-600">Not enough session data to calculate time on page</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Time on Page</h2>
      <p className="text-sm text-gray-500 mb-4">
        Based on page transition timing. Last page in each session excluded (no exit timestamp).
      </p>

      {/* Overall stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Pages Measured" value={overallStats.totalPages} color="teal" />
        <StatCard
          label="Overall Avg Time"
          value={formatDuration(overallStats.overallAvgTime)}
          color="blue"
        />
        <StatCard label="Total Samples" value={overallStats.totalSamples} color="indigo" />
      </div>

      {/* Per-page breakdown */}
      <div className="space-y-3">
        {pageTimeStats.map((stat) => (
          <div key={stat.page} className="border-b border-gray-100 pb-3 last:border-b-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">
                {cleanPagePath(stat.page)}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{stat.samples} samples</span>
                <span className="text-sm font-semibold text-gray-900">
                  {formatDuration(stat.avgTime)}
                </span>
              </div>
            </div>
            {/* Visual bar */}
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-teal-500 h-2 rounded-full"
                style={{ width: `${(stat.avgTime / maxTime) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
