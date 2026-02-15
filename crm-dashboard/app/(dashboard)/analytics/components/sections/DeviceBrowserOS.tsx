import { useMemo } from 'react'
import { Visit } from '../shared/types'
import { BreakdownCard, BreakdownItem } from '../shared/BreakdownCard'
import { parseUA } from '../shared/constants'

export function DeviceBrowserOS({ visits }: { visits: Visit[] }) {
  const breakdowns = useMemo(() => {
    // Only count unique sessions (not every row) for accurate visitor breakdown
    const sessionUAs = new Map<string, string>()
    visits.forEach((v) => {
      if (v.session_id && v.user_agent && !sessionUAs.has(v.session_id)) {
        sessionUAs.set(v.session_id, v.user_agent)
      }
    })

    const deviceCounts: Record<string, number> = {}
    const browserCounts: Record<string, number> = {}
    const osCounts: Record<string, number> = {}

    sessionUAs.forEach((ua) => {
      const parsed = parseUA(ua)
      deviceCounts[parsed.device] = (deviceCounts[parsed.device] || 0) + 1
      browserCounts[parsed.browser] = (browserCounts[parsed.browser] || 0) + 1
      osCounts[parsed.os] = (osCounts[parsed.os] || 0) + 1
    })

    const toSorted = (counts: Record<string, number>): BreakdownItem[] =>
      Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)

    return {
      deviceBreakdown: toSorted(deviceCounts),
      browserBreakdown: toSorted(browserCounts),
      osBreakdown: toSorted(osCounts),
    }
  }, [visits])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <BreakdownCard title="Device Type" items={breakdowns.deviceBreakdown} color="#6366f1" />
      <BreakdownCard title="Browser" items={breakdowns.browserBreakdown} color="#3b82f6" />
      <BreakdownCard title="Operating System" items={breakdowns.osBreakdown} color="#10b981" />
    </div>
  )
}
