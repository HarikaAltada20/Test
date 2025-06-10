import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from './utils/supabase/middleware'
import { createClient } from '@/utils/supabase/server'

export async function middleware(request: NextRequest) {
  // First, handle the session update (your original working code)
  const response = await updateSession(request)
  
  // Then add route protection for authenticated users
  const { pathname } = request.nextUrl
  
  // Auth route protection - redirect logged-in users away from auth pages
  if (pathname.startsWith('/auth/')) {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // User is logged in, redirect to dashboard
        const redirectUrl = new URL('/dashboard', request.url)
        return NextResponse.redirect(redirectUrl)
      }
    } catch (error) {
      console.error('Auth route protection error:', error)
      // Don't block the request if there's an error checking auth
    }
  }
  
  // Only check permissions for dashboard routes
  if (pathname.startsWith('/dashboard')) {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      // If user is authenticated, check permissions
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('user_type')
          .eq('id', user.id)
          .single()

        if (userData?.user_type) {
          const userType = userData.user_type
          
          // Define route patterns for different user types
          const brandOnlyRoutes = [
            '/dashboard/contests',
            '/dashboard/analytics',
            '/dashboard/billing'
          ]

          const creatorOnlyRoutes = [
            '/dashboard/opportunities',
            '/dashboard/submissions',
            '/dashboard/earnings'
          ]

          const adminOnlyRoutes = [
            '/dashboard/admin'
          ]

          // Check if current path matches any restricted routes
          const isAccessingBrandRoute = brandOnlyRoutes.some(route => 
            pathname.startsWith(route)
          )
          
          const isAccessingCreatorRoute = creatorOnlyRoutes.some(route => 
            pathname.startsWith(route)
          )

          const isAccessingAdminRoute = adminOnlyRoutes.some(route => 
            pathname.startsWith(route)
          )

          // Redirect logic
          if (userType === 'creator' && isAccessingBrandRoute) {
            const redirectUrl = new URL('/dashboard/opportunities', request.url)
            redirectUrl.searchParams.set('error', 'unauthorized')
            return NextResponse.redirect(redirectUrl)
          }

          if (userType === 'advertiser' && isAccessingCreatorRoute) {
            const redirectUrl = new URL('/dashboard/contests', request.url)
            redirectUrl.searchParams.set('error', 'unauthorized')
            return NextResponse.redirect(redirectUrl)
          }

          // Admin route protection - only admins can access admin routes
          if (isAccessingAdminRoute && userType !== 'admin') {
            const redirectUrl = new URL('/dashboard', request.url)
            redirectUrl.searchParams.set('error', 'admin_access_required')
            return NextResponse.redirect(redirectUrl)
          }

          // Prevent admins from accessing brand/creator specific routes
          if (userType === 'admin' && (isAccessingBrandRoute || isAccessingCreatorRoute)) {
            const redirectUrl = new URL('/dashboard/admin', request.url)
            return NextResponse.redirect(redirectUrl)
          }
        }
      }
    } catch (error) {
      console.error('Route protection error:', error)
      // Don't block the request if there's an error checking permissions
    }
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/choose-username',
    '/auth/:path*'
  ],
}