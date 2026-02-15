export interface BreakdownItem {
  name: string
  count: number
}

export function BreakdownCard({
  title,
  items,
  color,
}: {
  title: string
  items: BreakdownItem[]
  color: string
}) {
  const max = items[0]?.count || 1
  const total = items.reduce((sum, i) => sum + i.count, 0)

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      {items.length === 0 ? (
        <p className="text-gray-500">No data</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.name} className="flex items-center">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-900">{item.name}</span>
                  <span className="text-gray-500">
                    {Math.round((item.count / total) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${(item.count / max) * 100}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
              <div className="ml-3 text-sm font-semibold text-gray-600 w-10 text-right">
                {item.count}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
