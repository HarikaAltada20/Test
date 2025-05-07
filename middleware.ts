import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request)
  } catch (error) {
    // Log detailed error information for debugging
    console.error('Middleware Error:', {
      message: error instanceof Error ? error.message : String(error),
      url: request.url,
      headers: Object.fromEntries(request.headers),
      stack: error instanceof Error ? error.stack : undefined
    })
    
    // Only redirect to login if it's a critical error, not a temporary one
    if (error instanceof Error && (
        error.message.includes('invalid session') || 
        error.message.includes('unauthorized') ||
        error.message.includes('expired session')
      )) {
      const response = NextResponse.redirect(new URL('/auth/signin', request.url))
      // Clear auth cookies only on definite authentication failures
      response.cookies.delete('sb-access-token')
      response.cookies.delete('sb-refresh-token')
      return response
    }
    
    // For temporary errors, just proceed with the request
    // This allows retry mechanisms to work without interrupting user experience
    console.warn('Proceeding despite middleware error:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/cron (cron job endpoints)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/cron|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}