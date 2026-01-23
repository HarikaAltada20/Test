import { NextRequest, NextResponse } from "next/server";
import {
  hasRapidApiKeys,
  rapidApiHost,
  rapidApiRequest,
} from "@/lib/twitter/rapidApiClient";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasRapidApiKeys) {
    return NextResponse.json(
      { error: "Twitter RapidAPI keys are not configured on the server" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const screenname = (body?.screenname || "").trim();

    if (!screenname) {
      return NextResponse.json(
        { error: "Missing screenname" },
        { status: 400 }
      );
    }

    const response = await rapidApiRequest({
      method: "GET",
      url: `https://${rapidApiHost}/screenname.php`,
      params: { screenname },
    });

    const data = response.data;

    if (!data || data.status !== "active") {
      return NextResponse.json(
        { error: "Unable to fetch active X profile" },
        { status: 404 }
      );
    }

    // Return full data so client can pick what it needs
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching Twitter profile via RapidAPI:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch Twitter profile" },
      { status: 500 }
    );
  }
}
