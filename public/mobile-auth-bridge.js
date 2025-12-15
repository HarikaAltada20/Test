/**
 * Mobile Auth Bridge - Handles session injection from Flutter app
 * This script should be included in the website to enable native authentication
 */

(function () {
  "use strict";

  // Wait for DOM to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    // Listen for session injection events from Flutter
    window.addEventListener("supabaseSessionInjected", handleSessionInjection);
    window.addEventListener("retrySupabaseInjection", handleRetryInjection);

    // Also check for session in localStorage (fallback)
    checkForStoredSession();
  }

  /**
   * Handle session injection event
   */
  function handleSessionInjection(event) {
    console.log("✅ Supabase session injection event received", event.detail);
    // The session should already be set by the injected script
    // Just reload the page to reflect the new authentication state
    if (event.detail?.authenticated) {
      window.location.reload();
    }
  }

  /**
   * Retry session injection if Supabase client becomes available
   */
  function handleRetryInjection() {
    // This will be handled by the Flutter injection script
    console.log("🔄 Retrying Supabase session injection...");
  }

  /**
   * Check for stored session in localStorage (fallback method)
   */
  function checkForStoredSession() {
    try {
      const storedSession = localStorage.getItem("supabase.auth.token");
      if (storedSession) {
        console.log("📦 Found stored Supabase session");
      }
    } catch (e) {
      console.warn("⚠️ Could not check localStorage:", e);
    }
  }

  /**
   * Expose a global function to set Supabase session
   * This can be called from Flutter's JavaScript injection
   */
  window.setSupabaseSessionFromMobile = function (accessToken, refreshToken) {
    try {
      // Try to find Supabase client in various ways
      let supabaseClient = null;

      // Method 1: Check if Supabase is available globally
      if (typeof window.supabase !== "undefined") {
        supabaseClient = window.supabase;
      }

      // Method 2: Check if it's in a module (Next.js might have it)
      if (!supabaseClient && typeof window.__NEXT_DATA__ !== "undefined") {
        // Try to access from Next.js context
        console.log("🔍 Checking Next.js context for Supabase client");
      }

      if (supabaseClient && supabaseClient.auth) {
        supabaseClient.auth
          .setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          .then(async () => {
            console.log("✅ Supabase session set successfully from mobile");
            window.dispatchEvent(new CustomEvent("mobileAuthSuccess"));

            // Check user profile to determine redirect path
            try {
              const {
                data: { user },
              } = await supabaseClient.auth.getUser();

              if (user) {
                // Check if user has a username
                const { data: profile } = await supabaseClient
                  .from("users")
                  .select("username")
                  .eq("id", user.id)
                  .single();

                // Navigate to appropriate page
                if (!profile || !profile.username) {
                  console.log(
                    "📝 User needs to complete profile, redirecting to /choose-username"
                  );
                  window.location.href = "/choose-username";
                } else {
                  console.log(
                    "✅ User profile complete, redirecting to /dashboard"
                  );
                  window.location.href = "/dashboard";
                }
              } else {
                // Fallback: just reload
                window.location.reload();
              }
            } catch (profileError) {
              console.warn(
                "⚠️ Could not check user profile, redirecting to dashboard:",
                profileError
              );
              // Fallback: navigate to dashboard
              window.location.href = "/dashboard";
            }
          })
          .catch((error) => {
            console.error("❌ Failed to set Supabase session:", error);
            window.dispatchEvent(
              new CustomEvent("mobileAuthError", { detail: error })
            );
          });
      } else {
        console.warn(
          "⚠️ Supabase client not found. Session will be set via cookies."
        );
        // Wait a bit for the global client to be created
        let attempts = 0;
        const maxAttempts = 10;
        const checkInterval = setInterval(() => {
          attempts++;
          if (typeof window.supabase !== "undefined" && window.supabase.auth) {
            clearInterval(checkInterval);
            console.log("✅ Found Supabase client, setting session...");
            window.supabase.auth
              .setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              })
              .then(async () => {
                console.log("✅ Supabase session set successfully from mobile");
                window.dispatchEvent(new CustomEvent("mobileAuthSuccess"));

                // Check user profile to determine redirect path
                try {
                  const {
                    data: { user },
                  } = await window.supabase.auth.getUser();

                  if (user) {
                    // Check if user has a username
                    const { data: profile } = await window.supabase
                      .from("users")
                      .select("username")
                      .eq("id", user.id)
                      .single();

                    // Navigate to appropriate page
                    if (!profile || !profile.username) {
                      console.log(
                        "📝 User needs to complete profile, redirecting to /choose-username"
                      );
                      window.location.href = "/choose-username";
                    } else {
                      console.log(
                        "✅ User profile complete, redirecting to /dashboard"
                      );
                      window.location.href = "/dashboard";
                    }
                  } else {
                    // Fallback: just reload
                    window.location.reload();
                  }
                } catch (profileError) {
                  console.warn(
                    "⚠️ Could not check user profile, redirecting to dashboard:",
                    profileError
                  );
                  // Fallback: navigate to dashboard
                  window.location.href = "/dashboard";
                }
              })
              .catch((error) => {
                console.error("❌ Failed to set session via client:", error);
                // Fallback to cookies
                setSupabaseCookies(accessToken, refreshToken);
              });
          } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            console.warn(
              "⚠️ Supabase client not available after waiting, using cookies"
            );
            // Fallback: Set cookies directly (Supabase SSR will pick them up)
            setSupabaseCookies(accessToken, refreshToken);
          }
        }, 100);
      }
    } catch (error) {
      console.error("❌ Error setting Supabase session from mobile:", error);
    }
  };

  /**
   * Set Supabase authentication cookies directly
   * This is a fallback method when the Supabase client is not available
   * Uses the correct Supabase SSR cookie format
   */
  function setSupabaseCookies(accessToken, refreshToken) {
    try {
      const domain = window.location.hostname;
      const expires = new Date();
      expires.setTime(expires.getTime() + 60 * 60 * 24 * 365 * 1000); // 1 year (Supabase default)

      // Extract project ref from Supabase URL if available
      const supabaseUrl = window.location.origin.includes("localhost")
        ? "http://localhost:3000"
        : window.location.origin;

      // Try to get project ref from environment or URL
      let projectRef = "rjprmbjqetxkramwbrqo"; // Default from your Supabase URL

      // Supabase SSR uses this cookie format: sb-<project-ref>-auth-token
      // The value is a JSON string with access_token and refresh_token
      const sessionData = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: Math.floor(expires.getTime() / 1000),
        expires_in: 3600,
        token_type: "bearer",
        user: null, // Will be populated by Supabase
      };

      // Set the main auth token cookie (Supabase SSR format)
      const cookieName = `sb-${projectRef}-auth-token`;
      const cookieValue = encodeURIComponent(JSON.stringify(sessionData));
      document.cookie = `${cookieName}=${cookieValue}; domain=${domain}; path=/; expires=${expires.toUTCString()}; SameSite=Lax; Secure`;

      // Also set individual cookies as fallback
      document.cookie = `sb-access-token=${accessToken}; domain=${domain}; path=/; expires=${expires.toUTCString()}; SameSite=Lax; Secure`;

      if (refreshToken) {
        document.cookie = `sb-refresh-token=${refreshToken}; domain=${domain}; path=/; expires=${expires.toUTCString()}; SameSite=Lax; Secure`;
      }

      console.log("✅ Supabase cookies set directly with SSR format");
      console.log(`📝 Cookie name: ${cookieName}`);

      // Navigate to dashboard to let Next.js middleware pick up the cookies
      // The middleware will check if user has username and redirect accordingly
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 100);
    } catch (error) {
      console.error("❌ Error setting cookies:", error);
    }
  }
})();
