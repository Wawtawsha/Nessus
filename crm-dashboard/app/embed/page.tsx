'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

interface FormData {
  first_name: string
  last_name: string
  email: string
  phone: string
  preferred_contact: 'email' | 'phone' | 'sms'
  sms_consent: boolean
}

function EmbedForm() {
  const searchParams = useSearchParams()
  const clientId = searchParams.get('client_id')
  const theme = searchParams.get('theme') || 'light'
  const accentColor = searchParams.get('accent') || '3b82f6'
  const redirectUrl = searchParams.get('redirect')
  const utmSource = searchParams.get('utm_source')

  const [formData, setFormData] = useState<FormData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    preferred_contact: 'email',
    sms_consent: false,
  })
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const isDark = theme === 'dark'

  if (!clientId) {
    return (
      <div className={`p-4 text-center ${isDark ? 'text-red-400' : 'text-red-600'}`}>
        Error: Missing client_id parameter
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('submitting')
    setErrorMessage('')

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/submit-lead`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            ...formData,
            utm_source: utmSource || 'embed',
            landing_page_url: document.referrer || window.location.href,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit')
      }

      if (redirectUrl) {
        window.top?.location.assign(redirectUrl)
      } else {
        setStatus('success')
      }
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const bgColor = isDark ? 'bg-gray-900' : 'bg-white'
  const textColor = isDark ? 'text-gray-100' : 'text-gray-900'
  const mutedColor = isDark ? 'text-gray-400' : 'text-gray-600'
  const inputBg = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
  const inputText = isDark ? 'text-white' : 'text-gray-900'

  if (status === 'success') {
    return (
      <div className={`p-6 text-center ${bgColor} min-h-screen flex items-center justify-center`}>
        <div>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: `#${accentColor}20` }}
          >
            <svg className="w-8 h-8" style={{ color: `#${accentColor}` }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className={`text-xl font-bold ${textColor} mb-2`}>Thank You!</h2>
          <p className={mutedColor}>We&apos;ve received your information and will be in touch soon.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`p-4 ${bgColor} min-h-screen`}>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="first_name" className={`block text-sm font-medium ${textColor} mb-1`}>
              First Name *
            </label>
            <input
              type="text"
              id="first_name"
              name="first_name"
              required
              value={formData.first_name}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${inputBg} ${inputText}`}
              style={{ ['--tw-ring-color' as string]: `#${accentColor}` }}
            />
          </div>
          <div>
            <label htmlFor="last_name" className={`block text-sm font-medium ${textColor} mb-1`}>
              Last Name *
            </label>
            <input
              type="text"
              id="last_name"
              name="last_name"
              required
              value={formData.last_name}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${inputBg} ${inputText}`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className={`block text-sm font-medium ${textColor} mb-1`}>
            Email *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${inputBg} ${inputText}`}
          />
        </div>

        <div>
          <label htmlFor="phone" className={`block text-sm font-medium ${textColor} mb-1`}>
            Phone
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${inputBg} ${inputText}`}
          />
        </div>

        <div>
          <label className={`block text-sm font-medium ${textColor} mb-2`}>
            Preferred Contact *
          </label>
          <div className="flex gap-4">
            {(['email', 'phone', 'sms'] as const).map((method) => (
              <label key={method} className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="preferred_contact"
                  value={method}
                  checked={formData.preferred_contact === method}
                  onChange={handleChange}
                  className="mr-2 h-4 w-4"
                  style={{ accentColor: `#${accentColor}` }}
                />
                <span className={`text-sm ${textColor}`}>
                  {method === 'sms' ? 'SMS' : method.charAt(0).toUpperCase() + method.slice(1)}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-start">
          <input
            type="checkbox"
            id="sms_consent"
            name="sms_consent"
            checked={formData.sms_consent}
            onChange={handleChange}
            className="mt-1 h-4 w-4 rounded"
            style={{ accentColor: `#${accentColor}` }}
          />
          <label htmlFor="sms_consent" className={`ml-2 text-sm ${mutedColor}`}>
            I agree to receive SMS messages. Message and data rates may apply.
          </label>
        </div>

        {status === 'error' && (
          <div className={`${isDark ? 'bg-red-900/50 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-700'} border px-4 py-3 rounded text-sm`}>
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="w-full text-white py-3 px-4 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{
            backgroundColor: `#${accentColor}`,
            ['--tw-ring-color' as string]: `#${accentColor}`,
          }}
        >
          {status === 'submitting' ? 'Submitting...' : 'Submit'}
        </button>
      </form>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="p-4 bg-white min-h-screen flex items-center justify-center">
      <div className="animate-pulse space-y-4 w-full max-w-md">
        <div className="grid grid-cols-2 gap-3">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
        <div className="h-10 bg-gray-200 rounded"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
        <div className="h-12 bg-gray-200 rounded"></div>
      </div>
    </div>
  )
}

export default function EmbedPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <EmbedForm />
    </Suspense>
  )
}
