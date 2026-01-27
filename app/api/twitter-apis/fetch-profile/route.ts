import { NextRequest, NextResponse } from "next/server";
import {
  hasRapidApiKeys,
  rapidApiHost,
  rapidApiRequest,
} from "@/lib/twitter/rapidApiClient";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasRapidApiKeys) {
    // Log environment check for debugging
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
    
    return NextResponse.json(
      { 
        error: "Twitter RapidAPI keys are not configured on the server",
        details: "Please configure TWITTER_RAPIDAPI_KEYS, RAPIDAPI_KEYS, TWITTER_RAPIDAPI_KEY, or RAPIDAPI_KEY environment variable in your deployment platform (Vercel, etc.)",
        environment: process.env.NODE_ENV || "unknown"
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
        { error: "Empty response from Twitter API" },
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
    // Enhanced error logging
    console.error("Error fetching Twitter profile via RapidAPI:", {
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
          return NextResponse.json(
            { 
              error: "RapidAPI subscription required",
              details: "The API key is not subscribed to the Twitter API. Please subscribe to the Twitter API on RapidAPI to use this feature.",
              rapidApiMessage: errorMessage || "You are not subscribed to this API."
            },
            { status: 403 }
          );
        }
        
        // Regular authentication/authorization error
        return NextResponse.json(
          { 
            error: "Authentication failed with RapidAPI. Please check API keys.",
            details: errorMessage || "Forbidden"
          },
          { status: 403 }
        );
      }
      
      if (status === 429) {
        return NextResponse.json(
          { 
            error: "Rate limit exceeded. Please try again later.",
            details: errorData?.message || "Too many requests"
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { 
          error: errorData?.message || `RapidAPI returned error: ${status}`,
          details: errorData
        },
        { status: status >= 400 && status < 600 ? status : 500 }
      );
    }

    // Handle network errors
    if (error?.code === "ECONNREFUSED" || error?.code === "ENOTFOUND") {
      return NextResponse.json(
        { error: "Failed to connect to RapidAPI service" },
        { status: 503 }
      );
    }

    // Generic error fallback
    return NextResponse.json(
      { 
        error: error?.message || "Failed to fetch Twitter profile",
        type: error?.name || "UnknownError"
      },
      { status: 500 }
    );
  }
}
