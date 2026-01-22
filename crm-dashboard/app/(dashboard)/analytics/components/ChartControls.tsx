'use client'

import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { DateRange } from 'react-day-picker'

type Granularity = 'day' | 'week' | 'month'

interface ChartControlsProps {
  granularity: Granularity
  onGranularityChange: (g: Granularity) => void
  dateRange: { from: Date; to: Date }
  onDateRangeChange: (range: { from: Date; to: Date }) => void
}

export function ChartControls({
  granularity,
  onGranularityChange,
  dateRange,
  onDateRangeChange,
}: ChartControlsProps) {
  const granularityOptions: { value: Granularity; label: string }[] = [
    { value: 'day', label: 'Daily' },
    { value: 'week', label: 'Weekly' },
    { value: 'month', label: 'Monthly' },
  ]

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      onDateRangeChange({ from: range.from, to: range.to })
    } else if (range?.from) {
      // Allow single date selection (from = to)
      onDateRangeChange({ from: range.from, to: range.from })
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      {/* Granularity Toggle */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
        {granularityOptions.map((option) => (
          <Button
            key={option.value}
            variant={granularity === option.value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onGranularityChange(option.value)}
            className={cn(
              'px-3',
              granularity === option.value
                ? 'bg-white shadow-sm hover:bg-white'
                : 'hover:bg-gray-200'
            )}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Date Range Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'justify-start text-left font-normal',
              !dateRange && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, 'MMM d, yyyy')} -{' '}
                  {format(dateRange.to, 'MMM d, yyyy')}
                </>
              ) : (
                format(dateRange.from, 'MMM d, yyyy')
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            defaultMonth={dateRange?.from}
            selected={{ from: dateRange.from, to: dateRange.to }}
            onSelect={handleDateRangeSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
