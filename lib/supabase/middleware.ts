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
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          // If the cookie is removed, update the response
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  // Verify user authentication with server
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    // Only redirect to login if we're on a protected route
    const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard') || 
                           request.nextUrl.pathname.startsWith('/opportunities');
    
    if (isProtectedRoute) {
      response = NextResponse.redirect(new URL('/auth/signin', request.url));
      // Clear any existing auth cookies
      response.cookies.delete('sb-access-token');
      response.cookies.delete('sb-refresh-token');
    }
    return response;
  }

  return response;
};

