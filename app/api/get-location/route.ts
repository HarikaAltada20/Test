import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import countries from "i18n-iso-countries";
import {
  getGeoDataForIp,
  getCountryFromRegistrationInfo,
  buildGeoDataColumn,
  type GeoData,
} from "@/lib/geo-ip";

countries.registerLocale(require("i18n-iso-countries/langs/en.json"));

/**
 * Get country from IP; uses registration_info.geo_data when present (single source of truth).
 * Saves geo_data + country to users.registration_info when missing.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  try {
    let country = null;
    let ip = null;
    let apiUsed = "none";

    // If user is authenticated, check registration_info FIRST before making any API calls
    // Registration info stores IP at time of registration - we should NOT update it
    // Only patch country if missing, using the stored IP
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        // First, check existing registration_info
        const { data: existingUser, error: fetchError } = await supabase
          .from("users")
          .select("registration_info, geo_data, login_history")
          .eq("id", authUser.id)
          .single();

        if (fetchError) {
          console.error("Error fetching existing user data:", fetchError);
        } else if (existingUser) {
          const existingRegistrationInfo =
            (existingUser?.registration_info as Record<string, any>) || {};
          const loginHistory = (existingUser?.login_history as Array<{ ip_address?: string }>) || [];
          const existingIp =
            existingRegistrationInfo?.ip ??
            existingRegistrationInfo?.ip_address ??
            (loginHistory[0]?.ip_address ?? null) ??
            null;
          const existingCountry = getCountryFromRegistrationInfo(
            existingRegistrationInfo,
          );
          const existingGeo = existingRegistrationInfo?.geo_data as
            | GeoData
            | undefined;

          console.log(
            "[get-location] registration_info: country:",
            existingCountry,
            "ip:",
            existingIp,
            "has geo_data:",
            !!existingGeo,
            "userId:",
            authUser.id,
          );

          // Already have valid country (from geo_data or legacy field) — no API call
          if (existingCountry && existingCountry.trim() !== "") {
            country = existingCountry;
            ip = existingIp;
          } else if (existingIp) {
            console.log(
              "[get-location] No valid country in registration_info, but IP exists. Getting country from stored IP:",
              existingIp,
            );

            const isLocalhost =
              existingIp === "::1" ||
              existingIp === "127.0.0.1" ||
              existingIp === "0.0.0.0";

            let ipToLookup = existingIp;
            if (isLocalhost) {
              const xff = request.headers.get("x-forwarded-for");
              const reqIp = xff ? xff.split(",")[0].trim() : null;
              const reqIsLocal =
                !reqIp || ["::1", "127.0.0.1", "0.0.0.0"].includes(reqIp);
              ipToLookup = reqIsLocal ? null : reqIp; // null => ipinfo.io/json uses current IP
              console.log(
                "[get-location] Stored IP is localhost; fetching geo for request IP:",
                ipToLookup || "auto",
              );
            }
            const geo = await getGeoDataForIp(ipToLookup);
            if (geo) {
              apiUsed = "geo-ip";
              country = geo.country;
              ip = existingIp;
              const {
                geo_data: _removed,
                ip: _ipRemoved,
                ...rest
              } = existingRegistrationInfo || {};
              const registration_info = {
                ...rest,
                ip_address: existingIp,
                country: geo.country,
              };
              const geoDataColumn = buildGeoDataColumn(existingIp, geo);
              const { error: updateError } = await supabase
                .from("users")
                .update({
                  updated_at: new Date().toISOString(),
                  registration_info,
                  ...(geoDataColumn && { geo_data: geoDataColumn }),
                })
                  .eq("id", authUser.id);
                if (updateError) {
                  console.error(
                  "[get-location] Error patching user:",
                  updateError,
                  );
                } else {
                  console.log(
                  "[get-location] Patched geo_data column (geo not stored in registration_info)",
                );
              }
            } else {
              ip = existingIp;
                console.warn(
                "[get-location] Could not get geo from IP. Registration info will NOT be updated.",
                );
            }
          }
          // Edge case: No IP and no country in registration_info
          // This shouldn't happen if registration_info was set at registration
          // But if it does, we don't update it - registration info should remain fixed
          else {
            console.warn(
              "[get-location] No IP or country in registration_info. Registration info will NOT be updated.",
            );
          }
        }
      } else {
        console.log(
          "[get-location] User not authenticated, fetching current location",
        );

        // Only for unauthenticated users, fetch current IP/country
        // This is used during registration before user profile is created
        const ipinfoUrl = "https://ipinfo.io/json";
        console.log(
          "[get-location] Trying ipinfo.io (auto-detects public IP):",
          ipinfoUrl,
        );

        let response = await fetch(ipinfoUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.country && !data.error) {
            const countryCode = data.country;
            const countryName =
              countries.getName(countryCode, "en") ||
              data.country_name ||
              countryCode;
            country = countryName;
            ip = data.ip || null;
            apiUsed = "ipinfo.io";
          }
        }

        // Fallback 1: ipapi.co
        if (!country) {
          const ipapiUrl = "https://ipapi.co/json/";
          const ipapiResponse = await fetch(ipapiUrl, {
            method: "GET",
            headers: { Accept: "application/json" },
          });

          if (ipapiResponse.ok) {
            const ipapiData = await ipapiResponse.json();
            if (!ipapiData.error) {
              country = ipapiData.country_name || null;
              ip = ipapiData.ip || null;
              apiUsed = "ipapi.co";
            }
          }
        }

        // Fallback 2: ip-api.com
        if (!country) {
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

          if (
            requestIp &&
            requestIp !== "::1" &&
            requestIp !== "127.0.0.1" &&
            requestIp !== "0.0.0.0"
          ) {
            const ipApiUrl = `http://ip-api.com/json/${requestIp}?fields=status,message,country,countryCode`;
            const fallbackResponse = await fetch(ipApiUrl, {
              method: "GET",
              headers: { Accept: "application/json" },
            });

            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              if (fallbackData.status === "success") {
                country = fallbackData.country || null;
                ip = requestIp;
                apiUsed = "ip-api.com";
              }
            }
          }
        }
      }
    } catch (dbError) {
      console.error("Error handling registration_info:", dbError);
      // Don't fail the request if DB operation fails
    }

    console.log(
      "[get-location] Final result - Country:",
      country,
      "IP:",
      ip,
      "API used:",
      apiUsed,
    );

    let region: string | null = null;
    if (country) {
      try {
        const regionsData = await import("@/data/regions-and-countries.json");
        for (const [regionName, countries] of Object.entries(
          regionsData.default,
        )) {
          if (Array.isArray(countries) && countries.includes(country)) {
            region = regionName;
            break;
          }
        }
      } catch (error) {}
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
      { status: 500 },
    );
  }
}
