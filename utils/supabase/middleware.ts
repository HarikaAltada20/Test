import { createServerClient } from '@supabase/ssr'
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
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
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

    if (request.nextUrl.pathname.startsWith('/choose-username')) {
        console.log('Middleware: Accessing /choose-username. User from getUser():', user ? user.id : 'No user');
    }

    if (user) {
        // User is authenticated
        const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('username')
            .eq('id', user.id)
            .maybeSingle(); // Changed from .single() to .maybeSingle()

        if (profileError && profileError.code !== 'PGRST116') { // PGRST116 is "No rows found", which maybeSingle handles by returning null data
            console.error(`Middleware: Error fetching profile for user ${user.id}:`, profileError.message);
            // Allow request to proceed to avoid blocking user for DB hiccup. Error is logged.
        } else {
            // Profile fetched (or userProfile is null if no row was found)
            const hasUsername = userProfile && userProfile.username;
            const currentPath = request.nextUrl.pathname;

            if (hasUsername && currentPath.startsWith('/choose-username')) {
                // User has a username but is trying to access /choose-username again.
                // Redirect them to the dashboard.
                console.log(`Middleware: User ${user.id} has username, redirecting from /choose-username to /dashboard.`);
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }

            if (!hasUsername && !currentPath.startsWith('/choose-username') && !currentPath.startsWith('/api/auth')) {
                // User does NOT have a username and is trying to access a protected route (not /choose-username or /api/auth)
                // The main middleware.ts config.matcher defines which routes are protected.
                console.log(`Middleware: User ${user.id} has no username, path: ${currentPath}. Redirecting to /choose-username.`);
                return NextResponse.redirect(new URL('/choose-username', request.url));
            }
        }
    } else if (
        // Unauthenticated user handling (redirect to signin)
        !request.nextUrl.pathname.startsWith('/auth/signin') && // Allow access to signin itself
        !request.nextUrl.pathname.startsWith('/auth/signup') && // Allow access to signup
        !request.nextUrl.pathname.startsWith('/auth/callback') && // Allow Supabase callback
        !request.nextUrl.pathname.startsWith('/verify-otp') && // Allow access to OTP page
        !request.nextUrl.pathname.startsWith('/choose-username') && // Allow unauth access to choose-username IF direct nav (OTP flow sets session first)
        !request.nextUrl.pathname.startsWith('/auth') // Broadly allow API routes (adjust if too permissive)
    ) {
        // no user, redirect to signin page
        console.log(`Middleware: No user, path: ${request.nextUrl.pathname}. Redirecting to /auth/signin.`);
        return NextResponse.redirect(new URL('/auth/signin', request.url));
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
    '/choose-username', // Add this if it's a protected route
    // other protected routes
  ],
}