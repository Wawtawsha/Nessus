'use client'

import { useMemo } from 'react'
import { Visit } from '../shared/types'
import { StatCard } from '../shared/StatCard'

interface ReferrerCategory {
  name: string
  count: number
  percentage: number
  avgEventsPerSession: number
  color: string
}

export function ReferrerAnalysis({ visits }: { visits: Visit[] }) {
  const stats = useMemo(() => {
    // Categorize each visit by referrer
    const categories: Record<string, string[]> = {
      Direct: [],
      Facebook: [],
      Instagram: [],
      'Self-referral': [],
      Other: [],
    }

    visits.forEach((visit) => {
      const ref = visit.referrer?.toLowerCase() || ''
      const sessionId = visit.session_id

      if (!sessionId) return

      let category = 'Other'

      // STRICT PRECEDENCE ORDER
      // 1. Check tracking params FIRST (fbclid indicates Facebook click-through)
      if (ref.includes('fbclid')) {
        category = 'Facebook'
      }
      // 2. Check social domains
      else if (ref.includes('instagram.com') || ref.includes('l.instagram.com')) {
        category = 'Instagram'
      } else if (ref.includes('facebook.com') || ref.includes('m.facebook.com')) {
        category = 'Facebook'
      }
      // 3. Check self-referral
      else if (ref.includes('shrike.vercel.app')) {
        category = 'Self-referral'
      }
      // 4. Check null/empty
      else if (!visit.referrer || visit.referrer.trim() === '') {
        category = 'Direct'
      }
      // 5. Fallback: Other (already set)

      if (!categories[category].includes(sessionId)) {
        categories[category].push(sessionId)
      }
    })

    // Calculate engagement quality per source
    // For each category, compute avg events per session
    const categoryStats: ReferrerCategory[] = []

    Object.entries(categories).forEach(([name, sessionIds]) => {
      if (sessionIds.length === 0) {
        return
      }

      // Group visits by session for this category
      const sessionMap = new Map<string, Visit[]>()
      visits.forEach((visit) => {
        if (!visit.session_id || !sessionIds.includes(visit.session_id)) return
        if (!sessionMap.has(visit.session_id)) {
          sessionMap.set(visit.session_id, [])
        }
        sessionMap.get(visit.session_id)!.push(visit)
      })

      // For each session, determine the referrer category from the FIRST event (landing page)
      const sessionReferrers = new Map<string, string>()
      sessionMap.forEach((events, sessionId) => {
        // Sort by timestamp to find first event
        events.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        const firstEvent = events[0]
        const ref = firstEvent.referrer?.toLowerCase() || ''

        let category = 'Other'
        if (ref.includes('fbclid')) {
          category = 'Facebook'
        } else if (ref.includes('instagram.com') || ref.includes('l.instagram.com')) {
          category = 'Instagram'
        } else if (ref.includes('facebook.com') || ref.includes('m.facebook.com')) {
          category = 'Facebook'
        } else if (ref.includes('shrike.vercel.app')) {
          category = 'Self-referral'
        } else if (!firstEvent.referrer || firstEvent.referrer.trim() === '') {
          category = 'Direct'
        }

        sessionReferrers.set(sessionId, category)
      })

      // Count events per session for this category
      let totalEvents = 0
      let sessionCount = 0

      sessionMap.forEach((events, sessionId) => {
        if (sessionReferrers.get(sessionId) === name) {
          totalEvents += events.length
          sessionCount++
        }
      })

      const avgEventsPerSession = sessionCount > 0 ? totalEvents / sessionCount : 0

      const colorMap: Record<string, string> = {
        Direct: '#6b7280',
        Facebook: '#1877f2',
        Instagram: '#e4405f',
        'Self-referral': '#9ca3af',
        Other: '#d97706',
      }

      categoryStats.push({
        name,
        count: sessionIds.length,
        percentage: 0, // will calculate after we have total
        avgEventsPerSession: Math.round(avgEventsPerSession * 10) / 10,
        color: colorMap[name] || '#6b7280',
      })
    })

    // Calculate percentages
    const totalVisitsWithReferrer = visits.filter((v) => v.referrer !== null).length
    const totalSessions = categoryStats.reduce((sum, c) => sum + c.count, 0)

    categoryStats.forEach((cat) => {
      cat.percentage = totalSessions > 0 ? Math.round((cat.count / totalSessions) * 100) : 0
    })

    // Sort by count descending
    categoryStats.sort((a, b) => b.count - a.count)

    // Summary stats
    const socialTraffic =
      categoryStats.find((c) => c.name === 'Facebook')?.count || 0 +
      (categoryStats.find((c) => c.name === 'Instagram')?.count || 0)
    const socialPercentage = totalSessions > 0 ? Math.round((socialTraffic / totalSessions) * 100) : 0
    const topSource = categoryStats[0]?.name || 'N/A'
    const uniqueReferrers = new Set(visits.map((v) => v.referrer).filter((r) => r !== null)).size

    return {
      totalVisitsWithReferrer,
      uniqueReferrers,
      socialPercentage,
      topSource,
      categoryStats,
    }
  }, [visits])

  if (visits.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Referrer Analysis</h2>
        <p className="text-gray-600">No referrer data available</p>
      </div>
    )
  }

  const maxCount = stats.categoryStats[0]?.count || 1

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Referrer Analysis</h2>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Unique Sources" value={stats.uniqueReferrers} color="blue" />
        <StatCard label="Social Traffic" value={`${stats.socialPercentage}%`} color="indigo" />
        <StatCard label="Top Source" value={stats.topSource} color="purple" />
      </div>

      {/* Source breakdown table */}
      <div className="space-y-3">
        {stats.categoryStats.map((category) => (
          <div key={category.name} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm mb-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="font-medium text-gray-900">{category.name}</span>
                </div>
                <span className="text-gray-500">{category.percentage}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${(category.count / maxCount) * 100}%`,
                      backgroundColor: category.color,
                    }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-32 text-right">
                  {category.avgEventsPerSession} events/session
                </span>
              </div>
            </div>
            <div className="text-sm font-semibold text-gray-600 w-12 text-right">
              {category.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
