export interface Lead {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  sms_consent: boolean
  sms_consent_at: string | null
  preferred_contact: 'email' | 'phone' | 'sms'
  ip_address: string | null
  user_agent: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  landing_page_url: string | null
  referrer: string | null
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'unqualified'
  notes: string | null
  has_website: boolean | null
  social_media_presence: number | null  // 1-5 scale
  niche_id: string | null
  created_at: string
  updated_at: string
}

export interface LeadEvent {
  id: string
  lead_id: string
  event_type: string
  event_data: Record<string, unknown> | null
  created_at: string
}
