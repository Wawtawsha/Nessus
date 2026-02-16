'use client'

import { useMemo } from 'react'
import { Visit } from '../shared/types'
import { StatCard } from '../shared/StatCard'
import { BreakdownCard, BreakdownItem } from '../shared/BreakdownCard'

// US State abbreviation map
const US_STATE_ABBREV: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'District of Columbia': 'DC', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI',
  'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME',
  'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
  'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE',
  'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM',
  'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX',
  'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA',
  'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
}

function formatCityRegion(city: string, region: string | null): string {
  if (!region) return city

  // Check if region is a US state name (case-sensitive match)
  const abbrev = US_STATE_ABBREV[region]
  if (abbrev) {
    return `${city}, ${abbrev}`
  }

  // Non-US or non-matching region
  return `${city}, ${region}`
}

export function GeoDistribution({ visits }: { visits: Visit[] }) {
  const stats = useMemo(() => {
    // Filter visits with geo data
    const visitsWithGeo = visits.filter((v) => v.city !== null)

    if (visitsWithGeo.length === 0) {
      return {
        uniqueCities: 0,
        uniqueCountries: 0,
        geoCoverage: 0,
        cityBreakdown: [],
        countryBreakdown: [],
      }
    }

    // Count visits per city
    const cityMap = new Map<string, { city: string; region: string | null; count: number }>()
    visitsWithGeo.forEach((visit) => {
      if (!visit.city) return

      const key = `${visit.city}|${visit.region || ''}`
      if (!cityMap.has(key)) {
        cityMap.set(key, {
          city: visit.city,
          region: visit.region,
          count: 0,
        })
      }
      cityMap.get(key)!.count++
    })

    // Convert to array and sort by count
    const cityBreakdown = Array.from(cityMap.values())
      .map((item) => ({
        name: formatCityRegion(item.city, item.region),
        count: item.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15) // Top 15 cities

    // Count visits per country
    const countryMap = new Map<string, number>()
    visitsWithGeo.forEach((visit) => {
      if (!visit.country) return
      countryMap.set(visit.country, (countryMap.get(visit.country) || 0) + 1)
    })

    const countryBreakdown: BreakdownItem[] = Array.from(countryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    const uniqueCities = cityMap.size
    const uniqueCountries = countryMap.size
    const geoCoverage = Math.round((visitsWithGeo.length / visits.length) * 100)

    return {
      uniqueCities,
      uniqueCountries,
      geoCoverage,
      cityBreakdown,
      countryBreakdown,
    }
  }, [visits])

  if (visits.length === 0 || stats.geoCoverage === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Geographic Distribution</h2>
        <p className="text-gray-600">No geographic data available</p>
      </div>
    )
  }

  const maxCityCount = stats.cityBreakdown[0]?.count || 1

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Geographic Distribution</h2>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Unique Cities" value={stats.uniqueCities} color="blue" />
        <StatCard label="Unique Countries" value={stats.uniqueCountries} color="indigo" />
        <StatCard label="Geo Coverage" value={`${stats.geoCoverage}%`} color="purple" />
      </div>

      {/* Country breakdown (if more than 1 country) */}
      {stats.uniqueCountries > 1 && (
        <div className="mb-6">
          <BreakdownCard
            title="Visitors by Country"
            items={stats.countryBreakdown}
            color="#3b82f6"
          />
        </div>
      )}

      {/* Top cities table */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Cities</h3>
        <div className="space-y-3">
          {stats.cityBreakdown.map((city) => {
            const percentage = Math.round((city.count / maxCityCount) * 100)
            return (
              <div key={city.name} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-900">{city.name}</span>
                    <span className="text-gray-500">
                      {Math.round((city.count / visits.length) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: '#3b82f6',
                      }}
                    />
                  </div>
                </div>
                <div className="text-sm font-semibold text-gray-600 w-12 text-right">
                  {city.count}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
