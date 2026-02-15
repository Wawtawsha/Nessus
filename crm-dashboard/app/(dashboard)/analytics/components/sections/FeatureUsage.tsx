import { useMemo } from 'react'
import { Visit } from '../shared/types'
import { formatEventName, getEventColor } from '../shared/constants'

interface EventBreakdown {
  eventName: string
  count: number
}

export function FeatureUsage({ visits }: { visits: Visit[] }) {
  const { eventBreakdown, maxEvent } = useMemo(() => {
    const interactions = visits.filter((v) => v.event_name)
    const eventCounts: Record<string, number> = {}

    interactions.forEach((v) => {
      const name = v.event_name!
      eventCounts[name] = (eventCounts[name] || 0) + 1
    })

    const breakdown = Object.entries(eventCounts)
      .map(([eventName, count]) => ({ eventName, count }))
      .sort((a, b) => b.count - a.count)

    return {
      eventBreakdown: breakdown,
      maxEvent: breakdown[0]?.count || 1,
    }
  }, [visits])

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Feature Usage</h2>
      {eventBreakdown.length === 0 ? (
        <p className="text-gray-500">No interaction data yet</p>
      ) : (
        <div className="space-y-3">
          {eventBreakdown.map((event) => (
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
  )
}
