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

  // Refresh session if expired
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    // If there's an error with the session, redirect to login
    response = NextResponse.redirect(new URL('/auth/signin', request.url));
    // Clear any existing auth cookies
    response.cookies.delete('sb-access-token');
    response.cookies.delete('sb-refresh-token');
    return response;
  }

  return response;
};

