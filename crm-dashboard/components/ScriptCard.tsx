'use client'

import { Pencil, EyeOff, Eye } from 'lucide-react'
import type { Script } from '@/types/script'

interface ScriptCardProps {
  script: Script
  onEdit: () => void
  onToggleActive: () => void
  onView: () => void
}

export function ScriptCard({ script, onEdit, onToggleActive, onView }: ScriptCardProps) {
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
