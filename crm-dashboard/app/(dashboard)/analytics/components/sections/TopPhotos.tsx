import { useMemo } from 'react'
import { Visit } from '../shared/types'

interface TopPhoto {
  photoId: string
  filename: string | null
  count: number
  pagePath: string | null
}

export function TopPhotos({ visits }: { visits: Visit[] }) {
  const topPhotos = useMemo(() => {
    const instantDls = visits.filter((v) => v.event_name === 'instant_download')
    const photoDownloads: Record<
      string,
      { count: number; filename: string | null; pagePath: string | null }
    > = {}

    instantDls.forEach((v) => {
      const data = v.event_data as any
      const photoId = data?.photo_id
      if (!photoId) return
      if (!photoDownloads[photoId]) {
        photoDownloads[photoId] = {
          count: 0,
          filename: data?.filename ?? null,
          pagePath: v.page_path,
        }
      }
      photoDownloads[photoId].count++
      // Update filename if we get one (newer events may have it)
      if (data?.filename) photoDownloads[photoId].filename = data.filename
    })

    return Object.entries(photoDownloads)
      .map(([photoId, d]) => ({ photoId, ...d }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [visits])

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Downloaded Photos</h2>
      {topPhotos.length === 0 ? (
        <p className="text-gray-500">No download data yet</p>
      ) : (
        <div className="space-y-3">
          {topPhotos.map((photo, i) => (
            <div key={photo.photoId} className="flex items-center">
              <div className="w-6 text-sm font-medium text-gray-400">{i + 1}.</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {photo.filename || photo.photoId.slice(0, 8) + '...'}
                </div>
                {photo.pagePath && (
                  <div className="text-xs text-gray-500 truncate">{photo.pagePath}</div>
                )}
              </div>
              <div className="ml-4 text-sm font-semibold text-gray-600 w-12 text-right">
                {photo.count}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
