'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Niche } from '@/types/niche'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface NicheComboBoxProps {
  value: string | null
  onChange: (nicheId: string | null) => void
}

export function NicheComboBox({ value, onChange }: NicheComboBoxProps) {
  const [open, setOpen] = useState(false)
  const [niches, setNiches] = useState<Niche[]>([])
  const [searchValue, setSearchValue] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchNiches()
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
      // Handle unique constraint violation (23505)
      if (error.code === '23505') {
        // Find the existing niche
        const { data: existingNiche } = await supabase
          .from('niches')
          .select('*')
          .eq('name', normalizedName)
          .single()

        if (existingNiche) {
          setNiches(prev => {
            // Add if not already in list
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
      // Add new niche to list
      setNiches(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      onChange(data.id)
      setOpen(false)
      setSearchValue('')
    }
  }

  const selectedNiche = niches.find(n => n.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedNiche ? selectedNiche.name : "Select niche..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder="Search or create niche..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              <div className="p-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={handleCreateNiche}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create &quot;{searchValue}&quot;
                </Button>
              </div>
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="(none)"
                onSelect={() => {
                  onChange(null)
                  setOpen(false)
                  setSearchValue('')
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === null ? "opacity-100" : "opacity-0"
                  )}
                />
                (None)
              </CommandItem>
              {niches.map((niche) => (
                <CommandItem
                  key={niche.id}
                  value={niche.name}
                  onSelect={() => {
                    onChange(niche.id)
                    setOpen(false)
                    setSearchValue('')
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === niche.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {niche.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
