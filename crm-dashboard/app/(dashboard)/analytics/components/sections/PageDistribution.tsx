import { useMemo } from 'react'
import { Visit } from '../shared/types'

interface PageDistribution {
  pagePath: string
  count: number
}

export function PageDistribution({ visits }: { visits: Visit[] }) {
  const { pageDistribution, maxPage } = useMemo(() => {
    const pageCounts: Record<string, number> = {}
    visits
      .filter((v) => !v.event_name)
      .forEach((v) => {
        const path = v.page_path || 'Unknown'
        pageCounts[path] = (pageCounts[path] || 0) + 1
      })

    const distribution = Object.entries(pageCounts)
      .map(([pagePath, count]) => ({ pagePath, count }))
      .sort((a, b) => b.count - a.count)

    return {
      pageDistribution: distribution,
      maxPage: distribution[0]?.count || 1,
    }
  }, [visits])

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Page Views by Page</h2>
      {pageDistribution.length === 0 ? (
        <p className="text-gray-500">No page view data</p>
      ) : (
        <div className="space-y-3">
          {pageDistribution.map((page) => (
            <div key={page.pagePath} className="flex items-center">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{page.pagePath}</div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(page.count / maxPage) * 100}%` }}
                  />
                </div>
              </div>
              <div className="ml-4 text-sm font-semibold text-gray-600 w-12 text-right">
                {page.count}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
