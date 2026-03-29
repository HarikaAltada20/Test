import { fetchLeaderboardPayload } from "@/lib/leaderboard-route-data";
import {
  leaderboardCacheTag,
  LEADERBOARD_CACHE_SECONDS,
} from "@/lib/leaderboard-cache";
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split("/");
  const contestId = pathSegments[pathSegments.length - 1];

  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "25", 10);
  const groupBy = url.searchParams.get("groupBy") || "";
  /** Skip data cache (still recomputes from DB); use after tag revalidation or debugging */
  const bypassCache = url.searchParams.get("fresh") === "1";

  if (!contestId) {
    return NextResponse.json(
      { error: "Contest ID is required" },
      { status: 400 },
    );
  }

  try {
    const params = { contestId, page, limit, groupBy };

    const load = async () => fetchLeaderboardPayload(params);

    const data = bypassCache
      ? await load()
      : await unstable_cache(load, ["leaderboard-api", contestId, String(page), String(limit), groupBy], {
          revalidate: LEADERBOARD_CACHE_SECONDS,
          tags: [leaderboardCacheTag(contestId)],
        })();

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error in leaderboard endpoint:", error);
    const message = error?.message || "Unknown error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json(
      { error: `Failed to fetch leaderboard: ${message}` },
      { status },
    );
  }
}
