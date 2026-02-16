'use client'

import { Pencil, EyeOff, Eye, Phone } from 'lucide-react'
import type { ScriptWithStats } from '@/types/script'

interface ScriptCardProps {
  script: ScriptWithStats
  onEdit: () => void
  onToggleActive: () => void
  onView: () => void
  onRecordOutcome: () => void
}

export function ScriptCard({ script, onEdit, onToggleActive, onView, onRecordOutcome }: ScriptCardProps) {
  return (
    <div className="bg-white rounded-lg shadow">
      {/* Clickable card content area */}
      <div
        onClick={onView}
        className="px-4 pt-4 pb-2 cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <h3 className="font-bold text-gray-900 mb-2 truncate">{script.title}</h3>
        <div className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3">
          {script.body}
        </div>
      </div>

      {/* Stats row - only shown when outcomes exist */}
      {script.stats.total_count > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-sm">
          <span className="text-green-600 font-medium">{script.stats.success_count} won</span>
          <span className="text-red-600 font-medium">{script.stats.fail_count} lost</span>
          <span className="text-gray-500">{script.stats.win_rate}%</span>
        </div>
      )}

      {/* Status badge and actions */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            script.is_active
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {script.is_active ? 'Active' : 'Inactive'}
        </span>

        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onRecordOutcome(); }}
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 min-h-[44px] px-2"
          >
            <Phone className="h-4 w-4" />
            Record Call
          </button>
          <button
            onClick={onEdit}
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 min-h-[44px] px-2"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          <button
            onClick={onToggleActive}
            className={`text-sm flex items-center gap-1 min-h-[44px] px-2 ${
              script.is_active
                ? 'text-red-600 hover:text-red-800'
                : 'text-green-600 hover:text-green-800'
            }`}
          >
            {script.is_active ? (
              <>
                <EyeOff className="h-4 w-4" />
                Mark Inactive
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                Reactivate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
