'use client'

import { useState } from 'react'
import type { DateRange } from '@/types/script'
import { OverallPerformance } from './OverallPerformance'
import { NichePerformance } from './NichePerformance'
import { ScriptNicheMatrix } from './ScriptNicheMatrix'

interface ScriptAnalyticsProps {
  clientId: string
}

type View = 'overall' | 'by-niche' | 'matrix'

export function ScriptAnalytics({ clientId }: ScriptAnalyticsProps) {
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [activeView, setActiveView] = useState<View>('overall')

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h3 className="text-lg font-semibold text-gray-900">Script Analytics</h3>

        {/* Date Range Filter */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { value: '7d' as DateRange, label: 'Last 7 days' },
            { value: '30d' as DateRange, label: 'Last 30 days' },
            { value: '90d' as DateRange, label: 'Last 90 days' },
            { value: 'all' as DateRange, label: 'All time' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setDateRange(option.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                dateRange === option.value
                  ? 'bg-white text-gray-900 shadow-sm font-medium'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* View Selector */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { value: 'overall' as View, label: 'Overall' },
          { value: 'by-niche' as View, label: 'By Niche' },
          { value: 'matrix' as View, label: 'By Script + Niche' },
        ].map((view) => (
          <button
            key={view.value}
            onClick={() => setActiveView(view.value)}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              activeView === view.value
                ? 'bg-white text-gray-900 shadow-sm font-medium'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      {/* View Content */}
      <div className="mt-4">
        {activeView === 'overall' && (
          <OverallPerformance clientId={clientId} dateRange={dateRange} />
        )}
        {activeView === 'by-niche' && (
          <NichePerformance clientId={clientId} dateRange={dateRange} />
        )}
        {activeView === 'matrix' && (
          <ScriptNicheMatrix clientId={clientId} dateRange={dateRange} />
        )}
      </div>
    </div>
  )
}
