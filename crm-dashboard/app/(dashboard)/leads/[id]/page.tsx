'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Lead, LeadEvent } from '@/types/lead'

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'converted', 'unqualified'] as const

export default function LeadDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [lead, setLead] = useState<Lead | null>(null)
  const [events, setEvents] = useState<LeadEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('')

  const fetchLead = useCallback(async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching lead:', error)
    } else {
      setLead(data)
      setNotes(data.notes || '')
    }
    setLoading(false)
  }, [supabase, id])

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from('lead_events')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })

    if (data) setEvents(data)
  }, [supabase, id])

  useEffect(() => {
    fetchLead()
    fetchEvents()
  }, [fetchLead, fetchEvents])

  const updateStatus = async (newStatus: string) => {
    if (!lead) return
    setSaving(true)

    const { error } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', id)

    if (!error) {
      // Log event
      await supabase.from('lead_events').insert({
        lead_id: id,
        event_type: 'status_changed',
        event_data: { from: lead.status, to: newStatus },
      })
      fetchLead()
      fetchEvents()
    }
    setSaving(false)
  }

  const saveNotes = async () => {
    if (!lead) return
    setSaving(true)

    const { error } = await supabase
      .from('leads')
      .update({ notes })
      .eq('id', id)

    if (!error) {
      await supabase.from('lead_events').insert({
        lead_id: id,
        event_type: 'note_added',
        event_data: { note: notes.substring(0, 100) },
      })
      fetchLead()
      fetchEvents()
    }
    setSaving(false)
  }

  const deleteLead = async () => {
    if (!confirm('Are you sure you want to delete this lead?')) return

    const { error } = await supabase.from('leads').delete().eq('id', id)

    if (!error) {
      router.push('/leads')
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!lead) {
    return <div className="text-center py-8">Lead not found</div>
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/leads" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Leads
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <h1 className="text-2xl font-bold text-gray-900">
                {lead.first_name} {lead.last_name}
              </h1>
              <button
                onClick={deleteLead}
                className="text-red-600 hover:text-red-700 text-sm"
              >
                Delete
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Email</label>
                <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">
                  {lead.email}
                </a>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Phone</label>
                {lead.phone ? (
                  <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">
                    {lead.phone}
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">SMS Consent</label>
                <span className={lead.sms_consent ? 'text-green-600' : 'text-gray-400'}>
                  {lead.sms_consent ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Preferred Contact</label>
                <span className="capitalize">{lead.preferred_contact || 'Email'}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Created</label>
                <span>{new Date(lead.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Status</h2>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  onClick={() => updateStatus(status)}
                  disabled={saving}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    lead.status === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add notes about this lead..."
            />
            <button
              onClick={saveNotes}
              disabled={saving || notes === (lead.notes || '')}
              className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Notes'}
            </button>
          </div>

          {/* UTM Data */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Attribution</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block font-medium text-gray-500">Source</label>
                <span>{lead.utm_source || '-'}</span>
              </div>
              <div>
                <label className="block font-medium text-gray-500">Medium</label>
                <span>{lead.utm_medium || '-'}</span>
              </div>
              <div>
                <label className="block font-medium text-gray-500">Campaign</label>
                <span>{lead.utm_campaign || '-'}</span>
              </div>
              <div>
                <label className="block font-medium text-gray-500">Content</label>
                <span>{lead.utm_content || '-'}</span>
              </div>
              <div>
                <label className="block font-medium text-gray-500">Term</label>
                <span>{lead.utm_term || '-'}</span>
              </div>
              <div>
                <label className="block font-medium text-gray-500">IP Address</label>
                <span>{lead.ip_address || '-'}</span>
              </div>
            </div>
            {lead.landing_page_url && (
              <div className="mt-4">
                <label className="block font-medium text-gray-500 text-sm">Landing Page</label>
                <span className="text-sm text-gray-600 break-all">{lead.landing_page_url}</span>
              </div>
            )}
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity</h2>
          {events.length === 0 ? (
            <p className="text-gray-500 text-sm">No activity yet</p>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="border-l-2 border-gray-200 pl-4">
                  <div className="text-sm font-medium text-gray-900">
                    {event.event_type.replace('_', ' ')}
                  </div>
                  {event.event_data && (
                    <div className="text-xs text-gray-500">
                      {JSON.stringify(event.event_data)}
                    </div>
                  )}
                  <div className="text-xs text-gray-400">
                    {new Date(event.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
