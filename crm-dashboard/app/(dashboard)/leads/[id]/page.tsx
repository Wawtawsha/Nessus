'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Lead, LeadEvent } from '@/types/lead'
import { NicheComboBox } from '@/components/NicheComboBox'

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'converted', 'unqualified'] as const

interface LeadOrder {
  id: string
  display_number: string | null
  business_date: number
  total_amount: number
  tip_amount: number
  source: string | null
}

function formatBusinessDate(dateInt: number): string {
  const str = String(dateInt)
  if (str.length !== 8) return str
  return `${str.slice(4, 6)}/${str.slice(6, 8)}/${str.slice(0, 4)}`
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function LeadDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [lead, setLead] = useState<Lead | null>(null)
  const [events, setEvents] = useState<LeadEvent[]>([])
  const [orders, setOrders] = useState<LeadOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    preferred_contact: 'email' as 'email' | 'phone' | 'sms',
    sms_consent: false,
    has_website: null as boolean | null,
    social_media_presence: null as number | null,
    niche_id: null as string | null,
  })

  const fetchLead = useCallback(async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*, niche:niches(name)')
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

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('toast_orders')
      .select('id, display_number, business_date, total_amount, tip_amount, source')
      .eq('lead_id', id)
      .order('business_date', { ascending: false })

    if (data) setOrders(data)
  }, [supabase, id])

  useEffect(() => {
    fetchLead()
    fetchEvents()
    fetchOrders()
  }, [fetchLead, fetchEvents, fetchOrders])

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

  const startEdit = () => {
    if (!lead) return
    setEditForm({
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      phone: lead.phone || '',
      preferred_contact: lead.preferred_contact,
      sms_consent: lead.sms_consent,
      has_website: lead.has_website,
      social_media_presence: lead.social_media_presence,
      niche_id: lead.niche_id,
    })
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setIsEditing(false)
  }

  const saveEdit = async () => {
    if (!lead) return
    setSaving(true)

    // Calculate changed fields
    const changedFields: Record<string, any> = {}
    if (editForm.first_name !== lead.first_name) changedFields.first_name = editForm.first_name
    if (editForm.last_name !== lead.last_name) changedFields.last_name = editForm.last_name
    if (editForm.email !== lead.email) changedFields.email = editForm.email
    if ((editForm.phone || null) !== lead.phone) changedFields.phone = editForm.phone || null
    if (editForm.preferred_contact !== lead.preferred_contact) changedFields.preferred_contact = editForm.preferred_contact
    if (editForm.sms_consent !== lead.sms_consent) changedFields.sms_consent = editForm.sms_consent
    if (editForm.has_website !== lead.has_website) changedFields.has_website = editForm.has_website
    if (editForm.social_media_presence !== lead.social_media_presence) changedFields.social_media_presence = editForm.social_media_presence
    if (editForm.niche_id !== lead.niche_id) changedFields.niche_id = editForm.niche_id

    const { error } = await supabase
      .from('leads')
      .update({
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email,
        phone: editForm.phone || null,
        preferred_contact: editForm.preferred_contact,
        sms_consent: editForm.sms_consent,
        has_website: editForm.has_website,
        social_media_presence: editForm.social_media_presence,
        niche_id: editForm.niche_id,
      })
      .eq('id', id)

    if (!error) {
      // Log event with only changed fields
      await supabase.from('lead_events').insert({
        lead_id: id,
        event_type: 'lead_edited',
        event_data: changedFields,
      })
      fetchLead()
      fetchEvents()
      setIsEditing(false)
    }
    setSaving(false)
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
              {!isEditing ? (
                <h1 className="text-2xl font-bold text-gray-900">
                  {lead.first_name} {lead.last_name}
                </h1>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="First name"
                  />
                  <input
                    type="text"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Last name"
                  />
                </div>
              )}
              <div className="flex gap-2">
                {!isEditing ? (
                  <>
                    <button
                      onClick={startEdit}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={deleteLead}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            {!isEditing ? (
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
                  <label className="block text-sm font-medium text-gray-500">Has Website</label>
                  <span>{lead.has_website === null ? '-' : lead.has_website ? 'Yes' : 'No'}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Social Media Presence</label>
                  <span>{lead.social_media_presence !== null ? lead.social_media_presence : '-'}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Business Niche</label>
                  <span>{(lead as any).niche?.name || '-'}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Created</label>
                  <span>{new Date(lead.created_at).toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                  <input
                    type="text"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Phone</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Preferred Contact</label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="email"
                        checked={editForm.preferred_contact === 'email'}
                        onChange={(e) => setEditForm({ ...editForm, preferred_contact: e.target.value as 'email' | 'phone' | 'sms' })}
                        className="mr-2"
                      />
                      Email
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="phone"
                        checked={editForm.preferred_contact === 'phone'}
                        onChange={(e) => setEditForm({ ...editForm, preferred_contact: e.target.value as 'email' | 'phone' | 'sms' })}
                        className="mr-2"
                      />
                      Phone
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="sms"
                        checked={editForm.preferred_contact === 'sms'}
                        onChange={(e) => setEditForm({ ...editForm, preferred_contact: e.target.value as 'email' | 'phone' | 'sms' })}
                        className="mr-2"
                      />
                      SMS
                    </label>
                  </div>
                </div>
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editForm.sms_consent}
                      onChange={(e) => setEditForm({ ...editForm, sms_consent: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-500">SMS Consent</span>
                  </label>
                </div>
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editForm.has_website === true}
                      onChange={(e) => setEditForm({ ...editForm, has_website: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-500">Has Website</span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Social Media Presence (1-5)</label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="1"
                        checked={editForm.social_media_presence === 1}
                        onChange={() => setEditForm({ ...editForm, social_media_presence: 1 })}
                        className="mr-2"
                      />
                      1
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="2"
                        checked={editForm.social_media_presence === 2}
                        onChange={() => setEditForm({ ...editForm, social_media_presence: 2 })}
                        className="mr-2"
                      />
                      2
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="3"
                        checked={editForm.social_media_presence === 3}
                        onChange={() => setEditForm({ ...editForm, social_media_presence: 3 })}
                        className="mr-2"
                      />
                      3
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="4"
                        checked={editForm.social_media_presence === 4}
                        onChange={() => setEditForm({ ...editForm, social_media_presence: 4 })}
                        className="mr-2"
                      />
                      4
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="5"
                        checked={editForm.social_media_presence === 5}
                        onChange={() => setEditForm({ ...editForm, social_media_presence: 5 })}
                        className="mr-2"
                      />
                      5
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={editForm.social_media_presence === null}
                        onChange={() => setEditForm({ ...editForm, social_media_presence: null })}
                        className="mr-2"
                      />
                      None
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Business Niche</label>
                  <NicheComboBox
                    value={editForm.niche_id}
                    onChange={(nicheId) => setEditForm({ ...editForm, niche_id: nicheId })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Created</label>
                  <span>{new Date(lead.created_at).toLocaleString()}</span>
                </div>
              </div>
            )}
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

          {/* Orders */}
          {orders.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Orders</h2>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(orders.reduce((sum, o) => sum + (o.total_amount || 0), 0))}
                  </div>
                  <div className="text-xs text-gray-500">
                    {orders.length} order{orders.length !== 1 ? 's' : ''} •
                    {formatCurrency(orders.reduce((sum, o) => sum + (o.tip_amount || 0), 0))} tips
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {orders.slice(0, 5).map((order) => (
                  <div key={order.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <span className="font-medium">#{order.display_number || order.id.slice(0, 8)}</span>
                      <span className="text-gray-500 text-sm ml-2">{formatBusinessDate(order.business_date)}</span>
                      {order.source && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded ml-2">
                          {order.source}
                        </span>
                      )}
                    </div>
                    <div className="font-medium">{formatCurrency(order.total_amount)}</div>
                  </div>
                ))}
                {orders.length > 5 && (
                  <Link href="/orders" className="text-blue-600 hover:underline text-sm block text-center pt-2">
                    View all {orders.length} orders →
                  </Link>
                )}
              </div>
            </div>
          )}

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
