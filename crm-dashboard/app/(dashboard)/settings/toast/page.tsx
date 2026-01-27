'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { useSyncStatus } from '@/contexts/SyncContext'

interface ToastIntegration {
  id: string
  client_id: string
  restaurant_guid: string
  is_active: boolean
  last_sync_at: string | null
  last_sync_status: 'success' | 'error' | 'in_progress' | null
  last_sync_error: string | null
  created_at: string
}

export default function ToastSettingsPage() {
  const { isAdmin, loading: userLoading, clients } = useUser()
  const { status: syncStatus, syncNow } = useSyncStatus()
  const router = useRouter()

  // Selected client
  const [selectedClientId, setSelectedClientId] = useState<string>('')

  // Existing integration
  const [integration, setIntegration] = useState<ToastIntegration | null>(null)
  const [loadingIntegration, setLoadingIntegration] = useState(false)

  // Form state
  const [restaurantGuid, setRestaurantGuid] = useState('')
  const [toastClientId, setToastClientId] = useState('')
  const [toastClientSecret, setToastClientSecret] = useState('')
  const [apiHostname, setApiHostname] = useState('https://ws-api.toasttab.com')

  // UI state
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Test mode state
  const [showTestMode, setShowTestMode] = useState(false)
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null)
  const [daysBack, setDaysBack] = useState('7')

  // Full resync state
  const [fullSyncDays, setFullSyncDays] = useState('90')
  const [fullSyncing, setFullSyncing] = useState(false)

  // Diagnose state
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagnoseResult, setDiagnoseResult] = useState<Record<string, unknown> | null>(null)

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isAdmin) {
      router.push('/leads')
    }
  }, [userLoading, isAdmin, router])

  // Load integration when client selected
  useEffect(() => {
    if (!selectedClientId) {
      setIntegration(null)
      return
    }

    async function loadIntegration() {
      setLoadingIntegration(true)
      const response = await fetch(`/api/toast/setup?clientId=${selectedClientId}`)
      const data = await response.json()
      setIntegration(data.integration)
      if (data.integration) {
        setRestaurantGuid(data.integration.restaurant_guid)
      }
      setLoadingIntegration(false)
    }

    loadIntegration()
  }, [selectedClientId])

  if (userLoading) {
    return <div className="p-6"><div className="animate-pulse">Loading...</div></div>
  }

  if (!isAdmin) return null

  const handleTest = async () => {
    if (!toastClientId || !toastClientSecret || !restaurantGuid) {
      setMessage({ type: 'error', text: 'Fill in all credential fields first' })
      return
    }

    setTesting(true)
    setMessage(null)
    setTestResult(null)

    try {
      const response = await fetch('/api/toast/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: toastClientId,
          clientSecret: toastClientSecret,
          restaurantGuid,
          apiHostname,
          daysBack: parseInt(daysBack) || 7,
        }),
      })
      const data = await response.json()
      setTestResult(data)
      if (data.success) {
        setMessage({ type: 'success', text: `Connection successful! Found ${data.orders?.count || 0} orders.` })
      } else {
        setMessage({ type: 'error', text: data.error || 'Test failed' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!selectedClientId) {
      setMessage({ type: 'error', text: 'Select a client first' })
      return
    }
    if (!toastClientId || !toastClientSecret || !restaurantGuid) {
      setMessage({ type: 'error', text: 'Fill in all credential fields' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/toast/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          restaurantGuid,
          toastClientId,
          toastClientSecret,
          apiHostname,
        }),
      })
      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Integration saved successfully!' })
        setIntegration(data.integration)
        // Clear secrets from form after saving
        setToastClientSecret('')
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' })
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    if (!selectedClientId || !integration) return

    setMessage(null)

    try {
      // Trigger sync via context
      await syncNow()

      // Show success message
      setMessage({
        type: 'success',
        text: 'Sync triggered successfully. Check the status indicator in the sidebar.'
      })

      // Refresh integration status to show updated last_sync_at
      const refreshResponse = await fetch(`/api/toast/setup?clientId=${selectedClientId}`)
      const refreshData = await refreshResponse.json()
      setIntegration(refreshData.integration)
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to trigger sync' })
    }
  }

  const handleFullResync = async () => {
    if (!selectedClientId || !integration) return
    if (!confirm(`This will fetch ALL orders from the last ${fullSyncDays} days. This may take a while. Continue?`)) return

    setFullSyncing(true)
    setMessage(null)

    try {
      const response = await fetch('/api/toast/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          fullSync: true,
          daysBack: parseInt(fullSyncDays) || 90,
        }),
      })
      const data = await response.json()

      if (data.success) {
        setMessage({
          type: 'success',
          text: `Full resync complete! Processed ${data.stats.ordersProcessed} orders, inserted ${data.stats.ordersInserted}.`
        })
        // Refresh integration status
        const refreshResponse = await fetch(`/api/toast/setup?clientId=${selectedClientId}`)
        const refreshData = await refreshResponse.json()
        setIntegration(refreshData.integration)
      } else {
        setMessage({ type: 'error', text: data.error || 'Full resync failed' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error during full resync' })
    } finally {
      setFullSyncing(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedClientId || !integration) return
    if (!confirm('Remove Toast integration for this client? Orders will remain in the database.')) return

    try {
      const response = await fetch(`/api/toast/setup?clientId=${selectedClientId}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Integration removed' })
        setIntegration(null)
        setRestaurantGuid('')
        setToastClientId('')
        setToastClientSecret('')
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to delete' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' })
    }
  }

  const handleDiagnose = async () => {
    if (!selectedClientId || !integration) return

    setDiagnosing(true)
    setDiagnoseResult(null)
    setMessage(null)

    try {
      const response = await fetch(`/api/toast/diagnose?clientId=${selectedClientId}&days=7`)
      const data = await response.json()
      setDiagnoseResult(data)

      if (data.success) {
        setMessage({
          type: 'success',
          text: `Diagnose complete: Found ${data.results?.totalOrders || 0} orders totaling $${(data.results?.totalRevenue || 0).toFixed(2)}`
        })
      } else {
        setMessage({ type: 'error', text: data.error || 'Diagnose failed' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error during diagnose' })
    } finally {
      setDiagnosing(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Toast Integration</h1>
      <p className="text-gray-600 mb-6">
        Connect Toast POS to sync orders and match customers to leads.
      </p>

      {/* Client Selector */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Client
        </label>
        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Select a client --</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      {selectedClientId && (
        <>
          {/* Integration Status */}
          {loadingIntegration ? (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="animate-pulse">Loading integration status...</div>
            </div>
          ) : integration ? (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Integration Status</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Status:</span>
                  <span className={`ml-2 font-medium ${
                    integration.last_sync_status === 'success' ? 'text-green-600' :
                    integration.last_sync_status === 'error' ? 'text-red-600' :
                    integration.last_sync_status === 'in_progress' ? 'text-yellow-600' :
                    'text-gray-600'
                  }`}>
                    {integration.last_sync_status || 'Never synced'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Last Sync:</span>
                  <span className="ml-2">
                    {integration.last_sync_at
                      ? new Date(integration.last_sync_at).toLocaleString()
                      : 'Never'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Restaurant GUID:</span>
                  <span className="ml-2 font-mono text-xs">{integration.restaurant_guid}</span>
                </div>
                {integration.last_sync_error && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Last Error:</span>
                    <span className="ml-2 text-red-600">{integration.last_sync_error}</span>
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 items-center">
                <button
                  onClick={handleSync}
                  disabled={syncStatus === 'syncing' || fullSyncing}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                  {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
                </button>
                <div className="flex items-center gap-2 border-l pl-3">
                  <input
                    type="number"
                    value={fullSyncDays}
                    onChange={(e) => setFullSyncDays(e.target.value)}
                    className="w-16 px-2 py-1 border border-gray-300 rounded-md text-sm"
                    min="7"
                    max="365"
                  />
                  <span className="text-sm text-gray-500">days</span>
                  <button
                    onClick={handleFullResync}
                    disabled={syncStatus === 'syncing' || fullSyncing}
                    className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 disabled:bg-orange-400 disabled:cursor-not-allowed"
                  >
                    {fullSyncing ? 'Resyncing...' : 'Full Resync'}
                  </button>
                </div>
                <button
                  onClick={handleDelete}
                  className="text-red-600 hover:text-red-800 px-4 py-2"
                >
                  Remove Integration
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                "Sync Now" fetches new orders since last sync. "Full Resync" re-fetches ALL orders for the specified number of days (with pagination).
              </p>

              {/* Diagnose Section */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDiagnose}
                    disabled={diagnosing}
                    className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed"
                  >
                    {diagnosing ? 'Diagnosing...' : 'Diagnose API'}
                  </button>
                  <span className="text-sm text-gray-500">
                    Quick test: fetch 7 days of orders without saving to database
                  </span>
                </div>
                {diagnoseResult && (
                  <div className="mt-4">
                    <details open>
                      <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                        Diagnose Results
                      </summary>
                      <div className="bg-gray-50 rounded-md p-4 text-sm">
                        {diagnoseResult.success ? (
                          <>
                            <div className="grid grid-cols-2 gap-2 mb-4">
                              <div><strong>Total Orders:</strong> {(diagnoseResult.results as Record<string, unknown>)?.totalOrders as number}</div>
                              <div><strong>Revenue Centers:</strong> {((diagnoseResult.results as Record<string, unknown>)?.revenueCenters as string[])?.length || 0}</div>
                              <div><strong>Net Sales:</strong> <span className="text-green-700 font-bold">${((diagnoseResult.results as Record<string, unknown>)?.totalNetSales as number)?.toFixed(2)}</span></div>
                              <div><strong>Gross Sales:</strong> ${((diagnoseResult.results as Record<string, unknown>)?.totalGrossSales as number)?.toFixed(2)}</div>
                              <div className="col-span-2"><strong>Sources:</strong> {((diagnoseResult.results as Record<string, unknown>)?.sources as string[])?.join(', ') || 'None'}</div>
                            </div>
                            <div className="mb-4">
                              <strong>Date Breakdown:</strong>
                              <table className="mt-2 w-full text-xs">
                                <thead>
                                  <tr className="bg-gray-200">
                                    <th className="px-2 py-1 text-left">Date</th>
                                    <th className="px-2 py-1 text-left">Day</th>
                                    <th className="px-2 py-1 text-right">Orders</th>
                                    <th className="px-2 py-1 text-right">Net Sales</th>
                                    <th className="px-2 py-1 text-right">Gross</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {((diagnoseResult.results as Record<string, unknown>)?.dateBreakdown as Array<{date: string; dayOfWeek: string; count: number; netSales: number; grossSales: number}>)?.map((row) => (
                                    <tr key={row.date} className="border-b">
                                      <td className="px-2 py-1">{row.date}</td>
                                      <td className="px-2 py-1">{row.dayOfWeek}</td>
                                      <td className="px-2 py-1 text-right">{row.count}</td>
                                      <td className="px-2 py-1 text-right font-medium">${row.netSales.toFixed(2)}</td>
                                      <td className="px-2 py-1 text-right text-gray-500">${row.grossSales.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        ) : (
                          <div className="text-red-600">{diagnoseResult.error as string}</div>
                        )}
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-gray-500">Raw JSON</summary>
                          <pre className="bg-gray-900 text-green-400 p-4 rounded-md overflow-auto max-h-64 text-xs mt-2">
                            {JSON.stringify(diagnoseResult, null, 2)}
                          </pre>
                        </details>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Credentials Form */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              {integration ? 'Update Credentials' : 'Setup Toast Connection'}
            </h2>
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Restaurant GUID
                </label>
                <input
                  type="text"
                  value={restaurantGuid}
                  onChange={(e) => setRestaurantGuid(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., b455dc0f-6f68-49d3-a999-b431e79c59a8"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Toast Client ID
                </label>
                <input
                  type="text"
                  value={toastClientId}
                  onChange={(e) => setToastClientId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your Toast API client ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Toast Client Secret
                </label>
                <input
                  type="password"
                  value={toastClientSecret}
                  onChange={(e) => setToastClientSecret(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={integration ? '(unchanged - enter new value to update)' : 'Your Toast API secret'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Hostname (optional)
                </label>
                <input
                  type="text"
                  value={apiHostname}
                  onChange={(e) => setApiHostname(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://ws-api.toasttab.com"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleTest}
                disabled={testing}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !toastClientSecret}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : integration ? 'Update Integration' : 'Save Integration'}
              </button>
            </div>
          </div>

          {/* Test Mode */}
          <div className="bg-white rounded-lg shadow p-6">
            <button
              onClick={() => setShowTestMode(!showTestMode)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              {showTestMode ? 'Hide' : 'Show'} API Test Mode
            </button>

            {showTestMode && (
              <div className="mt-4">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Days Back
                  </label>
                  <input
                    type="number"
                    value={daysBack}
                    onChange={(e) => setDaysBack(e.target.value)}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md"
                    min="1"
                    max="90"
                  />
                </div>
                {testResult && (
                  <details open>
                    <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                      Raw JSON Response
                    </summary>
                    <pre className="bg-gray-900 text-green-400 p-4 rounded-md overflow-auto max-h-96 text-xs">
                      {JSON.stringify(testResult, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Messages */}
      {message && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-md shadow-lg ${
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' :
          'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}
    </div>
  )
}
