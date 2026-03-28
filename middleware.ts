import { type NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { shouldAllowLoggedInMarketingHome } from '@/constants/marketingHome'
import { updateSession } from './utils/supabase/middleware'

async function getLoggedInLandingPath(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: userData } = await supabase
    .from('users')
    .select('user_type, username')
    .eq('id', userId)
    .maybeSingle()

  if (!userData?.username) return '/choose-username'
  if (userData.user_type === 'admin') return '/dashboard/admin'
  if (userData.user_type === 'advertiser') return '/dashboard/contests'
  return '/dashboard/opportunities'
}

export async function middleware(request: NextRequest) {
  // Session update and auth; returns response plus user/supabase to avoid duplicate getUser()
  const { response, user, supabase } = await updateSession(request)
  
  // If updateSession already redirected (e.g. unauthenticated on protected path), return that response
  const location = response.headers.get('Location')
  if (location) return response
  
  // Then add route protection for authenticated users (reuse user/supabase from updateSession)
  const { pathname } = request.nextUrl
  
  // Marketing home: send logged-in users straight to their workspace (unless ?guest=1)
  if (
    pathname === '/' &&
    user &&
    !shouldAllowLoggedInMarketingHome(request.nextUrl.searchParams)
  ) {
    const redirectPath = await getLoggedInLandingPath(supabase, user.id)
    return NextResponse.redirect(new URL(redirectPath, request.url))
  }

  // Auth route protection - redirect logged-in users away from auth pages
  if (pathname.startsWith('/auth/')) {
    if (user) {
      const redirectPath = await getLoggedInLandingPath(supabase, user.id)
      return NextResponse.redirect(new URL(redirectPath, request.url))
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
          
          // Keep /dashboard root accessible for non-admin users.
          // Only admins are redirected to the admin dashboard.
          if (pathname === '/dashboard') {
            if (userType === 'admin') {
              const redirectUrl = new URL('/dashboard/admin', request.url)
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
            // Own contest: send brands to the brand contest page (not the creator opportunity UI).
            const opportunityContestMatch = pathname.match(
              /^\/dashboard\/opportunities\/([^/]+)/
            )
            if (opportunityContestMatch?.[1]) {
              const { data: contestRow } = await supabase
                .from('contests')
                .select('advertiser_id')
                .eq('id', opportunityContestMatch[1])
                .maybeSingle()
              if (contestRow?.advertiser_id === user.id) {
                const brandContestUrl = new URL(
                  `/dashboard/contests/${opportunityContestMatch[1]}`,
                  request.url
                )
                return NextResponse.redirect(brandContestUrl)
              } else {
                const redirectUrl = new URL('/dashboard/contests', request.url)
                redirectUrl.searchParams.set('creator_route', '1')
                redirectUrl.searchParams.set(
                  'contest_id',
                  opportunityContestMatch[1]
                )
                return NextResponse.redirect(redirectUrl)
              }
            } else {
              const redirectUrl = new URL('/dashboard/contests', request.url)
              redirectUrl.searchParams.set('creator_route', '1')
              if (pathname.startsWith('/dashboard/opportunities')) {
                redirectUrl.searchParams.set('creator_section', 'opportunities')
              } else if (pathname.startsWith('/dashboard/submissions')) {
                redirectUrl.searchParams.set('creator_section', 'submissions')
              } else if (pathname.startsWith('/dashboard/earnings')) {
                redirectUrl.searchParams.set('creator_section', 'earnings')
              }
              return NextResponse.redirect(redirectUrl)
            }
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
    '/',
    '/dashboard/:path*',
    '/choose-username',
    '/auth/:path*'
  ],
}