export function StatCard({
  label,
  value,
  color = 'gray',
}: {
  label: string
  value: number | string
  color?: string
}) {
  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-900',
    blue: 'bg-blue-100 text-blue-900',
    yellow: 'bg-yellow-100 text-yellow-900',
    orange: 'bg-orange-100 text-orange-900',
    green: 'bg-green-100 text-green-900',
    purple: 'bg-purple-100 text-purple-900',
    indigo: 'bg-indigo-100 text-indigo-900',
    teal: 'bg-teal-100 text-teal-900',
  }

  return (
    <div className={`rounded-lg p-4 ${colorClasses[color] || colorClasses.gray}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm opacity-75">{label}</div>
    </div>
  )
}
