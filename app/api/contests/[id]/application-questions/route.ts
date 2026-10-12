import { NextResponse } from "next/server";
import {
  CampaignAccessError,
  assertCanManageCampaignAccess,
  campaignAccessErrorResponse,
  getAccessActor,
  getServiceClient,
} from "@/lib/campaign-access-server";
import {
  isUuid,
  validateApplicationQuestions,
  type ApplicationQuestion,
} from "@/lib/campaign-access";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const QUESTION_COLUMNS = "id, position, prompt, kind, options, required";

async function loadQuestions(
  admin: ReturnType<typeof getServiceClient>,
  contestId: string,
): Promise<ApplicationQuestion[]> {
  const { data, error } = await admin
    .from("contest_application_questions")
    .select(QUESTION_COLUMNS)
    .eq("contest_id", contestId)
    .order("position")
    .order("created_at");
  if (error) throw error;
  return (data || []) as ApplicationQuestion[];
}

/** GET /api/contests/:id/application-questions — brand or admin. */
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) throw new CampaignAccessError("Campaign not found", 404);
    const actor = await getAccessActor();
    const admin = getServiceClient();
    await assertCanManageCampaignAccess(admin, actor, id);
    return NextResponse.json({ questions: await loadQuestions(admin, id) });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

/**
 * PUT /api/contests/:id/application-questions — { questions }
 * Replaces the whole set: keeps questions by id, adds new ones, deletes the rest.
 * Existing applications keep their own snapshot of the questions they answered.
 */
export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) throw new CampaignAccessError("Campaign not found", 404);
    const actor = await getAccessActor();
    const admin = getServiceClient();
    await assertCanManageCampaignAccess(admin, actor, id);

    const body = await request.json().catch(() => ({}));
    const parsed = validateApplicationQuestions(body?.questions);
    if ("error" in parsed) throw new CampaignAccessError(parsed.error, 400);

    const existing = await loadQuestions(admin, id);
    const existingIds = new Set(existing.map((q) => q.id!));
    const keepIds = new Set(
      parsed.questions.map((q) => q.id).filter((qid): qid is string => !!qid && existingIds.has(qid)),
    );

    const removed = [...existingIds].filter((qid) => !keepIds.has(qid));
    if (removed.length > 0) {
      const { error } = await admin
        .from("contest_application_questions")
        .delete()
        .eq("contest_id", id)
        .in("id", removed);
      if (error) throw error;
    }

    const now = new Date().toISOString();
    const toUpdate = parsed.questions.filter((q) => q.id && keepIds.has(q.id));
    const toInsert = parsed.questions.filter((q) => !q.id || !keepIds.has(q.id));

    for (const q of toUpdate) {
      const { error } = await admin
        .from("contest_application_questions")
        .update({
          position: q.position,
          prompt: q.prompt,
          kind: q.kind,
          options: q.options,
          required: q.required,
          updated_at: now,
        })
        .eq("contest_id", id)
        .eq("id", q.id!);
      if (error) throw error;
    }

    if (toInsert.length > 0) {
      const { error } = await admin.from("contest_application_questions").insert(
        toInsert.map((q) => ({
          contest_id: id,
          position: q.position,
          prompt: q.prompt,
          kind: q.kind,
          options: q.options,
          required: q.required,
        })),
      );
      if (error) throw error;
    }

    return NextResponse.json({ questions: await loadQuestions(admin, id) });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}
