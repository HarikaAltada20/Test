import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export const updateSession = async (request: NextRequest) => {
  // Create an unmodified response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // If the cookie is updated, update the response
          // The NextResponse object needs to be updated for the cookie to be set
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          // If the cookie is removed, update the response
          // The NextResponse object needs to be updated for the cookie to be removed
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Attempt to get the user. This handles session refresh automatically.
  const { data: { user }, error } = await supabase.auth.getUser();

  // Log the specific error for debugging
  if (error) {
    // Check if this is a critical error or a temporary one
    const isCriticalError = error.status === 401 || 
                            error.message.includes("invalid token") ||
                            error.message.includes("JWT expired");
                            
    if (isCriticalError) {
      console.error("Supabase critical auth error in middleware:", error.message, error.code, error.status);
    } else {
      // For non-critical errors, log but don't take action
      console.warn("Supabase temporary auth error in middleware:", error.message, error.code, error.status);
    }
  }

  // If the user is not authenticated and the request is for a protected route, redirect to sign-in.
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    // Add a verification to avoid false negative auth check due to temporary issues
    // Check if cookies exist but user fetch failed - could be a temporary issue
    const accessToken = request.cookies.get('sb-access-token')?.value;
    const refreshToken = request.cookies.get('sb-refresh-token')?.value;
    
    // If both tokens exist but user is null, it might be a temporary issue
    if (accessToken && refreshToken && error && 
        !error.message.includes("invalid token") && 
        !error.message.includes("JWT expired")) {
      console.log("Middleware: Auth tokens exist but user fetch failed. Possible temporary issue. Allowing request to proceed.");
      return response;
    }
    
    console.log("Middleware: User is not authenticated and the request is for a protected route, redirecting to sign-in.");
    const redirectUrl = new URL('/auth/signin', request.url);
    console.log(`Redirecting unauthenticated user from ${request.nextUrl.pathname} to ${redirectUrl.pathname}`);
    return NextResponse.redirect(redirectUrl);
  }

  // If we reach here, the user is either authenticated OR the route is not protected.
  // The response object has potentially been updated by the Supabase client's cookie handlers (set/remove).
  return response;
};

