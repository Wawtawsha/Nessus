'use client'

import { useState, useEffect, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { Check as CheckIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Script } from '@/types/script'
import type { Lead } from '@/types/lead'
import { outcomeSchema, type OutcomeFormValues } from '@/lib/schemas/outcomeSchema'
import type { ScriptOutcome } from '@/types/script'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface RecordOutcomeDialogProps {
  script: Script
  clientId: string
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function RecordOutcomeDialog({
  script,
  clientId,
  open,
  onClose,
  onSaved,
}: RecordOutcomeDialogProps) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [existingOutcome, setExistingOutcome] = useState<ScriptOutcome | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const form = useForm<OutcomeFormValues>({
    resolver: zodResolver(outcomeSchema),
    mode: 'onSubmit',
    defaultValues: {
      lead_id: '',
      notes: '',
    },
  })

  const selectedLeadId = form.watch('lead_id')

  // Fetch leads on mount
  useEffect(() => {
    const fetchLeads = async () => {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('client_id', clientId)
        .order('first_name', { ascending: true, nullsFirst: false })
        .order('last_name', { ascending: true, nullsFirst: false })

      setLeads(data || [])
    }
    fetchLeads()
  }, [clientId, supabase])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Load existing outcome when lead is selected
  useEffect(() => {
    const loadExistingOutcome = async () => {
      if (!selectedLeadId) {
        setExistingOutcome(null)
        return
      }

      const { data } = await supabase
        .from('script_lead_outcomes')
        .select('*')
        .eq('script_id', script.id)
        .eq('lead_id', selectedLeadId)
        .maybeSingle()

      if (data) {
        setExistingOutcome(data)
        form.setValue('notes', data.notes || '')
      } else {
        setExistingOutcome(null)
        form.setValue('notes', '')
      }
    }

    loadExistingOutcome()
  }, [selectedLeadId, script.id, supabase, form])

  const selectedLead = leads.find((l) => l.id === selectedLeadId)

  const filteredLeads = searchValue
    ? leads.filter((lead) => {
        const search = searchValue.toLowerCase()
        const firstName = lead.first_name?.toLowerCase() || ''
        const lastName = lead.last_name?.toLowerCase() || ''
        const email = lead.email.toLowerCase()
        return firstName.includes(search) || lastName.includes(search) || email.includes(search)
      })
    : leads

  const getLeadDisplayName = (lead: Lead) => {
    if (lead.first_name || lead.last_name) {
      return `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
    }
    return lead.email
  }

  const handleOutcome = async (outcome: 'success' | 'fail') => {
    // Validate lead selection
    const isValid = await form.trigger('lead_id')
    if (!isValid) {
      return
    }

    const { lead_id, notes } = form.getValues()
    setIsSubmitting(true)

    try {
      const { error } = await supabase.from('script_lead_outcomes').upsert(
        {
          script_id: script.id,
          lead_id,
          outcome,
          notes: notes || null,
        },
        {
          onConflict: 'script_id,lead_id',
        }
      )

      if (error) throw error

      onSaved()
      onClose()
    } catch (error: any) {
      console.error('Error saving outcome:', error)
      alert('Failed to save outcome: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    form.reset()
    setExistingOutcome(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Call Outcome</DialogTitle>
          <p className="text-sm text-gray-500 mt-1">Script: {script.title}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Lead selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lead <span className="text-red-500">*</span>
            </label>
            <Controller
              name="lead_id"
              control={form.control}
              render={({ field, fieldState }) => (
                <>
                  <div ref={containerRef} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(!dropdownOpen)
                        if (!dropdownOpen) setTimeout(() => inputRef.current?.focus(), 0)
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <span className={selectedLead ? 'text-gray-900' : 'text-gray-500'}>
                        {selectedLead ? getLeadDisplayName(selectedLead) : 'Select lead...'}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </button>

                    {dropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
                        <div className="flex items-center border-b border-gray-200 px-3">
                          <input
                            ref={inputRef}
                            type="text"
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setDropdownOpen(false)
                            }}
                            placeholder="Search leads..."
                            className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-gray-500"
                          />
                        </div>

                        <div className="max-h-[200px] overflow-y-auto p-1">
                          {filteredLeads.map((lead) => (
                            <button
                              type="button"
                              key={lead.id}
                              onClick={() => {
                                field.onChange(lead.id)
                                setDropdownOpen(false)
                                setSearchValue('')
                              }}
                              className="w-full flex items-start rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100"
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4 mt-0.5 shrink-0',
                                  field.value === lead.id ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              <div className="flex flex-col items-start">
                                <span className="text-gray-900">
                                  {getLeadDisplayName(lead)}
                                </span>
                                {(lead.first_name || lead.last_name) && (
                                  <span className="text-xs text-gray-500">{lead.email}</span>
                                )}
                              </div>
                            </button>
                          ))}

                          {filteredLeads.length === 0 && (
                            <div className="px-2 py-4 text-center text-sm text-gray-500">
                              No leads found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {fieldState.error && (
                    <p className="text-sm text-red-500 mt-1">{fieldState.error.message}</p>
                  )}
                </>
              )}
            />
          </div>

          {/* Existing outcome status */}
          {existingOutcome && (
            <div
              className={cn(
                'px-3 py-2 rounded-md text-sm font-medium',
                existingOutcome.outcome === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              )}
            >
              Current:{' '}
              {existingOutcome.outcome === 'success' ? 'Success' : 'Failed'}
            </div>
          )}

          {/* Outcome buttons */}
          <div className="flex flex-col md:flex-row gap-3">
            <button
              type="button"
              onClick={() => handleOutcome('success')}
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 min-h-[48px] min-w-[48px] bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              <CheckIcon className="h-5 w-5" />
              Success
            </button>
            <button
              type="button"
              onClick={() => handleOutcome('fail')}
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 min-h-[48px] min-w-[48px] bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 font-medium"
            >
              <X className="h-5 w-5" />
              Failed
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-500">(optional)</span>
            </label>
            <Textarea
              {...form.register('notes')}
              rows={3}
              placeholder="Objections, follow-up timing, next steps..."
              className="resize-none"
            />
          </div>

          {/* Cancel button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
