'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ScriptPerformance, DateRange } from '@/types/script'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface OverallPerformanceProps {
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

export function OverallPerformance({ clientId, dateRange }: OverallPerformanceProps) {
  const [stats, setStats] = useState<ScriptPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      const { start, end } = dateRangeToFilter(dateRange)

      const { data, error } = await supabase.rpc('get_script_outcome_stats', {
        p_client_id: clientId,
        p_start_date: start?.toISOString() ?? null,
        p_end_date: end?.toISOString() ?? null,
      })

      if (error) {
        console.error('Error fetching script performance:', error)
      } else {
        setStats(data || [])
      }
      setLoading(false)
    }

    fetchStats()
  }, [clientId, dateRange, supabase])

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>
  }

  if (stats.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4">
        No scripts yet. Create your first script to start tracking performance.
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Script</TableHead>
            <TableHead className="text-right">Total Calls</TableHead>
            <TableHead className="text-right">Success</TableHead>
            <TableHead className="text-right">Fail</TableHead>
            <TableHead className="text-right">Win Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.map((stat) => (
            <TableRow key={stat.script_id} className={stat.is_active ? '' : 'opacity-50'}>
              <TableCell>
                {stat.script_title}
                {!stat.is_active && (
                  <span className="ml-2 text-xs text-gray-400">(Inactive)</span>
                )}
              </TableCell>
              <TableCell className="text-right">{stat.total_count}</TableCell>
              <TableCell className="text-right text-green-600 font-medium">
                {stat.success_count}
              </TableCell>
              <TableCell className="text-right text-red-600 font-medium">
                {stat.fail_count}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {stat.total_count === 0 ? (
                  <span className="text-gray-400 italic font-normal">No data yet</span>
                ) : (
                  `${stat.win_rate.toFixed(1)}%`
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
