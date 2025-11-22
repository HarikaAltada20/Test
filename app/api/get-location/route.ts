import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import countries from "i18n-iso-countries";

countries.registerLocale(require("i18n-iso-countries/langs/en.json"));

/**
 * Get country from IP address using ipinfo.io (free tier)
 * Returns country name (and region name for backward compatibility)
 * Saves country to database in users.registration_info JSONB if user is authenticated
 
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
          .select("registration_info")
          .eq("id", authUser.id)
          .single();

        if (fetchError) {
          console.error("Error fetching existing user data:", fetchError);
        } else if (existingUser) {
          // Extract existing data from registration_info JSONB
          const existingRegistrationInfo =
            (existingUser?.registration_info as Record<string, any>) || {};
          const existingIp = existingRegistrationInfo?.ip_address || null;
          const existingCountry = existingRegistrationInfo?.country || null;

          console.log(
            "[get-location] Existing country in registration_info:",
            existingCountry,
            "Existing IP in registration_info:",
            existingIp,
            "User ID:",
            authUser.id
          );

          // Case 2: If country already exists and is valid, just use it - don't call any API
          if (existingCountry && existingCountry.trim() !== "") {
            console.log(
              "[get-location] Country already exists in registration_info, using it:",
              existingCountry
            );
            country = existingCountry;
            ip = existingIp; // Use stored IP for response
          }
          // Case 1: If country is NOT stored but IP exists, fetch country from stored IP ONCE
          else if (existingIp) {
            console.log(
              "[get-location] No valid country in registration_info, but IP exists. Getting country from stored IP:",
              existingIp
            );

            // Try to get country from stored IP using the same APIs
            let countryFromStoredIp = null;

            // Try ipinfo.io first
            try {
              const ipinfoUrl = `https://ipinfo.io/${existingIp}/json`;
              const storedIpResponse = await fetch(ipinfoUrl, {
                method: "GET",
                headers: { Accept: "application/json" },
              });

              if (storedIpResponse.ok) {
                const storedIpData = await storedIpResponse.json();
                if (storedIpData.country && !storedIpData.error) {
                  const countryCode = storedIpData.country;
                  countryFromStoredIp =
                    countries.getName(countryCode, "en") ||
                    storedIpData.country_name ||
                    countryCode;
                  apiUsed = "ipinfo.io";
                  console.log(
                    "[get-location] Got country from stored IP via ipinfo.io:",
                    countryFromStoredIp
                  );
                }
              }
            } catch (error) {
              console.error(
                "[get-location] Error getting country from stored IP via ipinfo.io:",
                error
              );
            }

            // Fallback to ipapi.co
            if (!countryFromStoredIp) {
              try {
                const ipapiUrl = `https://ipapi.co/${existingIp}/json/`;
                const ipapiResponse = await fetch(ipapiUrl, {
                  method: "GET",
                  headers: { Accept: "application/json" },
                });

                if (ipapiResponse.ok) {
                  const ipapiData = await ipapiResponse.json();
                  if (!ipapiData.error) {
                    countryFromStoredIp = ipapiData.country_name || null;
                    apiUsed = "ipapi.co";
                    console.log(
                      "[get-location] Got country from stored IP via ipapi.co:",
                      countryFromStoredIp
                    );
                  }
                }
              } catch (error) {
                console.error(
                  "[get-location] Error getting country from stored IP via ipapi.co:",
                  error
                );
              }
            }

            // Fallback to ip-api.com
            if (!countryFromStoredIp) {
              try {
                const ipApiUrl = `http://ip-api.com/json/${existingIp}?fields=status,message,country,countryCode`;
                const fallbackResponse = await fetch(ipApiUrl, {
                  method: "GET",
                  headers: { Accept: "application/json" },
                });

                if (fallbackResponse.ok) {
                  const fallbackData = await fallbackResponse.json();
                  if (fallbackData.status === "success") {
                    countryFromStoredIp = fallbackData.country || null;
                    apiUsed = "ip-api.com";
                    console.log(
                      "[get-location] Got country from stored IP via ip-api.com:",
                      countryFromStoredIp
                    );
                  }
                }
              } catch (error) {
                console.error(
                  "[get-location] Error getting country from stored IP via ip-api.com:",
                  error
                );
              }
            }

            // If we got country from stored IP, update ONLY the country field (never update IP)
            if (countryFromStoredIp) {
              const updateData: {
                registration_info?: Record<string, any>;
              } = {
                registration_info: {
                  ...existingRegistrationInfo,
                  // Keep existing IP - NEVER change it
                  ip_address: existingIp,
                  // Only update country ONCE
                  country: countryFromStoredIp,
                },
              };

              const { error: updateError } = await supabase
                .from("users")
                .update(updateData)
                .eq("id", authUser.id);

              if (updateError) {
                console.error(
                  "[get-location] Error patching country in registration_info:",
                  updateError
                );
              } else {
                console.log(
                  "[get-location] Successfully patched country in registration_info:",
                  countryFromStoredIp
                );
              }
              country = countryFromStoredIp;
              ip = existingIp; // Use stored IP for response
            } else {
              // If we couldn't get country from stored IP, don't update registration_info
              // Just return null for country, but keep using stored IP
              console.warn(
                "[get-location] Could not get country from stored IP. Registration info will NOT be updated."
              );
              ip = existingIp; // Still use stored IP for response
            }
          }
          // Edge case: No IP and no country in registration_info
          // This shouldn't happen if registration_info was set at registration
          // But if it does, we don't update it - registration info should remain fixed
          else {
            console.warn(
              "[get-location] No IP or country in registration_info. Registration info will NOT be updated."
            );
          }
        }
      } else {
        console.log(
          "[get-location] User not authenticated, fetching current location"
        );

        // Only for unauthenticated users, fetch current IP/country
        // This is used during registration before user profile is created
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
      apiUsed
    );

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
      { status: 500 }
    );
  }
}
