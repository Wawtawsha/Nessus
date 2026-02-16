'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import type { Script } from '@/types/script'
import { scriptSchema, type ScriptFormValues } from '@/lib/schemas/scriptSchema'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

interface AddEditScriptDialogProps {
  script?: Script
  clientId: string
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function AddEditScriptDialog({
  script,
  clientId,
  open,
  onClose,
  onSaved,
}: AddEditScriptDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ScriptFormValues>({
    resolver: zodResolver(scriptSchema),
    mode: 'onSubmit',
    defaultValues: {
      title: script?.title || '',
      body: script?.body || '',
    },
  })

  // Reset form when script prop changes (switching between edit targets)
  useEffect(() => {
    if (script) {
      reset({
        title: script.title,
        body: script.body,
      })
    } else {
      reset({
        title: '',
        body: '',
      })
    }
  }, [script, reset])

  const onSubmit = async (data: ScriptFormValues) => {
    setIsSubmitting(true)

    try {
      if (script) {
        // Edit mode
        const { error } = await supabase
          .from('scripts')
          .update({
            title: data.title,
            body: data.body,
            updated_at: new Date().toISOString(),
          })
          .eq('id', script.id)

        if (error) throw error
      } else {
        // Create mode
        const { error } = await supabase.from('scripts').insert({
          title: data.title,
          body: data.body,
          client_id: clientId,
        })

        if (error) throw error
      }

      onSaved()
      onClose()
    } catch (error: any) {
      console.error('Error saving script:', error)
      alert('Failed to save script: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{script ? 'Edit Script' : 'Add New Script'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              {...register('title')}
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Cold Call Opening Script"
            />
            {errors.title && (
              <p className="text-sm text-red-500 mt-1">{errors.title.message}</p>
            )}
          </div>

          {/* Body field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Script
            </label>
            <Textarea
              {...register('body')}
              rows={10}
              className="whitespace-pre-wrap"
              placeholder="Enter your call script here..."
            />
            {errors.body && (
              <p className="text-sm text-red-500 mt-1">{errors.body.message}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 min-h-[44px]"
            >
              {isSubmitting
                ? script
                  ? 'Saving...'
                  : 'Creating...'
                : script
                ? 'Save Changes'
                : 'Create Script'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
