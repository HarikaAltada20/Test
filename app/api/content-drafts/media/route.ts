import { NextResponse } from "next/server";
import {
  CampaignAccessError,
  campaignAccessErrorResponse,
  getServiceClient,
  getSignedInClient,
} from "@/lib/campaign-access-server";
import { isUuid } from "@/lib/campaign-access";
import { signDraftMedia, type DraftVersionFiles } from "@/lib/content-draft-storage";

export const dynamic = "force-dynamic";

const MAX_POSTERS = 100;
const MAX_VIDEOS = 10;

/**
 * POST /api/content-drafts/media
 * Body: { versionIds: string[], video?: boolean }
 * Signed poster (and, with video, playback and download) URLs for draft
 * versions the signed-in user can see: their own drafts, or drafts in a
 * campaign they manage. Rows they can't see are left out.
 */
export async function POST(request: Request) {
  try {
    const { supabase } = await getSignedInClient();
    const body = (await request.json().catch(() => ({}))) as {
      versionIds?: unknown;
      video?: unknown;
    };
    const video = body.video === true;
    const ids = Array.isArray(body.versionIds)
      ? Array.from(new Set(body.versionIds.filter(isUuid)))
      : [];
    if (ids.length === 0) return NextResponse.json({ media: [] });
    if (ids.length > (video ? MAX_VIDEOS : MAX_POSTERS)) {
      throw new CampaignAccessError("Too many videos requested at once", 400);
    }

    // Read with the caller's session: row-level security decides what they see.
    const { data: versions, error } = await supabase
      .from("content_draft_versions")
      .select("id, draft_id, version_no, storage_path, poster_path, mime_type")
      .in("id", ids);
    if (error) throw error;
    if (!versions || versions.length === 0) return NextResponse.json({ media: [] });

    const draftIds = Array.from(new Set(versions.map((v) => v.draft_id as string)));
    const { data: drafts, error: draftError } = await supabase
      .from("content_drafts")
      .select("id, files_purged_at")
      .in("id", draftIds);
    if (draftError) throw draftError;
    const purged = new Set(
      (drafts ?? []).filter((d) => d.files_purged_at).map((d) => d.id as string),
    );

    const rows: DraftVersionFiles[] = versions.map((v) => ({
      id: v.id as string,
      version_no: Number(v.version_no),
      storage_path: v.storage_path as string,
      poster_path: (v.poster_path as string | null) ?? null,
      mime_type: v.mime_type as string,
      purged: purged.has(v.draft_id as string),
    }));

    const media = await signDraftMedia(getServiceClient(), rows, { video });
    return NextResponse.json(
      { media },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}
