'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ScriptNicheCell, DateRange } from '@/types/script'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface ScriptNicheMatrixProps {
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

export function ScriptNicheMatrix({ clientId, dateRange }: ScriptNicheMatrixProps) {
  const [data, setData] = useState<ScriptNicheCell[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const { start, end } = dateRangeToFilter(dateRange)

      const { data: rawData, error } = await supabase.rpc('get_script_niche_matrix', {
        p_client_id: clientId,
        p_start_date: start?.toISOString() ?? null,
        p_end_date: end?.toISOString() ?? null,
      })

      if (error) {
        console.error('Error fetching script-niche matrix:', error)
      } else {
        // Filter out rows with zero outcomes
        const filtered = (rawData || []).filter(
          (row: ScriptNicheCell) => row.total_count > 0
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
        No script-niche data yet. Record outcomes for scripts on leads with assigned niches.
      </div>
    )
  }

  // Track previous script for grouping visual treatment
  let prevScriptId = ''

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Script</TableHead>
            <TableHead>Niche</TableHead>
            <TableHead className="text-right">Total Calls</TableHead>
            <TableHead className="text-right">Success</TableHead>
            <TableHead className="text-right">Fail</TableHead>
            <TableHead className="text-right">Win Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const isNewScript = row.script_id !== prevScriptId
            prevScriptId = row.script_id

            return (
              <TableRow
                key={`${row.script_id}-${row.niche_id}`}
                className={`${isNewScript ? 'border-t-2 border-gray-300' : ''} ${!row.is_active ? 'opacity-50' : ''}`}
              >
                <TableCell>
                  {row.script_title}
                  {!row.is_active && (
                    <span className="ml-1 text-xs text-gray-400 italic">(Inactive)</span>
                  )}
                </TableCell>
                <TableCell>{row.niche_name}</TableCell>
                <TableCell className="text-right">{row.total_count}</TableCell>
                <TableCell className="text-right text-green-600 font-medium">
                  {row.success_count}
                </TableCell>
                <TableCell className="text-right text-red-600 font-medium">
                  {row.fail_count}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {row.total_count === 0 ? (
                    <span className="text-gray-400 italic font-normal">No data yet</span>
                  ) : (
                    `${row.win_rate.toFixed(1)}%`
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
