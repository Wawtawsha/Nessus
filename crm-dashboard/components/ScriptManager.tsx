'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ScriptWithStats, OutcomeStats } from '@/types/script'
import { ScriptCard } from './ScriptCard'
import { AddEditScriptDialog } from './AddEditScriptDialog'
import { RecordOutcomeDialog } from './RecordOutcomeDialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ScriptManagerProps {
  clientId: string
}

type DialogMode = 'closed' | 'add' | 'edit' | 'view' | 'record-outcome'

export function ScriptManager({ clientId }: ScriptManagerProps) {
  const [scripts, setScripts] = useState<ScriptWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogMode, setDialogMode] = useState<DialogMode>('closed')
  const [selectedScript, setSelectedScript] = useState<ScriptWithStats | undefined>()
  const supabase = createClient()

  useEffect(() => {
    if (clientId) {
      fetchScriptsAndStats()
    }
  }, [clientId])

  const fetchScriptsAndStats = async () => {
    setLoading(true)

    // Fetch scripts
    const { data: scriptsData, error: scriptsError } = await supabase
      .from('scripts')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (scriptsError) {
      console.error('Error fetching scripts:', scriptsError)
      setLoading(false)
      return
    }

    // Fetch stats via RPC
    const { data: statsData } = await supabase
      .rpc('get_script_outcome_stats', { p_client_id: clientId })

    // Join scripts with stats
    const defaultStats: OutcomeStats = {
      script_id: '',
      success_count: 0,
      fail_count: 0,
      total_count: 0,
      win_rate: 0,
    }

    const scriptsWithStats: ScriptWithStats[] = (scriptsData || []).map(script => ({
      ...script,
      stats: statsData?.find((s: OutcomeStats) => s.script_id === script.id) || { ...defaultStats, script_id: script.id },
    }))

    setScripts(scriptsWithStats)
    setLoading(false)
  }

  const handleAddScript = () => {
    setDialogMode('add')
    setSelectedScript(undefined)
  }

  const handleEditScript = (script: ScriptWithStats) => {
    setDialogMode('edit')
    setSelectedScript(script)
  }

  const handleViewScript = (script: ScriptWithStats) => {
    setDialogMode('view')
    setSelectedScript(script)
  }

  const handleRecordOutcome = (script: ScriptWithStats) => {
    setDialogMode('record-outcome')
    setSelectedScript(script)
  }

  const handleToggleActive = async (script: ScriptWithStats) => {
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
        fetchScriptsAndStats()
      }
    }
  }

  const handleOutcomeSaved = async () => {
    await fetchScriptsAndStats()  // Refetch to update counters
    handleCloseDialog()
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
              onRecordOutcome={() => handleRecordOutcome(script)}
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
        onSaved={fetchScriptsAndStats}
      />

      {/* Record Outcome Dialog */}
      {dialogMode === 'record-outcome' && selectedScript && (
        <RecordOutcomeDialog
          script={selectedScript}
          clientId={clientId}
          open={true}
          onClose={handleCloseDialog}
          onSaved={handleOutcomeSaved}
        />
      )}

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
