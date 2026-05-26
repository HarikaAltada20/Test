import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  buildInstagramEmbedUrl,
  buildTikTokPlayerEmbedUrl,
  extractInstagramShortcode,
  getContentEmbedInfo,
  resolveTikTokVideoId,
} from "@/lib/content-embed";
import {
  fetchInstagramMediaPreview,
  fetchInstagramOembedThumbnail,
} from "@/lib/instagram-preview-media";
import { ensureFreshTikTokToken } from "@/lib/tiktok/ensure-fresh-tiktok-token";
import {
  fetchTikTokMediaPreview,
  fetchTikTokOembedThumbnail,
} from "@/lib/tiktok-preview-media";
import { isValidHttpsImageUrl } from "@/lib/submission-thumbnail";

function submissionPlatformIncludes(
  platform: string | null | undefined,
  needle: string,
): boolean {
  return (platform || "").toLowerCase().includes(needle);
}

type RouteContext = { params: Promise<{ submissionId: string }> };

async function resolveInstagramThumbnail(
  contentLink: string,
  videoId: string | null,
  creatorAccessToken: string | null,
): Promise<string | null> {
  if (videoId && creatorAccessToken) {
    const { thumbnailUrl } = await fetchInstagramMediaPreview(
      videoId,
      creatorAccessToken,
    );
    if (thumbnailUrl) return thumbnailUrl;
  }

  return fetchInstagramOembedThumbnail(contentLink);
}

async function resolveTikTokThumbnail(
  contentLink: string,
  videoId: string | null,
  creatorId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  storedThumbnailUrl: string | null,
): Promise<string | null> {
  if (videoId) {
    const tokenResult = await ensureFreshTikTokToken(supabase, creatorId);
    if (tokenResult.ok) {
      const { thumbnailUrl } = await fetchTikTokMediaPreview(
        videoId,
        tokenResult.accessToken,
      );
      if (thumbnailUrl) return thumbnailUrl;
    }
  }

  const oembedThumb = await fetchTikTokOembedThumbnail(contentLink);
  if (oembedThumb) return oembedThumb;

  const stored = storedThumbnailUrl?.trim();
  if (stored && isValidHttpsImageUrl(stored)) return stored;

  return null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { submissionId } = await context.params;
    if (!submissionId) {
      return NextResponse.json({ error: "Submission ID required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = userRow?.user_type === "admin";

    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .select(
        `
        id,
        content_link,
        video_id,
        creator_id,
        platform,
        video_thumbnail_url,
        contests!inner(advertiser_id)
      `,
      )
      .eq("id", submissionId)
      .single();

    if (subError || !submission) {
      return NextResponse.json(
        { error: subError?.message || "Submission not found" },
        { status: 404 },
      );
    }

    const advertiserId = (submission.contests as { advertiser_id?: string })
      ?.advertiser_id;
    const isOwner = advertiserId === user.id;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const contentLink = submission.content_link;
    const submissionPlatform = submission.platform;
    const isInstagram = submissionPlatformIncludes(
      submissionPlatform,
      "instagram",
    );
    const isTiktok = submissionPlatformIncludes(submissionPlatform, "tiktok");

    const embed = getContentEmbedInfo(contentLink, {
      platform: submissionPlatform,
      videoId: isTiktok ? submission.video_id : undefined,
    });

    if (isInstagram || embed.platform === "instagram") {
      let creatorAccessToken: string | null = null;

      if (submission.video_id) {
        const { data: profile } = await supabase
          .from("creator_profiles")
          .select("instagram_account")
          .eq("id", submission.creator_id)
          .maybeSingle();

        const account = profile?.instagram_account as {
          access_token?: string;
        } | null;
        creatorAccessToken = account?.access_token ?? null;

        if (creatorAccessToken) {
          const { mediaUrl, thumbnailUrl } = await fetchInstagramMediaPreview(
            submission.video_id,
            creatorAccessToken,
          );

          const resolvedThumb =
            thumbnailUrl ?? (await fetchInstagramOembedThumbnail(contentLink));

          if (mediaUrl) {
            return NextResponse.json({
              mode: "direct",
              platform: "instagram",
              mediaUrl,
              thumbnailUrl: resolvedThumb ?? undefined,
            });
          }
        }
      }

      const ig = extractInstagramShortcode(contentLink);
      const embedUrl =
        embed.embedUrl ??
        (ig ? buildInstagramEmbedUrl(ig.shortcode, ig.pathKind) : null);

      if (!embedUrl) {
        return NextResponse.json(
          { error: "Invalid or unsupported Instagram URL" },
          { status: 400 },
        );
      }

      const thumbnailUrl = await resolveInstagramThumbnail(
        contentLink,
        submission.video_id,
        creatorAccessToken,
      );

      return NextResponse.json({
        mode: "iframe",
        platform: "instagram",
        embedUrl,
        thumbnailUrl: thumbnailUrl ?? undefined,
        fallbackMessage: submission.video_id
          ? "Could not load video from Instagram API. Showing embed preview."
          : "No Instagram media ID on submission; showing embed preview.",
      });
    }

    if (isTiktok || embed.platform === "tiktok") {
      const tiktokVideoId = resolveTikTokVideoId(
        contentLink,
        submission.video_id,
      );
      if (!tiktokVideoId) {
        return NextResponse.json(
          { error: "Invalid or unsupported TikTok URL" },
          { status: 400 },
        );
      }

      const thumbnailUrl = await resolveTikTokThumbnail(
        contentLink,
        submission.video_id,
        submission.creator_id,
        supabase,
        submission.video_thumbnail_url,
      );

      return NextResponse.json({
        mode: "iframe",
        platform: "tiktok",
        embedUrl: buildTikTokPlayerEmbedUrl(tiktokVideoId),
        thumbnailUrl: thumbnailUrl ?? undefined,
        fallbackMessage: submission.video_id
          ? undefined
          : "No TikTok video ID on submission; parsed from content link.",
      });
    }

    if (embed.embedUrl) {
      return NextResponse.json({
        mode: "iframe",
        platform: embed.platform,
        embedUrl: embed.embedUrl,
      });
    }

    return NextResponse.json(
      { error: "This content cannot be previewed in-app" },
      { status: 400 },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Preview failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
