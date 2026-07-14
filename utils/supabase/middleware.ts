import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import {
  clearAuthCookiesIfTrulyDead,
  cookieListHasSupabaseAuthToken,
  getUserSafe,
} from './auth-server'

export type MiddlewareUserProfile = {
  username: string | null
  user_type: string | null
}

export type UpdateSessionResult = {
  response: NextResponse
  user: User | null
  supabase: SupabaseClient
  profile: MiddlewareUserProfile | null
}

export function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return cookieListHasSupabaseAuthToken(request.cookies.getAll())
}

function createMiddlewareSupabase(
  request: NextRequest,
  getResponse: () => NextResponse,
  setResponse: (response: NextResponse) => void
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          const supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          // Preserve cookies already queued on the previous response (e.g. multi-cookie signOut).
          getResponse().cookies.getAll().forEach((cookie) => {
            supabaseResponse.cookies.set(cookie)
          })
          supabaseResponse.cookies.set({
            name,
            value,
            ...options,
          })
          setResponse(supabaseResponse)
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          const supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          getResponse().cookies.getAll().forEach((cookie) => {
            supabaseResponse.cookies.set(cookie)
          })
          supabaseResponse.cookies.set({
            name,
            value: '',
            ...options,
          })
          setResponse(supabaseResponse)
        },
      },
    }
  )
}

export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createMiddlewareSupabase(
      request,
      () => supabaseResponse,
      (response) => {
        supabaseResponse = response
      }
    )

    const currentPath = request.nextUrl.pathname
    const isPublicAuthPath = currentPath.startsWith('/auth')
    const isPublicMarketingHome = currentPath === '/'

    // Guests with no session cookie: skip Auth network round-trip entirely.
    // After a stale token is cleared (or for true guests), Sign In must not wait on Supabase.
    if (!hasSupabaseAuthCookie(request)) {
      if (!isPublicAuthPath && !isPublicMarketingHome) {
        console.log('[auth] middleware_redirect_no_session_cookie')
        const signInUrl = new URL('/auth/signin', request.url)
        signInUrl.searchParams.set('next', currentPath)
        return {
          response: NextResponse.redirect(signInUrl),
          user: null,
          supabase,
          profile: null,
        }
      }
      return {
        response: supabaseResponse,
        user: null,
        supabase,
        profile: null,
      }
    }

    // Has session cookies: validate (retry on refresh races; do not wipe on soft null).
    const { data, meta } = await getUserSafe(supabase)
    const user = data.user

    // --- Handle Unauthenticated Users ---
    if (!user) {
        // Soft null after refresh race (or clean null): only clear cookies when session
        // storage is truly empty. If a session payload remains, allow through so the
        // browser can apply a concurrent refresh winner's Set-Cookie — do not bounce
        // to sign-in (that caused intermittent logouts).
        const cleared = await clearAuthCookiesIfTrulyDead(supabase)

        if (!cleared) {
          console.log(
            '[auth] middleware_allow_through_refresh_race path=' +
              currentPath +
              (meta?.refreshErrorSoftNull ? ' soft_null=1' : '')
          )
          return {
            response: supabaseResponse,
            user: null,
            supabase,
            profile: null,
          }
        }

        // Truly dead cookies cleared — redirect protected routes only.
        if (!isPublicAuthPath && !isPublicMarketingHome) {
            console.log('[auth] middleware_redirect_truly_dead_session')
            const signInUrl = new URL('/auth/signin', request.url)
            signInUrl.searchParams.set('next', currentPath)
            return {
              response: NextResponse.redirect(signInUrl),
              user: null,
              supabase,
              profile: null,
            }
        }
        return {
          response: supabaseResponse,
          user: null,
          supabase,
          profile: null,
        }
    }

    // --- Handle Authenticated Users (User Exists) ---

    // Optional: console log for debugging /choose-username access by authenticated users
    if (currentPath.startsWith('/choose-username')) {
        console.log('Middleware: Authenticated user accessing /choose-username. User ID:', user.id);
    }

    const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('username, user_type')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116: "No rows found"
        console.error(`Middleware: Error fetching profile for user ${user.id}:`, profileError.message);
        // Allow request to proceed to avoid blocking user for a temporary DB issue. Error is logged.
        return {
          response: supabaseResponse,
          user,
          supabase,
          profile: null,
        }
    }

    const profile: MiddlewareUserProfile = {
      username: userProfile?.username ?? null,
      user_type: userProfile?.user_type ?? null,
    }
    const hasUsername = profile.username;

    // Scenario 1: User has a username but is trying to access /choose-username again.
    if (hasUsername && currentPath.startsWith('/choose-username')) {
        console.log(`Middleware: User ${user.id} has username, redirecting from /choose-username to /dashboard.`);
        return {
          response: NextResponse.redirect(new URL('/dashboard', request.url)),
          user,
          supabase,
          profile,
        };
    }

    // Scenario 2: User does NOT have a username and is on a protected path
    // (which, due to the root matcher, is /dashboard/* if not /choose-username).
    
    if (!hasUsername && 
        !currentPath.startsWith('/choose-username') && 
        !currentPath.startsWith('/auth')) {
        // This implies they are on a /dashboard/* path without a username.
        console.log(`Middleware: User ${user.id} has no username, path: ${currentPath}. Redirecting to /choose-username.`);
        return {
          response: NextResponse.redirect(new URL('/choose-username', request.url)),
          user,
          supabase,
          profile,
        };
    }

    // All other cases for authenticated user (e.g., has username and is on dashboard), let them proceed.
    return { response: supabaseResponse, user, supabase, profile };
}
