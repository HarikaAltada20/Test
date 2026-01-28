import { NextRequest, NextResponse } from "next/server";
import {
  hasRapidApiKeys,
  rapidApiHost,
  rapidApiRequest,
} from "@/lib/twitter/rapidApiClient";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasRapidApiKeys) {
    // Log environment check for debugging (server-side only)
    const envCheck = {
      TWITTER_RAPIDAPI_KEYS: process.env.TWITTER_RAPIDAPI_KEYS ? "set" : "not set",
      RAPIDAPI_KEYS: process.env.RAPIDAPI_KEYS ? "set" : "not set",
      TWITTER_RAPIDAPI_KEY: process.env.TWITTER_RAPIDAPI_KEY ? "set" : "not set",
      RAPIDAPI_KEY: process.env.RAPIDAPI_KEY ? "set" : "not set",
      NODE_ENV: process.env.NODE_ENV || "not set",
    };
    
    console.error(
      "[fetch-profile] Twitter RapidAPI keys not configured. Environment check:",
      envCheck
    );
    
    // Generic user-facing error (no RapidAPI mention)
    return NextResponse.json(
      { 
        error: "Twitter API service is temporarily unavailable",
        details: "Please try again later or contact support if the issue persists."
      },
      { status: 500 }
    );
  }

  let screenname: string | undefined;
  
  try {
    const body = await request.json();
    screenname = (body?.screenname || "").trim();

    if (!screenname) {
      return NextResponse.json(
        { error: "Missing screenname" },
        { status: 400 }
      );
    }

    // Validate screenname format (Twitter usernames are alphanumeric, underscore, max 15 chars)
    // Remove @ if present
    screenname = screenname.replace(/^@/, '');
    
    if (!/^[a-zA-Z0-9_]{1,15}$/.test(screenname)) {
      return NextResponse.json(
        { error: "Invalid Twitter username format" },
        { status: 400 }
      );
    }

    const response = await rapidApiRequest({
      method: "GET",
      url: `https://${rapidApiHost}/screenname.php`,
      params: { screenname },
    });

    const data = response?.data;

    // Check if response data exists
    if (!data) {
      console.error("RapidAPI returned empty response data", {
        status: response?.status,
        statusText: response?.statusText,
        headers: response?.headers,
      });
      return NextResponse.json(
        { error: "Unable to fetch Twitter profile. Please try again." },
        { status: 502 }
      );
    }

    // Check if profile is active
    if (data.status !== "active") {
      return NextResponse.json(
        { 
          error: "Unable to fetch active X profile",
          details: data.status ? `Profile status: ${data.status}` : "Profile not found or inactive"
        },
        { status: 404 }
      );
    }

    // Return full data so client can pick what it needs
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    // Enhanced error logging (server-side only - includes RapidAPI details)
    console.error("Error fetching Twitter profile:", {
      message: error?.message,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      code: error?.code,
      stack: error?.stack,
      screenname: screenname || "unknown",
    });

    // Handle axios-specific errors
    if (error?.response) {
      // API responded with error status
      const status = error.response.status;
      const errorData = error.response.data;
      
      if (status === 403 || status === 401) {
        // Check if it's a subscription error
        const errorMessage = errorData?.message || "";
        const isSubscriptionError = 
          errorMessage.toLowerCase().includes("not subscribed") ||
          errorMessage.toLowerCase().includes("subscription") ||
          errorMessage.toLowerCase().includes("not authorized to access") ||
          errorMessage.toLowerCase().includes("you are not subscribed");
        
        if (isSubscriptionError) {
          // Generic user-facing error (no RapidAPI mention)
          return NextResponse.json(
            { 
              error: "Twitter API service unavailable",
              details: "The Twitter API service is currently unavailable. Please try again later."
            },
            { status: 403 }
          );
        }
        
        // Regular authentication/authorization error
        return NextResponse.json(
          { 
            error: "Unable to authenticate with Twitter API",
            details: "Please try again later or contact support if the issue persists."
          },
          { status: 403 }
        );
      }
      
      if (status === 429) {
        return NextResponse.json(
          { 
            error: "Rate limit exceeded. Please try again later.",
            details: "Too many requests. Please wait a few minutes before trying again."
          },
          { status: 429 }
        );
      }

      // Generic error for other status codes
      return NextResponse.json(
        { 
          error: "Unable to fetch Twitter profile",
          details: "An error occurred while fetching the profile. Please try again later."
        },
        { status: status >= 400 && status < 600 ? status : 500 }
      );
    }

    // Handle network errors
    if (error?.code === "ECONNREFUSED" || error?.code === "ENOTFOUND") {
      return NextResponse.json(
        { 
          error: "Unable to connect to Twitter API",
          details: "The Twitter API service is temporarily unavailable. Please try again later."
        },
        { status: 503 }
      );
    }

    // Generic error fallback
    return NextResponse.json(
      { 
        error: "Failed to fetch Twitter profile",
        details: "An unexpected error occurred. Please try again later."
      },
      { status: 500 }
    );
  }
}
