import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from './utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request)
  } catch (error) {
    console.error('Error in middlewaree:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: ['/dashboard/:path*'],
}