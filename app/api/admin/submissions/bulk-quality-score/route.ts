import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  parseQualityScoreBody,
  updateSubmissionQualityScores,
} from "@/lib/admin/submission-quality-score";

async function assertCanManageSubmissions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  submissionIds: string[],
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { isAdmin, error: adminError, user: adminUser } = await verifyAdminAccess();

  if (isAdmin) {
    if (!adminUser?.id) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        ),
      };
    }
    return { ok: true };
  }

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

  const { data: rows, error: rowsError } = await supabase
    .from("submissions")
    .select("id, contests!inner(advertiser_id)")
    .in("id", submissionIds);

  if (rowsError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Failed to verify submission ownership" },
        { status: 500 },
      ),
    };
  }

  if ((rows || []).length !== submissionIds.length) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "One or more submissions were not found" },
        { status: 404 },
      ),
    };
  }

  const unauthorized = (rows || []).some(
    (row) =>
      (row as { contests: { advertiser_id: string } }).contests.advertiser_id !==
      authUser.id,
  );
  if (unauthorized) {
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

export async function PATCH(request: Request) {
  const supabase = await createClient();

  try {
    const body = await request.json();
    const qualityScore = parseQualityScoreBody(body?.qualityScore);
    if (qualityScore === null) {
      return NextResponse.json(
        { error: "qualityScore must be 1, 2, or 3" },
        { status: 400 },
      );
    }

    const submissionIds = Array.isArray(body?.submissionIds)
      ? body.submissionIds.filter(
          (id: unknown): id is string => typeof id === "string" && id.trim() !== "",
        )
      : [];

    if (submissionIds.length === 0) {
      return NextResponse.json(
        { error: "submissionIds must be a non-empty array" },
        { status: 400 },
      );
    }

    const access = await assertCanManageSubmissions(supabase, submissionIds);
    if (!access.ok) {
      return access.response;
    }

    const supabaseAdmin = createAdminClient();
    const result = await updateSubmissionQualityScores(
      supabaseAdmin,
      submissionIds,
      qualityScore,
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({
      success: true,
      submissions: result.updatedSubmissions,
      creatorQualityByCreatorId: result.creatorQualityByCreatorId,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to update quality scores";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
