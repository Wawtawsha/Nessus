'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Lead } from '@/types/lead'
import { useUser } from '@/contexts/UserContext'

const PIPELINE_STAGES = [
  { id: 'new', label: 'New', color: 'bg-blue-500' },
  { id: 'contacted', label: 'Contacted', color: 'bg-yellow-500' },
  { id: 'qualified', label: 'Qualified', color: 'bg-green-500' },
  { id: 'converted', label: 'Converted', color: 'bg-purple-500' },
  { id: 'unqualified', label: 'Lost', color: 'bg-gray-500' },
] as const

export default function PipelineBoard() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)
  const supabase = createClient()
  const { isAdmin, currentClientId } = useUser()

  const fetchLeads = useCallback(async () => {
    let query = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })

    // Admin filtering by selected client (client users filtered by RLS automatically)
    if (isAdmin && currentClientId) {
      query = query.eq('client_id', currentClientId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching leads:', error)
    } else {
      setLeads(data || [])
    }
    setLoading(false)
  }, [supabase, isAdmin, currentClientId])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('pipeline-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => fetchLeads()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchLeads])

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()

    if (!draggedLead || draggedLead.status === newStatus) {
      setDraggedLead(null)
      return
    }

    const oldStatus = draggedLead.status

    // Optimistic update
    setLeads(prev =>
      prev.map(lead =>
        lead.id === draggedLead.id
          ? { ...lead, status: newStatus as Lead['status'] }
          : lead
      )
    )

    // Update in database
    const { error } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', draggedLead.id)

    if (error) {
      console.error('Error updating lead status:', error)
      // Revert on error
      setLeads(prev =>
        prev.map(lead =>
          lead.id === draggedLead.id
            ? { ...lead, status: oldStatus }
            : lead
        )
      )
    } else {
      // Log the status change event
      await supabase.from('lead_events').insert({
        lead_id: draggedLead.id,
        event_type: 'status_changed',
        event_data: { from: oldStatus, to: newStatus, via: 'pipeline' },
      })
    }

    setDraggedLead(null)
  }

  const getLeadsByStatus = (status: string) => {
    return leads.filter(lead => lead.status === status)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading pipeline...</div>
      </div>
    )
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {PIPELINE_STAGES.map(stage => {
        const stageLeads = getLeadsByStatus(stage.id)
        return (
          <div
            key={stage.id}
            className="flex-shrink-0 w-72 bg-gray-100 rounded-lg"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            {/* Column Header */}
            <div className={`${stage.color} text-white px-4 py-3 rounded-t-lg flex justify-between items-center`}>
              <h3 className="font-semibold">{stage.label}</h3>
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">
                {stageLeads.length}
              </span>
            </div>

            {/* Cards Container */}
            <div className="p-2 space-y-2 min-h-[400px]">
              {stageLeads.map(lead => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead)}
                  className={`bg-white rounded-lg shadow p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                    draggedLead?.id === lead.id ? 'opacity-50' : ''
                  }`}
                >
                  <Link
                    href={`/leads/${lead.id}`}
                    className="block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="font-medium text-gray-900 hover:text-blue-600">
                      {lead.first_name} {lead.last_name}
                    </div>
                  </Link>
                  <div className="text-sm text-gray-500 truncate">
                    {lead.email}
                  </div>
                  {lead.phone && (
                    <div className="text-sm text-gray-400">
                      {lead.phone}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    {lead.utm_source && (
                      <span className="bg-gray-100 px-2 py-0.5 rounded">
                        {lead.utm_source}
                      </span>
                    )}
                    {lead.preferred_contact && (
                      <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded capitalize">
                        {lead.preferred_contact}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}

              {stageLeads.length === 0 && (
                <div className="text-center text-gray-400 text-sm py-8">
                  No leads
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
