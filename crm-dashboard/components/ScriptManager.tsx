'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Script } from '@/types/script'
import { ScriptCard } from './ScriptCard'
import { AddEditScriptDialog } from './AddEditScriptDialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ScriptManagerProps {
  clientId: string
}

type DialogMode = 'closed' | 'add' | 'edit' | 'view'

export function ScriptManager({ clientId }: ScriptManagerProps) {
  const [scripts, setScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogMode, setDialogMode] = useState<DialogMode>('closed')
  const [selectedScript, setSelectedScript] = useState<Script | undefined>()
  const supabase = createClient()

  useEffect(() => {
    if (clientId) {
      fetchScripts()
    }
  }, [clientId])

  const fetchScripts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('scripts')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching scripts:', error)
    } else {
      setScripts(data || [])
    }
    setLoading(false)
  }

  const handleAddScript = () => {
    setDialogMode('add')
    setSelectedScript(undefined)
  }

  const handleEditScript = (script: Script) => {
    setDialogMode('edit')
    setSelectedScript(script)
  }

  const handleViewScript = (script: Script) => {
    setDialogMode('view')
    setSelectedScript(script)
  }

  const handleToggleActive = async (script: Script) => {
    if (
      window.confirm('Mark this script as inactive? It will be hidden from the list.')
    ) {
      const { error } = await supabase
        .from('scripts')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', script.id)

      if (error) {
        console.error('Error toggling script:', error)
        alert('Failed to update script: ' + error.message)
      } else {
        fetchScripts()
      }
    }
  }

  const handleCloseDialog = () => {
    setDialogMode('closed')
    setSelectedScript(undefined)
  }

  const handleSwitchToEdit = () => {
    setDialogMode('edit')
    // selectedScript is already set
  }

  return (
    <div>
      {/* Add Script button - right aligned */}
      <div className="flex justify-end mb-4">
        <button
          onClick={handleAddScript}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
        >
          Add Script
        </button>
      </div>

      {/* Loading state */}
      {loading && <div className="text-gray-500">Loading scripts...</div>}

      {/* Empty state */}
      {!loading && scripts.length === 0 && (
        <div className="text-gray-500 text-center py-8">
          No scripts yet. Create your first call script to get started.
        </div>
      )}

      {/* Scripts grid */}
      {!loading && scripts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scripts.map((script) => (
            <ScriptCard
              key={script.id}
              script={script}
              onEdit={() => handleEditScript(script)}
              onView={() => handleViewScript(script)}
              onToggleActive={() => handleToggleActive(script)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <AddEditScriptDialog
        script={dialogMode === 'edit' ? selectedScript : undefined}
        clientId={clientId}
        open={dialogMode === 'add' || dialogMode === 'edit'}
        onClose={handleCloseDialog}
        onSaved={fetchScripts}
      />

      {/* View Dialog */}
      {dialogMode === 'view' && selectedScript && (
        <Dialog open={true} onOpenChange={handleCloseDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedScript.title}</DialogTitle>
            </DialogHeader>

            <div className="whitespace-pre-wrap text-base leading-relaxed py-4">
              {selectedScript.body}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
              <button
                onClick={handleCloseDialog}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 min-h-[44px]"
              >
                Close
              </button>
              <button
                onClick={handleSwitchToEdit}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 min-h-[44px]"
              >
                Edit
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
