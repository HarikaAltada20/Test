import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import countries from "i18n-iso-countries";

// Register English locale for country names
countries.registerLocale(require("i18n-iso-countries/langs/en.json"));

/**
 * Get country from IP address using ipinfo.io (free tier)
 * Returns country name (and region name for backward compatibility)
 * Saves country to database in users.registration_info JSONB if user is authenticated
 * Works on localhost by automatically detecting public IP
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  try {
    // Try ipinfo.io 
    // Falls back to ipapi.co and ip-api.com if needed
    let country = null;
    let ip = null;
    let apiUsed = "none";

    // Try ipinfo.io/json first 
    const ipinfoUrl = "https://ipinfo.io/json";
    console.log(
      "[get-location] Trying ipinfo.io (auto-detects public IP):",
      ipinfoUrl
    );

    let response = await fetch(ipinfoUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    console.log(
      "[get-location] ipinfo.io response status:",
      response.status,
      response.statusText
    );

    // If ipinfo.io works
    if (response.ok) {
      const data = await response.json();
      console.log(
        "[get-location] ipinfo.io response data:",
        JSON.stringify(data, null, 2)
      );

      // Check for errors in response
      if (data.country && !data.error) {
        // ipinfo.io returns country as code (e.g., "IN", "US")
        // Convert country code to full name using i18n-iso-countries
        const countryCode = data.country;
        const countryName =
          countries.getName(countryCode, "en") ||
          data.country_name ||
          countryCode;

        country = countryName;
        ip = data.ip || null;
        apiUsed = "ipinfo.io";
        console.log(
          "[get-location] Successfully got location from ipinfo.io:",
          "Code:",
          countryCode,
          "Country:",
          country,
          "IP:",
          ip
        );
      } else {
        console.error(
          "[get-location] ipinfo.io error:",
          data.error || "Unknown error"
        );
      }
    } else if (response.status === 429) {
      console.warn(
        "[get-location] ipinfo.io rate limited (429), trying fallback..."
      );
    } else {
      console.error(
        "[get-location] ipinfo.io failed:",
        response.status,
        response.statusText
      );
    }

    // Fallback 1: ipapi.co (also works on localhost, auto-detects IP)
    if (!country && (response.status === 429 || !response.ok)) {
      console.log(
        "[get-location] Trying fallback: ipapi.co (auto-detects IP, works on localhost)..."
      );

      const ipapiUrl = "https://ipapi.co/json/";
      const ipapiResponse = await fetch(ipapiUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (ipapiResponse.ok) {
        const ipapiData = await ipapiResponse.json();
        console.log(
          "[get-location] ipapi.co response data:",
          JSON.stringify(ipapiData, null, 2)
        );

        if (!ipapiData.error) {
          country = ipapiData.country_name || null;
          ip = ipapiData.ip || null;
          apiUsed = "ipapi.co";
          console.log(
            "[get-location] Successfully got location from ipapi.co:",
            country,
            "IP:",
            ip
          );
        } else {
          console.error(
            "[get-location] ipapi.co error:",
            ipapiData.reason || ipapiData.error
          );
        }
      } else {
        console.error(
          "[get-location] ipapi.co HTTP error:",
          ipapiResponse.status
        );
      }
    }

    // Fallback 2: ip-api.com (requires real IP, doesn't work on localhost)
    if (!country && (response.status === 429 || !response.ok)) {
      console.log(
        "[get-location] Trying final fallback: ip-api.com (requires real IP)..."
      );

      // Try to get IP from headers for fallback API
      const xff = request.headers.get("x-forwarded-for");
      const cfConnectingIp = request.headers.get("cf-connecting-ip");
      const xRealIp = request.headers.get("x-real-ip");

      let requestIp = null;
      if (xff) {
        requestIp = xff.split(",")[0].trim();
      } else if (cfConnectingIp) {
        requestIp = cfConnectingIp.trim();
      } else if (xRealIp) {
        requestIp = xRealIp.trim();
      }

      // If we have a real IP (not localhost), use ip-api.com
      if (
        requestIp &&
        requestIp !== "::1" &&
        requestIp !== "127.0.0.1" &&
        requestIp !== "0.0.0.0"
      ) {
        const ipApiUrl = `http://ip-api.com/json/${requestIp}?fields=status,message,country,countryCode`;
        console.log("[get-location] Calling ip-api.com fallback:", ipApiUrl);

        const fallbackResponse = await fetch(ipApiUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          console.log(
            "[get-location] ip-api.com response data:",
            JSON.stringify(fallbackData, null, 2)
          );

          if (fallbackData.status === "success") {
            country = fallbackData.country || null;
            ip = requestIp;
            apiUsed = "ip-api.com";
            console.log(
              "[get-location] Successfully got location from ip-api.com:",
              country,
              "IP:",
              ip
            );
          } else {
            console.error(
              "[get-location] ip-api.com failed:",
              fallbackData.message
            );
          }
        } else {
          console.error(
            "[get-location] ip-api.com HTTP error:",
            fallbackResponse.status
          );
        }
      } else {
        console.warn(
          "[get-location] No valid IP for ip-api.com fallback (localhost detected)"
        );
      }
    }

    // If still no country, return null
    if (!country) {
      console.warn("[get-location] Could not detect country from any API");
      return NextResponse.json({
        country: null,
        region: null,
        ip: null,
      });
    }

    console.log(
      "[get-location] Final result - Country:",
      country,
      "IP:",
      ip,
      "API used:",
      apiUsed
    );

    // If user is authenticated, save country to database
    // Note: Only update if IP address changed or country is new
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser && ip) {
        // First, check if IP address already exists in database
        const { data: existingUser, error: fetchError } = await supabase
          .from("users")
          .select("registration_info")
          .eq("id", authUser.id)
          .single();

        if (fetchError) {
          console.error("Error fetching existing user data:", fetchError);
          return NextResponse.json({
            country,
            region: null,
            ip,
          });
        }

        // Extract existing data from registration_info JSONB
        const existingRegistrationInfo =
          (existingUser?.registration_info as Record<string, any>) || {};
        const existingIp = existingRegistrationInfo?.ip_address || null;
        const existingCountry = existingRegistrationInfo?.country || null;

        console.log(
          "[get-location] Existing country in registration_info:",
          existingCountry
        );
        console.log("[get-location] New country from API:", country);

        // Check if country changed
        const countryChanged = country && existingCountry !== country;
        console.log("[get-location] Country changed:", countryChanged);

        // Only update if IP address changed or if we have new country data
        const ipChanged = existingIp !== ip;
        console.log(
          "[get-location] IP changed:",
          ipChanged,
          "Existing IP:",
          existingIp,
          "New IP:",
          ip
        );

        if (ipChanged || countryChanged) {
          const updateData: {
            registration_info?: Record<string, any>;
            location_updated_at: string;
          } = {
            location_updated_at: new Date().toISOString(),
          };

          // Update registration_info JSONB the country
          updateData.registration_info = {
            ...existingRegistrationInfo,
            ip_address: ip,
            country: country || existingRegistrationInfo.country, // Preserve existing country if new one is null
            last_location_update: new Date().toISOString(),
          };

          console.log(
            "[get-location] Update data:",
            JSON.stringify(updateData, null, 2)
          );

          // Update user's location in database (only in registration_info JSONB)
          const { error: updateError } = await supabase
            .from("users")
            .update(updateData)
            .eq("id", authUser.id);

          if (updateError) {
            console.error(
              "[get-location] Error updating user location in database:",
              updateError
            );
            // Don't fail the request if DB update fails
          } else {
            console.log(
              "[get-location] Successfully updated country in registration_info:",
              country
            );
          }
        } else {
          console.log(
            "[get-location] Skipping update - IP and country unchanged"
          );
        }
        // If IP address already exists and location data hasn't changed, skip update
      } else {
        console.log("[get-location] User not authenticated or IP is null");
      }
    } catch (dbError) {
      console.error("Error saving location to database:", dbError);
      // Don't fail the request if DB save fails
    }

    // Get region name for backward compatibility (not stored in DB, only returned in response)
    let region: string | null = null;
    if (country) {
      try {
        const regionsData = await import("@/data/regions-and-countries.json");
        for (const [regionName, countries] of Object.entries(
          regionsData.default
        )) {
          if (Array.isArray(countries) && countries.includes(country)) {
            region = regionName;
            break;
          }
        }
      } catch (error) {
        // Region lookup failed, but country is still available
      }
    }

    return NextResponse.json({
      country,
      region,
      ip,
    });
  } catch (error) {
    console.error("Error fetching location from IP:", error);
    return NextResponse.json(
      {
        country: null,
        region: null,
        error: "Failed to fetch location",
      },
      { status: 500 }
    );
  }
}
