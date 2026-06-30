import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { parseQualityScore } from "@/lib/quality-score";
import { recomputeCreatorProfileMetrics } from "@/lib/creator-requirements";

type RouteContext = { params: Promise<{ submissionId: string }> };

async function assertCanManageSubmission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  submissionId: string,
): Promise<
  | { ok: true; creatorId: string }
  | { ok: false; response: NextResponse }
> {
  const { isAdmin, error: adminError, user: adminUser } = await verifyAdminAccess();

  if (!isAdmin) {
    if (adminError) {
      return {
        ok: false,
        response: NextResponse.json({ error: adminError }, { status: 403 }),
      };
    }

    const {
      data: { user: authUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !authUser) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        ),
      };
    }

    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", authUser.id)
      .single();

    if (userDataError || !userData || userData.user_type !== "advertiser") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 },
        ),
      };
    }

    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .select("creator_id, contest_id, contests!inner(advertiser_id)")
      .eq("id", submissionId)
      .single();

    if (submissionError || !submission) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Submission not found" },
          { status: 404 },
        ),
      };
    }

    if ((submission as { contests: { advertiser_id: string } }).contests.advertiser_id !== authUser.id) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "You can only manage submissions for your own contests" },
          { status: 403 },
        ),
      };
    }

    return {
      ok: true,
      creatorId: String(submission.creator_id),
    };
  }

  if (!adminUser?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    };
  }

  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .select("creator_id")
    .eq("id", submissionId)
    .single();

  if (submissionError || !submission?.creator_id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      ),
    };
  }

  return { ok: true, creatorId: String(submission.creator_id) };
}

export async function PATCH(request: Request, context: RouteContext) {
  const supabase = await createClient();

  try {
    const { submissionId } = await context.params;
    if (!submissionId?.trim()) {
      return NextResponse.json(
        { error: "Submission ID is required" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const qualityScore = parseQualityScore(body?.qualityScore);
    if (qualityScore === null) {
      return NextResponse.json(
        { error: "qualityScore must be 1, 2, or 3" },
        { status: 400 },
      );
    }

    const access = await assertCanManageSubmission(supabase, submissionId);
    if (!access.ok) {
      return access.response;
    }

    const supabaseAdmin = createAdminClient();
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("submissions")
      .select("id, status, creator_id, quality_score")
      .eq("id", submissionId)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    const status = String(existing.status || "").toLowerCase();
    if (status !== "verified" && status !== "paid") {
      return NextResponse.json(
        {
          error:
            "Quality score can only be updated for verified or paid submissions",
        },
        { status: 400 },
      );
    }

    const { data: updatedSubmission, error: updateError } = await supabaseAdmin
      .from("submissions")
      .update({ quality_score: qualityScore })
      .eq("id", submissionId)
      .select("id, status, quality_score, creator_id")
      .single();

    if (updateError || !updatedSubmission) {
      return NextResponse.json(
        { error: updateError?.message || "Failed to update quality score" },
        { status: 500 },
      );
    }

    const creatorId = String(updatedSubmission.creator_id || access.creatorId);
    await recomputeCreatorProfileMetrics(supabaseAdmin, creatorId);

    const { data: creatorProfile } = await supabaseAdmin
      .from("creator_profiles")
      .select("avg_quality_score, best_quality_score")
      .eq("id", creatorId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      submission: updatedSubmission,
      creatorId,
      creatorQuality: {
        avg_quality_score: creatorProfile?.avg_quality_score ?? null,
        best_quality_score: creatorProfile?.best_quality_score ?? null,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to update quality score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
