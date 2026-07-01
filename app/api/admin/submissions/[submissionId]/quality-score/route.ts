import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  parseQualityScoreBody,
  updateSubmissionQualityScores,
} from "@/lib/admin/submission-quality-score";

type RouteContext = { params: Promise<{ submissionId: string }> };

async function assertCanManageSubmission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  submissionId: string,
): Promise<
  | { ok: true }
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
      .select("id, contests!inner(advertiser_id)")
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

    if (
      (submission as { contests: { advertiser_id: string } }).contests
        .advertiser_id !== authUser.id
    ) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "You can only manage submissions for your own contests" },
          { status: 403 },
        ),
      };
    }

    return { ok: true };
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
    .select("id")
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

  return { ok: true };
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
    const qualityScore = parseQualityScoreBody(body?.qualityScore);
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
    const result = await updateSubmissionQualityScores(
      supabaseAdmin,
      [submissionId],
      qualityScore,
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    const updatedSubmission = result.updatedSubmissions[0];
    const creatorId = updatedSubmission.creator_id;
    const creatorQuality =
      result.creatorQualityByCreatorId[creatorId] ?? {
        avg_quality_score: null,
        best_quality_score: null,
      };

    return NextResponse.json({
      success: true,
      submission: updatedSubmission,
      creatorId,
      creatorQuality,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to update quality score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
