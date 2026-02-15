'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/contexts/UserContext'
import { useRouter } from 'next/navigation'

interface Client {
  id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
  settings: Record<string, unknown>
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [formData, setFormData] = useState({ name: '', slug: '' })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const { isAdmin } = useUser()
  const router = useRouter()

  // Redirect non-admins
  useEffect(() => {
    if (!isAdmin && !loading) {
      router.push('/leads')
    }
  }, [isAdmin, loading, router])

  const fetchClients = useCallback(async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching clients:', error)
    } else {
      setClients(data || [])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const slug = formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    if (editingClient) {
      const { error } = await supabase
        .from('clients')
        .update({ name: formData.name, slug })
        .eq('id', editingClient.id)

      if (error) {
        alert('Error updating client: ' + error.message)
      }
    } else {
      const { error } = await supabase
        .from('clients')
        .insert({ name: formData.name, slug })

      if (error) {
        alert('Error creating client: ' + error.message)
      }
    }

    setSaving(false)
    setShowForm(false)
    setEditingClient(null)
    setFormData({ name: '', slug: '' })
    fetchClients()
  }

  const handleEdit = (client: Client) => {
    setEditingClient(client)
    setFormData({ name: client.name, slug: client.slug })
    setShowForm(true)
  }

  const toggleActive = async (client: Client) => {
    const { error } = await supabase
      .from('clients')
      .update({ is_active: !client.is_active })
      .eq('id', client.id)

    if (error) {
      alert('Error updating client: ' + error.message)
    } else {
      fetchClients()
    }
  }

  if (!isAdmin) {
    return <div className="text-center py-8">Access denied</div>
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your client accounts</p>
        </div>
        <button
          onClick={() => {
            setEditingClient(null)
            setFormData({ name: '', slug: '' })
            setShowForm(true)
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
        >
          Add Client
        </button>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">
              {editingClient ? 'Edit Client' : 'Add New Client'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slug (URL-friendly ID)
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="acme-corp (auto-generated if empty)"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingClient(null)
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingClient ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clients Table */}
      <div className="bg-white rounded-lg shadow">
        {clients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No clients yet. Click &quot;Add Client&quot; to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Slug
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    {client.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.slug}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 font-mono">
                    {client.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        client.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {client.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(client.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => handleEdit(client)}
                      className="text-blue-600 hover:text-blue-800 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(client)}
                      className={client.is_active ? 'text-gray-600 hover:text-gray-800' : 'text-green-600 hover:text-green-800'}
                    >
                      {client.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-500">
        {clients.length} client{clients.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
