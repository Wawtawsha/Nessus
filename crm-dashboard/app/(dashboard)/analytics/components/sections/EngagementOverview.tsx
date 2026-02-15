import { useMemo } from 'react'
import { Visit } from '../shared/types'
import { StatCard } from '../shared/StatCard'

export function EngagementOverview({ visits }: { visits: Visit[] }) {
  const stats = useMemo(() => {
    const pageViews = visits.filter((v) => !v.event_name).length
    const sessions = new Set(visits.map((v) => v.session_id).filter(Boolean))
    const interactions = visits.filter((v) => v.event_name)
    const uniqueSessions = sessions.size

    return {
      pageViews,
      uniqueSessions,
      totalInteractions: interactions.length,
      avgInteractionsPerSession:
        uniqueSessions > 0
          ? Math.round((interactions.length / uniqueSessions) * 10) / 10
          : 0,
    }
  }, [visits])

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Engagement Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Page Views" value={stats.pageViews} color="blue" />
        <StatCard label="Unique Sessions" value={stats.uniqueSessions} color="indigo" />
        <StatCard label="Total Interactions" value={stats.totalInteractions} color="green" />
        <StatCard label="Avg Per Session" value={stats.avgInteractionsPerSession} color="purple" />
      </div>
    </div>
  )
}
