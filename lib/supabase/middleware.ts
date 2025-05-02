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
    console.error("Supabase auth error in middleware:", error.message, error.code, error.status);
  }

  // If the user is not authenticated and the request is for a protected route, redirect to sign-in.
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    console.log("Middleware: User is not authenticated and the request is for a protected route, redirecting to sign-in.");
    const redirectUrl = new URL('/auth/signin', request.url);
    console.log(`Redirecting unauthenticated user from ${request.nextUrl.pathname} to ${redirectUrl.pathname}`);
    // No need to manually delete cookies here; Supabase handles invalid sessions.
    // If the session was truly invalid, Supabase's getUser/refresh attempt would likely have cleared them already via the 'remove' cookie handler.
    // If it was just a temporary issue, clearing them manually could log the user out unnecessarily.
    return NextResponse.redirect(redirectUrl);
  }

  // If we reach here, the user is either authenticated OR the route is not protected.
  // The response object has potentially been updated by the Supabase client's cookie handlers (set/remove).
  return response;
};

