'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { NichePerformance as NichePerformanceData, DateRange } from '@/types/script'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface NichePerformanceProps {
  clientId: string
  dateRange: DateRange
}

function dateRangeToFilter(dateRange: DateRange): { start: Date | null; end: Date | null } {
  const now = new Date()
  switch (dateRange) {
    case '7d':
      return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now }
    case '30d':
      return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: now }
    case '90d':
      return { start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), end: now }
    case 'all':
      return { start: null, end: null }
  }
}

export function NichePerformance({ clientId, dateRange }: NichePerformanceProps) {
  const [data, setData] = useState<NichePerformanceData[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const { start, end } = dateRangeToFilter(dateRange)

      const { data: rawData, error } = await supabase.rpc('get_niche_performance_stats', {
        p_client_id: clientId,
        p_start_date: start?.toISOString() ?? null,
        p_end_date: end?.toISOString() ?? null,
      })

      if (error) {
        console.error('Error fetching niche performance:', error)
      } else {
        // Filter out niches with zero total count
        const filtered = (rawData || []).filter(
          (niche: NichePerformanceData) => niche.total_count > 0
        )
        setData(filtered)
      }
      setLoading(false)
    }

    fetchData()
  }, [clientId, dateRange, supabase])

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>
  }

  if (data.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4">
        No niche data yet. Assign niches to leads and record outcomes to see performance by niche.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="niche_name" />
        <YAxis label={{ value: 'Win Rate (%)', angle: -90, position: 'insideLeft' }} />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length > 0) {
              const niche = payload[0].payload as NichePerformanceData
              return (
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                  <p className="font-semibold text-sm text-gray-900">{niche.niche_name}</p>
                  <p className="text-sm text-gray-600">Win Rate: {niche.win_rate.toFixed(1)}%</p>
                  <p className="text-sm text-gray-600">Total Calls: {niche.total_count}</p>
                  <p className="text-sm text-green-600">Success: {niche.success_count}</p>
                  <p className="text-sm text-red-600">Fail: {niche.fail_count}</p>
                </div>
              )
            }
            return null
          }}
        />
        <Bar dataKey="win_rate" fill="#3b82f6" />
      </BarChart>
    </ResponsiveContainer>
  )
}
