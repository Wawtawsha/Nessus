import { useMemo } from 'react'
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
import { Visit } from '../shared/types'

interface DailyActivity {
  date: string
  count: number
}

export function ActivityTimeline({ visits }: { visits: Visit[] }) {
  const dailyActivity = useMemo(() => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentVisits = visits.filter((v) => new Date(v.created_at) >= thirtyDaysAgo)

    const dateCounts: Record<string, number> = {}
    // Pre-fill all dates in range
    for (let d = new Date(thirtyDaysAgo); d <= new Date(); d.setDate(d.getDate() + 1)) {
      dateCounts[d.toISOString().split('T')[0]] = 0
    }
    recentVisits.forEach((v) => {
      const date = new Date(v.created_at).toISOString().split('T')[0]
      dateCounts[date] = (dateCounts[date] || 0) + 1
    })

    return Object.entries(dateCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [visits])

  return (
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
                tickFormatter={(d) => {
                  const parts = d.split('-')
                  return `${parts[1]}/${parts[2]}`
                }}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                labelFormatter={(d) => {
                  const date = new Date(d + 'T00:00:00')
                  return date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
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
  )
}
