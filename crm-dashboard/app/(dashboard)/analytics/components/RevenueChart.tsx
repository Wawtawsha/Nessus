'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { ChartContainer } from '@/components/ui/chart'

interface RevenueDataPoint {
  period: string
  revenue: number
  order_count: number
}

interface RevenueChartProps {
  data: RevenueDataPoint[]
  granularity?: 'day' | 'week' | 'month'
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatXAxisDate(dateStr: string, granularity: 'day' | 'week' | 'month'): string {
  try {
    const date = parseISO(dateStr)
    switch (granularity) {
      case 'day':
        return format(date, 'MMM d')
      case 'week':
        return `Wk ${format(date, 'MMM d')}`
      case 'month':
        return format(date, 'MMM yyyy')
      default:
        return format(date, 'MMM d')
    }
  } catch {
    return dateStr
  }
}

function formatTooltipDate(dateStr: string, granularity: 'day' | 'week' | 'month'): string {
  try {
    const date = parseISO(dateStr)
    switch (granularity) {
      case 'day':
        return format(date, 'MMMM d, yyyy')
      case 'week':
        return `Week of ${format(date, 'MMMM d, yyyy')}`
      case 'month':
        return format(date, 'MMMM yyyy')
      default:
        return format(date, 'MMMM d, yyyy')
    }
  } catch {
    return dateStr
  }
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: RevenueDataPoint }>
  label?: string
  granularity: 'day' | 'week' | 'month'
}

function CustomTooltip({ active, payload, label, granularity }: CustomTooltipProps) {
  if (!active || !payload?.length) {
    return null
  }

  const data = payload[0].payload as RevenueDataPoint

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
      <div className="mb-1 font-medium text-gray-900">
        {formatTooltipDate(label as string, granularity)}
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-gray-600">Revenue:</span>
          <span className="font-medium text-gray-900">{formatCurrency(data.revenue)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-600">Orders:</span>
          <span className="font-medium text-gray-900">{data.order_count}</span>
        </div>
      </div>
    </div>
  )
}

export function RevenueChart({ data, granularity = 'day' }: RevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="min-h-[300px] w-full flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
        <p className="text-gray-500">No revenue data for selected period</p>
      </div>
    )
  }

  const chartConfig = {
    revenue: {
      label: 'Revenue',
      color: '#2563eb',
    },
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="period"
            tickFormatter={(value) => formatXAxisDate(value, granularity)}
            tick={{ fill: '#6b7280', fontSize: 12 }}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            tickFormatter={(value) => formatCurrency(value)}
            tick={{ fill: '#6b7280', fontSize: 12 }}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
            width={80}
          />
          <Tooltip content={<CustomTooltip granularity={granularity} />} />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="var(--color-revenue)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: 'var(--color-revenue)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
