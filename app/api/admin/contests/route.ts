import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { isVideoContestFormat } from "@/lib/trust-score";
import {
  hasNormalizedCreatorRequirement,
  validateCreatorRequirementFields,
} from "@/lib/contest-creator-requirements-validation";

export async function POST(request: NextRequest) {
  try {
    const { isAdmin, error: adminError } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json(
        { error: adminError || "Admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { advertiserId, ...draftFields } = body;

    if (!advertiserId) {
      return NextResponse.json(
        { error: "advertiserId is required" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data: advertiser, error: advertiserError } = await supabase
      .from("users")
      .select("id, user_type")
      .eq("id", advertiserId)
      .eq("user_type", "advertiser")
      .maybeSingle();

    if (advertiserError || !advertiser) {
      return NextResponse.json(
        { error: "Advertiser not found" },
        { status: 404 },
      );
    }

    const requirementValidation = validateCreatorRequirementFields({
      trust_score: draftFields.trust_score,
      trust_number: draftFields.trust_number,
      min_avg_quality_score: draftFields.min_avg_quality_score,
      min_best_quality_score: draftFields.min_best_quality_score,
      min_platform_earnings: draftFields.min_platform_earnings,
      min_platform_views: draftFields.min_platform_views,
    });
    if (!requirementValidation.ok) {
      return NextResponse.json(
        { error: requirementValidation.error },
        { status: 400 },
      );
    }

    const normalizedRequirements = requirementValidation.values;
    if (
      hasNormalizedCreatorRequirement(normalizedRequirements) &&
      !isVideoContestFormat(draftFields.contest_format)
    ) {
      return NextResponse.json(
        {
          error:
            "Creator requirement fields are only supported for video campaigns (contest_format video)",
        },
        { status: 400 },
      );
    }

    const insertData = {
      advertiser_id: advertiserId,
      title: draftFields.title || "No Title - Draft",
      brief_html: draftFields.brief_html ?? "",
      brief_json: draftFields.brief_json ?? null,
      rules_html: draftFields.rules_html ?? "",
      rules_json: draftFields.rules_json ?? null,
      inspiration_links: draftFields.inspiration_links ?? [],
      tracking_links: draftFields.tracking_links ?? [],
      resources: draftFields.resources ?? [],
      thumbnail_url: draftFields.thumbnail_url ?? null,
      start_date: draftFields.start_date ?? null,
      end_date: draftFields.end_date ?? null,
      moderation_status: draftFields.moderation_status ?? "draft",
      contest_type: draftFields.contest_type ?? "leaderboard",
      platform: draftFields.platform ?? null,
      contest_format: draftFields.contest_format ?? null,
      category: draftFields.category ?? null,
      categories: draftFields.categories ?? null,
      subcategories: draftFields.subcategories ?? null,
      interests: draftFields.interests ?? null,
      region: draftFields.region ?? null,
      contest_based_details: draftFields.contest_based_details ?? {
        leaderboard_contest: {
          prizes: [],
          total_prize: 0,
          winner_count: 3,
        },
      },
      multiple_submissions_enabled:
        draftFields.multiple_submissions_enabled ?? false,
      max_submissions_per_creator: draftFields.max_submissions_per_creator ?? 1,
      trust_score: normalizedRequirements.trust_score ?? null,
      trust_number: normalizedRequirements.trust_number ?? null,
      min_avg_quality_score: normalizedRequirements.min_avg_quality_score ?? null,
      min_best_quality_score: normalizedRequirements.min_best_quality_score ?? null,
      min_platform_earnings: normalizedRequirements.min_platform_earnings ?? null,
      min_platform_views: normalizedRequirements.min_platform_views ?? null,
      content_type: draftFields.content_type ?? null,
      bonus_details: draftFields.bonus_details ?? null,
      max_earnings_per_creator: draftFields.max_earnings_per_creator ?? null,
      subscription_info_of_user: draftFields.subscription_info_of_user ?? null,
      submitted_for_approval_at: null,
    };

    const { data, error } = await supabase
      .from("contests")
      .insert(insertData)
      .select("id")
      .single();

    if (error) {
      console.error("Admin contest insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error("Error creating admin contest:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
