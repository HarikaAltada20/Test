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
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                    supabaseResponse = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    supabaseResponse.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                    supabaseResponse = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    supabaseResponse.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()
    const currentPath = request.nextUrl.pathname;

    // --- Handle Unauthenticated Users ---
    if (!user) {
        // If /verify-otp is now under /auth (e.g., /auth/verify-otp), this single check is sufficient.
        // /choose-username is removed as it should typically be accessed by authenticated users.
        const isPublicAuthPath = currentPath.startsWith('/auth')
        

        // The root middleware.ts matcher ensures this function only runs on
        // /dashboard/* or /choose-username.
        // If an unauthenticated user is trying to access one of these,
        // and it's NOT one of the explicitly allowed public auth paths, redirect to signin.
        if (!isPublicAuthPath) {
                    console.log(`Middleware: No user, path: ${currentPath}. Redirecting to /auth/signin.`);
        return NextResponse.redirect(new URL('/auth/signin', request.url));
        }
        // If it's an allowed public auth path (or /choose-username for direct nav), let unauthenticated user proceed.
        return supabaseResponse;
    }

    // --- Handle Authenticated Users (User Exists) ---

    // Optional: console log for debugging /choose-username access by authenticated users
    if (currentPath.startsWith('/choose-username')) {
        console.log('Middleware: Authenticated user accessing /choose-username. User ID:', user.id);
    }

    const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116: "No rows found"
        console.error(`Middleware: Error fetching profile for user ${user.id}:`, profileError.message);
        // Allow request to proceed to avoid blocking user for a temporary DB issue. Error is logged.
        return supabaseResponse;
    }

    const hasUsername = userProfile?.username;

    // Scenario 1: User has a username but is trying to access /choose-username again.
    if (hasUsername && currentPath.startsWith('/choose-username')) {
        console.log(`Middleware: User ${user.id} has username, redirecting from /choose-username to /dashboard.`);
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Scenario 2: User does NOT have a username and is on a protected path
    // (which, due to the root matcher, is /dashboard/* if not /choose-username).
    
    if (!hasUsername && 
        !currentPath.startsWith('/choose-username') && 
        !currentPath.startsWith('/auth')) {
        // This implies they are on a /dashboard/* path without a username.
        console.log(`Middleware: User ${user.id} has no username, path: ${currentPath}. Redirecting to /choose-username.`);
        return NextResponse.redirect(new URL('/choose-username', request.url));
    }

    // All other cases for authenticated user (e.g., has username and is on dashboard), let them proceed.
    return supabaseResponse
}
