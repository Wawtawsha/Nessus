// Event categories for color-coding
export const EVENT_CATEGORIES: Record<string, { label: string; color: string }> = {
  instant_download: { label: 'Downloads', color: '#22c55e' },
  photo_queued: { label: 'Downloads', color: '#22c55e' },
  photo_dequeued: { label: 'Downloads', color: '#22c55e' },
  download_email_submitted: { label: 'Downloads', color: '#22c55e' },
  queue_blade_opened: { label: 'Downloads', color: '#22c55e' },
  crosslink_collegethursday: { label: 'Navigation', color: '#3b82f6' },
  crosslink_pressclub: { label: 'Navigation', color: '#3b82f6' },
  promo_popup_shown: { label: 'Promo', color: '#eab308' },
  promo_popup_dismissed: { label: 'Promo', color: '#eab308' },
  banner_click: { label: 'Promo', color: '#eab308' },
  zip_downloaded: { label: 'Downloads', color: '#22c55e' },
  lead_form_opened: { label: 'Lead Capture', color: '#a855f7' },
  lead_form_submit: { label: 'Lead Capture', color: '#a855f7' },
  tip_click: { label: 'Engagement', color: '#f97316' },
  book_us_click: { label: 'Engagement', color: '#f97316' },
  calendly_click: { label: 'Engagement', color: '#f97316' },
  instagram_click: { label: 'Engagement', color: '#f97316' },
  like_photo: { label: 'Engagement', color: '#f97316' },
  comment_submitted: { label: 'Engagement', color: '#f97316' },
  photo_lightbox_opened: { label: 'Navigation', color: '#3b82f6' },
  theme_switched: { label: 'Navigation', color: '#3b82f6' },
  gallery_load_more: { label: 'Navigation', color: '#3b82f6' },
}

export function getEventColor(eventName: string): string {
  return EVENT_CATEGORIES[eventName]?.color ?? '#6b7280'
}

export function formatEventName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// Lightweight UA parser — no external dependencies
export function parseUA(ua: string): { device: string; browser: string; os: string } {
  // Device
  let device = 'Desktop'
  if (/iPad|tablet/i.test(ua)) device = 'Tablet'
  else if (/iPhone|Android.*Mobile|Mobile/i.test(ua)) device = 'Mobile'

  // Browser (order matters — check in-app browsers first)
  let browser = 'Other'
  if (/Instagram/i.test(ua)) browser = 'Instagram'
  else if (/Snapchat/i.test(ua)) browser = 'Snapchat'
  else if (/FBAV|FBAN|MetaIAB/i.test(ua)) browser = 'Facebook'
  else if (/CriOS/i.test(ua)) browser = 'Chrome (iOS)'
  else if (/FxiOS/i.test(ua)) browser = 'Firefox (iOS)'
  else if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome'
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari'
  else if (/Firefox/i.test(ua)) browser = 'Firefox'

  // OS
  let os = 'Other'
  if (/iPhone|iPad|iOS/i.test(ua)) os = 'iOS'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/Windows/i.test(ua)) os = 'Windows'
  else if (/Macintosh|Mac OS/i.test(ua)) os = 'macOS'
  else if (/Linux/i.test(ua)) os = 'Linux'

  return { device, browser, os }
}
