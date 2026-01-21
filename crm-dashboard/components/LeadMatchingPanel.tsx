'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Lead {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
}

interface LeadMatchingPanelProps {
  orderId: string
  clientId: string
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  onMatch: (leadId: string) => void
  onCancel: () => void
}

interface ScoredLead extends Lead {
  score: number
  matchLevel: 'High' | 'Medium' | 'Low'
}

function computeScore(
  lead: Lead,
  customerName: string | null,
  customerEmail: string | null,
  customerPhone: string | null
): number {
  let score = 0

  // Email match (highest weight) - exact match, case insensitive
  if (customerEmail && lead.email) {
    if (lead.email.toLowerCase() === customerEmail.toLowerCase()) {
      score += 100
    }
  }

  // Phone match (high weight) - normalize to digits only
  if (customerPhone && lead.phone) {
    const orderPhone = customerPhone.replace(/\D/g, '')
    const leadPhone = lead.phone.replace(/\D/g, '')
    if (orderPhone && leadPhone && orderPhone === leadPhone) {
      score += 80
    } else if (orderPhone && leadPhone && (orderPhone.includes(leadPhone) || leadPhone.includes(orderPhone))) {
      score += 40 // Partial phone match
    }
  }

  // Name match (medium weight) - case insensitive contains
  if (customerName) {
    const orderNameLower = customerName.toLowerCase()
    const leadFullName = `${lead.first_name || ''} ${lead.last_name || ''}`.toLowerCase().trim()

    if (leadFullName && leadFullName === orderNameLower) {
      score += 60
    } else if (lead.first_name && orderNameLower.includes(lead.first_name.toLowerCase())) {
      score += 30
    } else if (lead.last_name && orderNameLower.includes(lead.last_name.toLowerCase())) {
      score += 30
    }
  }

  return score
}

function getMatchLevel(score: number): 'High' | 'Medium' | 'Low' {
  if (score > 80) return 'High'
  if (score > 40) return 'Medium'
  return 'Low'
}

export function LeadMatchingPanel({
  orderId,
  clientId,
  customerName,
  customerEmail,
  customerPhone,
  onMatch,
  onCancel,
}: LeadMatchingPanelProps) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAllLeads, setShowAllLeads] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const fetchLeads = async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, first_name, last_name, email, phone')
        .eq('client_id', clientId)
        .limit(100)

      if (error) {
        console.error('Error fetching leads:', error)
      } else {
        setLeads(data || [])
      }
      setLoading(false)
    }

    fetchLeads()
  }, [clientId, supabase])

  // Score and sort leads
  const scoredLeads: ScoredLead[] = leads
    .map(lead => ({
      ...lead,
      score: computeScore(lead, customerName, customerEmail, customerPhone),
      matchLevel: getMatchLevel(computeScore(lead, customerName, customerEmail, customerPhone)),
    }))
    .sort((a, b) => b.score - a.score)

  // Top suggestions (score > 0)
  const suggestions = scoredLeads.filter(l => l.score > 0).slice(0, 5)

  // Search filtered leads
  const searchFilteredLeads = searchTerm
    ? scoredLeads.filter(lead => {
        const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.toLowerCase()
        const email = (lead.email || '').toLowerCase()
        const term = searchTerm.toLowerCase()
        return fullName.includes(term) || email.includes(term)
      })
    : scoredLeads

  const handleSelect = async (leadId: string) => {
    setSelecting(leadId)
    onMatch(leadId)
  }

  const matchBadgeClass = (level: 'High' | 'Medium' | 'Low') => {
    switch (level) {
      case 'High':
        return 'bg-green-100 text-green-800'
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'Low':
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Match to Lead</h3>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Order Customer Info Summary */}
      <div className="bg-gray-50 rounded-md p-3 mb-4">
        <p className="text-sm font-semibold text-gray-900 mb-1">Order Customer Info</p>
        <div className="text-sm text-gray-600">
          {customerName && <div>{customerName}</div>}
          {customerEmail && <div>{customerEmail}</div>}
          {customerPhone && <div>{customerPhone}</div>}
          {!customerName && !customerEmail && !customerPhone && (
            <div className="text-gray-400 italic">No customer info available</div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading leads...</div>
      ) : (
        <>
          {/* Suggestions */}
          {!showAllLeads && (
            <>
              <p className="text-sm font-semibold text-gray-900 mb-2">Suggested Matches</p>
              {suggestions.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {suggestions.map(lead => (
                    <div
                      key={lead.id}
                      className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 flex justify-between items-center"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {lead.first_name} {lead.last_name}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${matchBadgeClass(lead.matchLevel)}`}>
                            {lead.matchLevel}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          {lead.email && <span>{lead.email}</span>}
                          {lead.email && lead.phone && <span> · </span>}
                          {lead.phone && <span>{lead.phone}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleSelect(lead.id)}
                        disabled={selecting === lead.id}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {selecting === lead.id ? 'Selecting...' : 'Select'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 mb-4">
                  <p>No similar leads found</p>
                  <button
                    onClick={() => setShowAllLeads(true)}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    Search all leads
                  </button>
                </div>
              )}

              {suggestions.length > 0 && (
                <div className="text-center">
                  <button
                    onClick={() => setShowAllLeads(true)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Search all leads instead
                  </button>
                </div>
              )}
            </>
          )}

          {/* Search All Leads */}
          {showAllLeads && (
            <>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setShowAllLeads(false)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    ← Back to suggestions
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchFilteredLeads.slice(0, 20).map(lead => (
                  <div
                    key={lead.id}
                    className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 flex justify-between items-center"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {lead.first_name} {lead.last_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {lead.email && <span>{lead.email}</span>}
                        {lead.email && lead.phone && <span> · </span>}
                        {lead.phone && <span>{lead.phone}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSelect(lead.id)}
                      disabled={selecting === lead.id}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {selecting === lead.id ? 'Selecting...' : 'Select'}
                    </button>
                  </div>
                ))}
                {searchFilteredLeads.length === 0 && (
                  <div className="text-center py-4 text-gray-500">No leads found</div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
