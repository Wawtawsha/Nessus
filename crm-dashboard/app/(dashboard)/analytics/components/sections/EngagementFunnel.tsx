import { useMemo } from 'react'
import { Visit } from '../shared/types'

interface FunnelStep {
  label: string
  count: number
}

export function EngagementFunnel({ visits }: { visits: Visit[] }) {
  const { funnel, maxFunnel } = useMemo(() => {
    const visitCount = new Set(visits.map((v) => v.session_id).filter(Boolean)).size
    const promoShown = visits.filter((v) => v.event_name === 'promo_popup_shown').length
    const leadFormOpened = visits.filter((v) => v.event_name === 'lead_form_opened').length
    const leadFormSubmit = visits.filter((v) => v.event_name === 'lead_form_submit').length

    const steps = [
      { label: 'Unique Sessions', count: visitCount },
      { label: 'Promo Shown', count: promoShown },
      { label: 'Lead Form Opened', count: leadFormOpened },
      { label: 'Lead Submitted', count: leadFormSubmit },
    ]

    return {
      funnel: steps,
      maxFunnel: steps[0]?.count || 1,
    }
  }, [visits])

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Engagement Funnel</h2>
      <div className="flex items-end gap-4">
        {funnel.map((step, i) => {
          const width = maxFunnel > 0 ? (step.count / maxFunnel) * 100 : 0
          const prevCount = i > 0 ? funnel[i - 1].count : null
          const dropoff =
            prevCount && prevCount > 0
              ? Math.round(((prevCount - step.count) / prevCount) * 100)
              : null

          return (
            <div key={step.label} className="flex-1 flex flex-col items-center">
              {dropoff !== null && (
                <div className="text-xs text-red-500 mb-1">-{dropoff}%</div>
              )}
              <div className="w-full flex flex-col items-center">
                <div className="text-lg font-bold text-gray-900">{step.count}</div>
                <div
                  className="w-full rounded-lg transition-all"
                  style={{
                    height: `${Math.max(width * 1.2, 8)}px`,
                    backgroundColor: `hsl(${220 - i * 30}, 70%, ${55 + i * 5}%)`,
                  }}
                />
                <div className="text-xs text-gray-600 mt-2 text-center">{step.label}</div>
              </div>
              {i < funnel.length - 1 && (
                <div className="absolute text-gray-400 text-lg" style={{ right: '-12px' }}></div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
