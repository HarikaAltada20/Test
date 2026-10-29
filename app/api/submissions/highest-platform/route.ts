import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { fetchContestSubmissionsAllPages } from "@/lib/fetch-contest-submissions";
import { isHighestPlatformPayoutOnly } from "@/lib/highest-platform-payout";
import { loadHighestPlatformDecisions } from "@/lib/highest-platform-payout-server";
import {
  HIGHEST_PLATFORM_SUMMARY_MAX_CONTESTS,
  buildCreatorHighestPlatformSummary,
  type CreatorHighestPlatformSummary,
} from "@/lib/highest-platform-payout-creator";
export const dynamic = "force-dynamic";

const CONTEST_COLUMNS =
  "id, contest_type, contest_format, platform, contest_based_details, max_earnings_per_creator, bonus_details";

/**
 * GET /api/submissions/highest-platform?contestIds=a,b
 *
 * For "paid for your best platform only" campaigns the caller has entered:
 * the caller's paid/leading platform, per-platform totals and which of their
 * own submissions do not count. The decision needs every creator's rows
 * (first-come slots, bonuses), so those are read with the admin client, but
 * only the caller's own data is returned.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contestIds = Array.from(
      new Set(
        (request.nextUrl.searchParams.get("contestIds") || "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ).slice(0, HIGHEST_PLATFORM_SUMMARY_MAX_CONTESTS);

    if (contestIds.length === 0) {
      return NextResponse.json({ summaries: [] });
    }

    const admin = createAdminClient();
    const { data: contests, error: contestsError } = await admin
      .from("contests_with_status")
      .select(CONTEST_COLUMNS)
      .in("id", contestIds);

    if (contestsError) {
      console.error("[highest-platform] contests:", contestsError.message);
      return NextResponse.json(
        { error: "Failed to load campaigns" },
        { status: 500 },
      );
    }

    const summaries = await Promise.all(
      (contests || [])
        .filter((contest) => isHighestPlatformPayoutOnly(contest))
        .map(async (contest): Promise<CreatorHighestPlatformSummary | null> => {
          // The caller's own submissions (read as the caller).
          const { data: ownRows, error: ownError } =
            await fetchContestSubmissionsAllPages<{ id: string }>(
              supabase,
              contest.id,
              "id",
              { creatorId: user.id },
            );
          if (ownError) {
            console.error("[highest-platform] own submissions:", contest.id, ownError);
            return null;
          }
          if (!ownRows?.length) return null;

          const { decisions, error } = await loadHighestPlatformDecisions(
            admin,
            contest.id,
            contest,
          );
          if (error) {
            console.error("[highest-platform] decisions:", contest.id, error);
            return null;
          }
          return buildCreatorHighestPlatformSummary(
            contest.id,
            decisions,
            user.id,
            ownRows.map((row) => String(row.id)),
          );
        }),
    );

    return NextResponse.json({
      summaries: summaries.filter(
        (summary): summary is CreatorHighestPlatformSummary => summary != null,
      ),
    });
  } catch (err) {
    console.error("Highest-platform summary error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
