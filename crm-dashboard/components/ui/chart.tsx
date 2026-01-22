"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// Chart container for consistent sizing and styling
const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    config?: Record<string, { label: string; color: string }>
  }
>(({ className, children, config, ...props }, ref) => {
  // Create CSS variables from config
  const style = config
    ? Object.entries(config).reduce(
        (acc, [key, value]) => {
          acc[`--color-${key}`] = value.color
          return acc
        },
        {} as Record<string, string>
      )
    : {}

  return (
    <div
      ref={ref}
      className={cn("w-full", className)}
      style={style}
      {...props}
    >
      {children}
    </div>
  )
})
ChartContainer.displayName = "ChartContainer"

// Tooltip content component for Recharts
interface ChartTooltipContentProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number
    dataKey: string
    payload: Record<string, unknown>
  }>
  label?: string
  labelFormatter?: (value: string) => string
  formatter?: (value: number, name: string) => [string, string]
  hideLabel?: boolean
}

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  ChartTooltipContentProps & React.HTMLAttributes<HTMLDivElement>
>(
  (
    {
      active,
      payload,
      label,
      labelFormatter,
      formatter,
      hideLabel = false,
      className,
      ...props
    },
    ref
  ) => {
    if (!active || !payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md",
          className
        )}
        {...props}
      >
        {!hideLabel && label && (
          <div className="mb-1 font-medium text-gray-900">
            {labelFormatter ? labelFormatter(label) : label}
          </div>
        )}
        <div className="flex flex-col gap-1">
          {payload.map((item, index) => {
            const [formattedValue, formattedName] = formatter
              ? formatter(item.value, item.name)
              : [String(item.value), item.name]
            return (
              <div key={index} className="flex items-center gap-2">
                <span className="text-gray-600">{formattedName}:</span>
                <span className="font-medium text-gray-900">{formattedValue}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltipContent"

export { ChartContainer, ChartTooltipContent }
