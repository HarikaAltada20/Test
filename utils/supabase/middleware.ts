import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        supabaseResponse.cookies.set(name, value, options as CookieOptions)
                    })
                },
            },
        }
    )

    // Do not run code between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    // IMPORTANT: DO NOT REMOVE auth.getUser()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const currentPath = request.nextUrl.pathname;

    if (request.nextUrl.pathname.startsWith('/choose-username')) {
        console.log('Middleware: Accessing /choose-username. User from getUser():', user ? user.id : 'No user');
    }

    if (user) {
        // User is authenticated

        // Prevent logged-in users from accessing auth pages
        if (
            currentPath.startsWith('/auth/signin') ||
            currentPath.startsWith('/auth/signup') ||
            currentPath.startsWith('/auth/forgot-password') || // Add other auth pages as needed
            currentPath.startsWith('/verify-otp') // OTP page is usually for pre-auth or immediately post-signup
        ) {
            console.log(`Middleware: Authenticated user ${user.id} attempting to access auth page ${currentPath}. Redirecting to /dashboard.`);
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }

        const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('username')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError && profileError.code !== 'PGRST116') {
            console.error(`Middleware: Error fetching profile for user ${user.id}:`, profileError.message);
        } else {
            const hasUsername = userProfile && userProfile.username;

            if (hasUsername && currentPath.startsWith('/choose-username')) {
                console.log(`Middleware: User ${user.id} has username, redirecting from /choose-username to /dashboard.`);
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }

            if (!hasUsername && !currentPath.startsWith('/choose-username') && !currentPath.startsWith('/api/auth')) {
                 // Also ensure they are not trying to access other auth flow pages if they don't have a username yet, beyond /choose-username
                if (currentPath.startsWith('/auth/') && !currentPath.startsWith('/auth/callback')) { // Allow callback
                     console.log(`Middleware: User ${user.id} (no username) trying to access ${currentPath}. Redirecting to /choose-username.`);
                     return NextResponse.redirect(new URL('/choose-username', request.url));
                }
                console.log(`Middleware: User ${user.id} has no username, path: ${currentPath}. Redirecting to /choose-username.`);
                return NextResponse.redirect(new URL('/choose-username', request.url));
            }
        }
    } else {
        // Unauthenticated user handling
        // If accessing a route that requires auth (and is not /choose-username for direct nav)
        // and is not an explicit auth flow page, redirect to signin.
        const isAuthFlowPage =
            currentPath.startsWith('/auth/signin') ||
            currentPath.startsWith('/auth/signup') ||
            currentPath.startsWith('/auth/callback') || // For Supabase email/OAuth redirects
            currentPath.startsWith('/auth/forgot-password') ||
            currentPath.startsWith('/auth/reset-password') || // If you have this
            currentPath.startsWith('/verify-otp');

        const isChooseUsernamePage = currentPath.startsWith('/choose-username');
        const isAllowedPublicApi = currentPath.startsWith('/api/auth'); // Or more specific public API paths

        const isProtectedRoute = config.matcher.some((pattern: string) => {
            const regexPattern = pattern
                .replace(/\/:[^/]+/g, '/[^/]+') 
                .replace(/\/\*$/, '/.*');        
            return new RegExp(`^${regexPattern}$`).test(currentPath);
        });

        if (isProtectedRoute && !isAuthFlowPage && !isAllowedPublicApi) {
            console.log(`Middleware: No user, protected path by matcher: ${currentPath}. Redirecting to /auth/signin.`);
            return NextResponse.redirect(new URL('/auth/signin', request.url));
        }
    }

    // IMPORTANT: You *must* return the supabaseResponse object as it is if not redirecting earlier.
    // If you're creating a new response object with NextResponse.next() make sure to:
    // 1. Pass the request in it, like so:
    //    const myNewResponse = NextResponse.next({ request })
    // 2. Copy over the cookies, like so:
    //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
    // 3. Change the myNewResponse object to fit your needs, but avoid changing
    //    the cookies!
    // 4. Finally:
    //    return myNewResponse
    // If this is not done, you may be causing the browser and server to go out
    // of sync and terminate the user's session prematurely!

    return supabaseResponse
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/choose-username',
    // Add other routes that strictly require authentication to be matched by middleware for processing
    // Public pages like homepage, /about, /pricing usually don't need to be in matcher unless specific checks are done
  ],
}