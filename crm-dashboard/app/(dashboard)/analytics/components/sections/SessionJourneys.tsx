'use client'

import { useMemo, useState } from 'react'
import { Visit } from '../shared/types'
import { formatEventName, getEventColor } from '../shared/constants'
import { StatCard } from '../shared/StatCard'
import { format, differenceInSeconds } from 'date-fns'

interface Session {
  session_id: string
  events: Visit[]
  startTime: Date
  duration: number
  eventCount: number
  pageCount: number
}

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function SessionJourneys({ visits }: { visits: Visit[] }) {
  const [showAll, setShowAll] = useState(false)

  const sessions = useMemo(() => {
    // Group visits by session_id
    const sessionMap = new Map<string, Visit[]>()

    visits.forEach((visit) => {
      if (!visit.session_id) return

      if (!sessionMap.has(visit.session_id)) {
        sessionMap.set(visit.session_id, [])
      }
      sessionMap.get(visit.session_id)!.push(visit)
    })

    // Sort events within each session chronologically, compute session stats
    const sessionList: Session[] = []

    sessionMap.forEach((events, session_id) => {
      // Sort events chronologically
      events.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

      const startTime = new Date(events[0].created_at)
      const endTime = new Date(events[events.length - 1].created_at)
      const duration = differenceInSeconds(endTime, startTime)
      const eventCount = events.length
      const pageCount = events.filter((e) => !e.event_name).length

      sessionList.push({
        session_id,
        events,
        startTime,
        duration,
        eventCount,
        pageCount,
      })
    })

    // Sort sessions by start time, most recent first
    return sessionList.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
  }, [visits])

  const stats = useMemo(() => {
    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        avgEventsPerSession: 0,
        avgSessionDuration: 0,
      }
    }

    const totalEvents = sessions.reduce((sum, s) => sum + s.eventCount, 0)
    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0)

    return {
      totalSessions: sessions.length,
      avgEventsPerSession: Math.round((totalEvents / sessions.length) * 10) / 10,
      avgSessionDuration: Math.round(totalDuration / sessions.length),
    }
  }, [sessions])

  const displayedSessions = showAll ? sessions : sessions.slice(0, 10)

  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Session Journeys</h2>
        <p className="text-gray-600">No session data available</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Session Journeys</h2>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Sessions" value={stats.totalSessions} color="blue" />
        <StatCard label="Avg Events/Session" value={stats.avgEventsPerSession} color="indigo" />
        <StatCard
          label="Avg Session Duration"
          value={formatDuration(stats.avgSessionDuration)}
          color="purple"
        />
      </div>

      {/* Session list */}
      <div className="space-y-4">
        {displayedSessions.map((session) => (
          <div key={session.session_id} className="border border-gray-200 rounded-lg p-4">
            {/* Session header */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900">
                  {format(session.startTime, 'MMM d, h:mm a')}
                </span>
                <span className="text-xs text-gray-500">Duration: {formatDuration(session.duration)}</span>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {session.eventCount} events
              </span>
            </div>

            {/* Event timeline */}
            <div className="space-y-2">
              {session.events.map((event, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <span className="text-xs text-gray-500 w-20">
                    {format(new Date(event.created_at), 'h:mm:ss a')}
                  </span>
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: event.event_name
                        ? getEventColor(event.event_name)
                        : '#9ca3af',
                    }}
                  />
                  <span className="text-gray-900">
                    {event.event_name ? formatEventName(event.event_name) : event.page_path || '(unknown page)'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Show more button */}
      {!showAll && sessions.length > 10 && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-4 w-full py-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Show {sessions.length - 10} more sessions
        </button>
      )}
    </div>
  )
}
