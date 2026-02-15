import { useMemo } from 'react'
import { Visit } from '../shared/types'
import { StatCard } from '../shared/StatCard'

export function DownloadMetrics({ visits }: { visits: Visit[] }) {
  const stats = useMemo(() => {
    const instantDls = visits.filter((v) => v.event_name === 'instant_download')
    const uniquePhotoIds = new Set(
      instantDls.map((v) => (v.event_data as any)?.photo_id).filter(Boolean)
    )

    return {
      instantDownloads: instantDls.length,
      uniquePhotos: uniquePhotoIds.size,
      queueOpens: visits.filter((v) => v.event_name === 'queue_blade_opened').length,
      emailSubmissions: visits.filter((v) => v.event_name === 'download_email_submitted')
        .length,
    }
  }, [visits])

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Download Metrics</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Instant Downloads" value={stats.instantDownloads} color="green" />
        <StatCard label="Unique Photos" value={stats.uniquePhotos} color="teal" />
        <StatCard label="Queue Opens" value={stats.queueOpens} color="blue" />
        <StatCard label="Email Submissions" value={stats.emailSubmissions} color="purple" />
      </div>
    </div>
  )
}
