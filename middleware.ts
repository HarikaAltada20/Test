import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from './utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Session update and auth; returns response plus user/supabase to avoid duplicate getUser()
  const { response, user, supabase } = await updateSession(request)
  
  // If updateSession already redirected (e.g. unauthenticated on protected path), return that response
  const location = response.headers.get('Location')
  if (location) return response
  
  // Then add route protection for authenticated users (reuse user/supabase from updateSession)
  const { pathname } = request.nextUrl
  
  // Auth route protection - redirect logged-in users away from auth pages
  if (pathname.startsWith('/auth/')) {
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('user_type, username')
        .eq('id', user.id)
        .maybeSingle()

      let redirectPath = '/choose-username'
      if (userData?.username) {
        if (userData.user_type === 'admin') {
          redirectPath = '/dashboard/admin'
        } else if (userData.user_type === 'advertiser') {
          redirectPath = '/dashboard/contests'
        } else {
          redirectPath = '/dashboard/opportunities'
        }
      }

      const redirectUrl = new URL(redirectPath, request.url)
      return NextResponse.redirect(redirectUrl)
    }
  }
  
  // Only check permissions for dashboard routes
  if (pathname.startsWith('/dashboard')) {
    try {
      // If user is authenticated, check permissions (reuse user/supabase from updateSession)
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('user_type')
          .eq('id', user.id)
          .single()

        if (userData?.user_type) {
          const userType = userData.user_type
          
          // Redirect /dashboard root to each role's primary workspace.
          if (pathname === '/dashboard') {
            if (userType === 'admin') {
              const redirectUrl = new URL('/dashboard/admin', request.url)
              return NextResponse.redirect(redirectUrl)
            }
            if (userType === 'advertiser') {
              const redirectUrl = new URL('/dashboard/contests', request.url)
              return NextResponse.redirect(redirectUrl)
            }
            if (userType === 'creator') {
              const redirectUrl = new URL('/dashboard/opportunities', request.url)
              return NextResponse.redirect(redirectUrl)
            }
          }
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
          // but allow admins to access contest edit routes for moderation/assistance
          if (userType === 'admin' && (isAccessingBrandRoute || isAccessingCreatorRoute)) {
            const isContestEditRoute = pathname.startsWith('/dashboard/contests/') && pathname.includes('/edit');
            if (!isContestEditRoute) {
              const redirectUrl = new URL('/dashboard/admin', request.url)
              return NextResponse.redirect(redirectUrl)
            }
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