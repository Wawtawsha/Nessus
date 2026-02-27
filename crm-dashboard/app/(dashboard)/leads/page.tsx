'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Lead } from '@/types/lead'
import type { Niche } from '@/types/niche'
import { useUser } from '@/contexts/UserContext'
import { NicheComboBox } from '@/components/NicheComboBox'
import { ScriptManager } from '@/components/ScriptManager'
import { ScriptAnalytics } from '@/components/ScriptAnalytics'

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  contacted_denied: 'bg-orange-100 text-orange-800',
  qualified: 'bg-green-100 text-green-800',
  converted: 'bg-purple-100 text-purple-800',
  unqualified: 'bg-gray-100 text-gray-800',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  contacted_denied: 'Contacted - Denied',
  qualified: 'Qualified',
  converted: 'Converted',
  unqualified: 'Unqualified',
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [campaignFilter, setCampaignFilter] = useState<string>('')
  const [nicheFilter, setNicheFilter] = useState<string>('')
  const [campaigns, setCampaigns] = useState<string[]>([])
  const [niches, setNiches] = useState<Niche[]>([])
  const supabase = createClient()
  const { isAdmin, currentClientId } = useUser()

  const dialogRef = useRef<HTMLDialogElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [preferredContact, setPreferredContact] = useState('email')
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null)
  const [scriptsExpanded, setScriptsExpanded] = useState(true)
  const [analyticsExpanded, setAnalyticsExpanded] = useState(false)

  const fetchLeads = useCallback(async () => {
    let query = supabase
      .from('leads')
      .select('*, niche:niches(name)')
      .order('created_at', { ascending: false })

    // Admin filtering by selected client (client users filtered by RLS automatically)
    if (isAdmin && currentClientId) {
      query = query.eq('client_id', currentClientId)
    }

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    if (campaignFilter) {
      query = query.eq('utm_campaign', campaignFilter)
    }

    if (nicheFilter) {
      query = query.eq('niche_id', nicheFilter)
    }

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching leads:', error)
    } else {
      setLeads(data || [])
    }
    setLoading(false)
  }, [supabase, statusFilter, campaignFilter, nicheFilter, search, isAdmin, currentClientId])

  // Fetch unique campaigns for filter
  const fetchCampaigns = useCallback(async () => {
    let query = supabase
      .from('leads')
      .select('utm_campaign')
      .not('utm_campaign', 'is', null)

    // Filter by client if admin has one selected
    if (isAdmin && currentClientId) {
      query = query.eq('client_id', currentClientId)
    }

    const { data } = await query

    if (data) {
      const uniqueCampaigns = [...new Set(data.map((d) => d.utm_campaign).filter(Boolean))]
      setCampaigns(uniqueCampaigns as string[])
    }
  }, [supabase, isAdmin, currentClientId])

  // Fetch all niches for filter dropdown
  const fetchNiches = useCallback(async () => {
    const { data, error } = await supabase
      .from('niches')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching niches:', error)
    } else {
      setNiches(data || [])
    }
  }, [supabase])

  useEffect(() => {
    fetchLeads()
    fetchCampaigns()
    fetchNiches()
  }, [fetchLeads, fetchCampaigns, fetchNiches])

  // Poll for updates every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLeads()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchLeads])

  const exportCSV = () => {
    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Status', 'Source', 'Campaign', 'Notify', 'Created']
    const rows = leads.map((lead) => [
      lead.first_name || '',
      lead.last_name || '',
      lead.email,
      lead.phone || '',
      lead.status,
      lead.utm_source || '',
      lead.utm_campaign || '',
      lead.notify_events ? 'Yes' : 'No',
      new Date(lead.created_at).toLocaleDateString(),
    ])

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const handleAddLead = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)

    const form = e.currentTarget
    const formData = new FormData(form)

    const preferredContact = formData.get('preferred_contact') as string || 'email'
    const smsConsent = formData.get('sms_consent') === 'on'
    const hasWebsite = formData.get('has_website') === 'on'
    const socialMedia = formData.get('social_media_presence') as string

    const { error } = await supabase.from('leads').insert({
      client_id: currentClientId,
      first_name: formData.get('first_name') as string || '',
      last_name: formData.get('last_name') as string || '',
      email: formData.get('email') as string || '',
      phone: (formData.get('phone') as string) || null,
      preferred_contact: preferredContact,
      sms_consent: smsConsent,
      sms_consent_at: smsConsent ? new Date().toISOString() : null,
      has_website: hasWebsite || null,
      social_media_presence: socialMedia ? parseInt(socialMedia, 10) : null,
      niche_id: selectedNiche,
      status: 'new',
      utm_source: 'manual-entry',
    })

    setSubmitting(false)

    if (error) {
      console.error('Error adding lead:', error)
      alert('Failed to add lead: ' + error.message)
      return
    }

    form.reset()
    setPreferredContact('email')
    setSelectedNiche(null)
    dialogRef.current?.close()
    fetchLeads()
    fetchNiches()
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <div className="flex gap-2">
          {currentClientId && (
            <button
              onClick={() => dialogRef.current?.showModal()}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
            >
              Add Lead
            </button>
          )}
          <button
            onClick={exportCSV}
            className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Campaigns</option>
            {campaigns.map((campaign) => (
              <option key={campaign} value={campaign}>
                {campaign}
              </option>
            ))}
          </select>
          <select
            value={nicheFilter}
            onChange={(e) => setNicheFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Niches</option>
            {niches.map((niche) => (
              <option key={niche.id} value={niche.id}>
                {niche.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setSearch('')
              setStatusFilter('')
              setCampaignFilter('')
              setNicheFilter('')
            }}
            className="px-3 py-2 text-gray-600 hover:text-gray-900"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Call Scripts Section */}
      {currentClientId && (
        <div className="bg-white rounded-lg shadow mb-6">
          <button
            onClick={() => setScriptsExpanded(!scriptsExpanded)}
            className="w-full flex items-center justify-between px-6 py-4 text-left"
          >
            <h2 className="text-lg font-semibold text-gray-900">Call Scripts</h2>
            <span className="text-gray-400 text-sm">
              {scriptsExpanded ? 'Hide' : 'Show'}
            </span>
          </button>
          {scriptsExpanded && (
            <div className="px-6 pb-6">
              <ScriptManager clientId={currentClientId} />
            </div>
          )}
        </div>
      )}

      {/* Script Analytics Section */}
      {currentClientId && (
        <div className="bg-white rounded-lg shadow mb-6">
          <button
            onClick={() => setAnalyticsExpanded(!analyticsExpanded)}
            className="w-full flex items-center justify-between px-6 py-4 text-left"
          >
            <h2 className="text-lg font-semibold text-gray-900">Script Analytics</h2>
            <span className="text-gray-400 text-sm">
              {analyticsExpanded ? 'Hide' : 'Show'}
            </span>
          </button>
          {analyticsExpanded && (
            <div className="px-6 pb-6">
              <ScriptAnalytics clientId={currentClientId} />
            </div>
          )}
        </div>
      )}

      {/* Leads Table */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No leads found</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Niche
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notify
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={`/leads/${lead.id}`} className="text-blue-600 hover:underline font-medium">
                      {lead.first_name || lead.last_name
                        ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                        : lead.email}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{lead.email}</div>
                    {lead.phone && (
                      <div className="text-sm text-gray-500">{lead.phone}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {lead.utm_source || '-'}
                    {lead.utm_campaign && (
                      <div className="text-xs text-gray-400">{lead.utm_campaign}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(lead as any).niche?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${STATUS_COLORS[lead.status]}`}>
                      {STATUS_LABELS[lead.status] || lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={async () => {
                        const { error } = await supabase
                          .from('leads')
                          .update({ notify_events: !lead.notify_events })
                          .eq('id', lead.id)
                        if (!error) {
                          setLeads((prev) =>
                            prev.map((l) =>
                              l.id === lead.id ? { ...l, notify_events: !l.notify_events } : l
                            )
                          )
                        }
                      }}
                      className={`px-2 py-1 text-xs rounded-full ${
                        lead.notify_events
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {lead.notify_events ? 'On' : 'Off'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-500">
        Showing {leads.length} lead{leads.length !== 1 ? 's' : ''}
      </div>

      {/* Add Lead Dialog */}
      <dialog
        ref={dialogRef}
        className="rounded-lg shadow-xl p-0 w-full max-w-md backdrop:bg-black/50"
        onClick={(e) => { if (e.target === e.currentTarget) dialogRef.current?.close() }}
      >
        <form onSubmit={handleAddLead} className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Lead</h2>

          <div className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  name="first_name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  name="last_name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                name="phone"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Preferred Contact (controlled — drives SMS consent visibility) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Contact</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1 text-sm">
                  <input type="radio" name="preferred_contact" value="email" checked={preferredContact === 'email'} onChange={(e) => setPreferredContact(e.target.value)} />
                  Email
                </label>
                <label className="flex items-center gap-1 text-sm">
                  <input type="radio" name="preferred_contact" value="phone" checked={preferredContact === 'phone'} onChange={(e) => setPreferredContact(e.target.value)} />
                  Phone
                </label>
                <label className="flex items-center gap-1 text-sm">
                  <input type="radio" name="preferred_contact" value="sms" checked={preferredContact === 'sms'} onChange={(e) => setPreferredContact(e.target.value)} />
                  SMS
                </label>
              </div>
            </div>

            {/* SMS Consent -- only shown when preferred_contact is sms */}
            {preferredContact === 'sms' && (
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="sms_consent" className="rounded" />
                  <span className="text-gray-700">SMS Consent</span>
                </label>
              </div>
            )}

            {/* Has Website */}
            <div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="has_website" className="rounded" />
                <span className="text-gray-700">Has a website</span>
              </label>
            </div>

            {/* Social Media Presence */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Social Media Presence</label>
              <div className="flex gap-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="flex items-center gap-1 text-sm">
                    <input type="radio" name="social_media_presence" value={n} />
                    {n}
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">1 = minimal, 5 = strong presence</p>
            </div>

            {/* Business Niche */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Niche</label>
              <NicheComboBox value={selectedNiche} onChange={setSelectedNiche} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={() => { dialogRef.current?.close(); setPreferredContact('email') }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add Lead'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
