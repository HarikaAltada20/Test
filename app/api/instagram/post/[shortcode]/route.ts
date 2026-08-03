import { NextRequest, NextResponse } from "next/server";
import { resolveInstagramVideoUrl } from "@/lib/instagram-download/graphql";

interface RouteContext {
  params: Promise<{
    shortcode: string;
  }>;
}

/**
 * GET /api/instagram/post/[shortcode]
 * Resolve Instagram post metadata + video URL via Polaris GraphQL.
 */
export async function GET(_: NextRequest, context: RouteContext) {
  const { shortcode } = await context.params;

  const result = await resolveInstagramVideoUrl(shortcode);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status }
    );
  }

  return NextResponse.json({ data: result.data }, { status: 200 });
}
