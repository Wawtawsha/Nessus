'use client'

import { useState, useEffect, useRef } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Niche } from '@/types/niche'
import { cn } from '@/lib/utils'

interface NicheComboBoxProps {
  value: string | null
  onChange: (nicheId: string | null) => void
}

export function NicheComboBox({ value, onChange }: NicheComboBoxProps) {
  const [open, setOpen] = useState(false)
  const [niches, setNiches] = useState<Niche[]>([])
  const [searchValue, setSearchValue] = useState('')
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchNiches()
  }, [])

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchNiches = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('niches')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching niches:', error)
    } else {
      setNiches(data || [])
    }
    setLoading(false)
  }

  const handleCreateNiche = async () => {
    const normalizedName = searchValue.toLowerCase().trim()
    if (!normalizedName) return

    const { data, error } = await supabase
      .from('niches')
      .insert({ name: normalizedName })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        const { data: existingNiche } = await supabase
          .from('niches')
          .select('*')
          .eq('name', normalizedName)
          .single()

        if (existingNiche) {
          setNiches(prev => {
            if (!prev.find(n => n.id === existingNiche.id)) {
              return [...prev, existingNiche].sort((a, b) => a.name.localeCompare(b.name))
            }
            return prev
          })
          onChange(existingNiche.id)
          setOpen(false)
          setSearchValue('')
        }
      } else {
        console.error('Error creating niche:', error)
      }
    } else if (data) {
      setNiches(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      onChange(data.id)
      setOpen(false)
      setSearchValue('')
    }
  }

  const selectedNiche = niches.find(n => n.id === value)

  const filtered = searchValue
    ? niches.filter(n => n.name.includes(searchValue.toLowerCase()))
    : niches

  const showCreate = searchValue.trim() &&
    !niches.some(n => n.name === searchValue.toLowerCase().trim())

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open)
          if (!open) setTimeout(() => inputRef.current?.focus(), 0)
        }}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className={selectedNiche ? 'text-gray-900' : 'text-gray-500'}>
          {selectedNiche ? selectedNiche.name : 'Select niche...'}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center border-b border-gray-200 px-3">
            <input
              ref={inputRef}
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false)
                if (e.key === 'Enter' && showCreate) {
                  e.preventDefault()
                  handleCreateNiche()
                }
              }}
              placeholder="Search or create niche..."
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-gray-500"
            />
          </div>

          <div className="max-h-[200px] overflow-y-auto p-1">
            {/* None option */}
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); setSearchValue('') }}
              className="w-full flex items-center rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100"
            >
              <Check className={cn("mr-2 h-4 w-4", value === null ? "opacity-100" : "opacity-0")} />
              (None)
            </button>

            {/* Niche list */}
            {filtered.map((niche) => (
              <button
                type="button"
                key={niche.id}
                onClick={() => { onChange(niche.id); setOpen(false); setSearchValue('') }}
                className="w-full flex items-center rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100"
              >
                <Check className={cn("mr-2 h-4 w-4", value === niche.id ? "opacity-100" : "opacity-0")} />
                {niche.name}
              </button>
            ))}

            {/* Create option */}
            {showCreate && (
              <button
                type="button"
                onClick={handleCreateNiche}
                className="w-full flex items-center rounded-sm px-2 py-1.5 text-sm hover:bg-blue-50 text-blue-600"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create &quot;{searchValue.toLowerCase().trim()}&quot;
              </button>
            )}

            {filtered.length === 0 && !showCreate && (
              <div className="px-2 py-4 text-center text-sm text-gray-500">
                No niches found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
