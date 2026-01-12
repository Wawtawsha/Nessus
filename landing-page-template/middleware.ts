import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// EU country codes (ISO 3166-1 alpha-2)
const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
]

export function middleware(request: NextRequest) {
  // Get country from Vercel's geo headers
  const country = request.geo?.country || ''

  // Block EU visitors
  if (EU_COUNTRIES.includes(country)) {
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head><title>Service Unavailable</title></head>
        <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
          <div style="text-align: center;">
            <h1>Service Not Available</h1>
            <p>This service is not available in your region.</p>
          </div>
        </body>
      </html>`,
      {
        status: 451, // Unavailable For Legal Reasons
        headers: { 'Content-Type': 'text/html' }
      }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all paths except static files and API routes
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
