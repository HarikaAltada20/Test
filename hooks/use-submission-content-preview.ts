"use client";

import { useEffect, useMemo, useState } from "react";
import { getContentEmbedInfo } from "@/lib/content-embed";
import {
  getSubmissionThumbnailUrl,
  isValidImageUrl,
  shouldFetchContentPreviewApi,
  submissionPlatformIncludes,
} from "@/lib/submission-thumbnail";
import { isYoutubeShortUrl } from "@/lib/youtube-url";

export type SubmissionContentPreview =
  | {
      mode: "iframe";
      embedUrl: string;
      platform: string;
      thumbnailUrl?: string;
      fallbackMessage?: string;
    }
  | {
      mode: "direct";
      mediaUrl: string;
      platform: string;
      thumbnailUrl?: string;
    };

export type SubmissionContentPreviewInput = {
  contentLink: string | null | undefined;
  submissionId?: string | null;
  platform?: string | null;
  videoId?: string | null;
  videoThumbnailUrl?: string | null;
  enabled?: boolean;
};

const PREVIEW_CACHE_TTL_MS = 10 * 60 * 1000;
const previewCache = new Map<
  string,
  { data: SubmissionContentPreview; expiresAt: number }
>();
const previewInFlight = new Map<string, Promise<SubmissionContentPreview>>();

async function fetchContentPreviewCached(
  submissionId: string,
): Promise<SubmissionContentPreview> {
  const now = Date.now();
  const cached = previewCache.get(submissionId);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const existing = previewInFlight.get(submissionId);
  if (existing) return existing;

  const promise = fetch(
    `/api/submissions/${submissionId}/content-preview`,
    { cache: "no-store" },
  )
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to load preview");
      }
      return data as SubmissionContentPreview;
    })
    .then((data) => {
      previewCache.set(submissionId, {
        data,
        expiresAt: Date.now() + PREVIEW_CACHE_TTL_MS,
      });
      return data;
    })
    .finally(() => {
      previewInFlight.delete(submissionId);
    });

  previewInFlight.set(submissionId, promise);
  return promise;
}

function buildInstantPreview(
  contentLink: string | null | undefined,
  platform?: string | null,
  videoId?: string | null,
): SubmissionContentPreview | null {
  const embed = getContentEmbedInfo(contentLink, { platform, videoId });
  if (!embed.embedUrl) return null;
  return {
    mode: "iframe",
    embedUrl: embed.embedUrl,
    platform: embed.platform || "unknown",
  };
}

export function useSubmissionContentPreview({
  contentLink,
  submissionId,
  platform,
  videoId,
  videoThumbnailUrl,
  enabled = true,
}: SubmissionContentPreviewInput) {
  const instantPreview = useMemo(
    () => buildInstantPreview(contentLink, platform, videoId),
    [contentLink, platform, videoId],
  );

  const fallbackEmbed = useMemo(
    () => getContentEmbedInfo(contentLink, { platform, videoId }),
    [contentLink, platform, videoId],
  );

  const staticThumbnailUrl = useMemo(
    () => getSubmissionThumbnailUrl(contentLink, videoThumbnailUrl),
    [contentLink, videoThumbnailUrl],
  );

  const [apiThumbnailUrl, setApiThumbnailUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<SubmissionContentPreview | null>(
    instantPreview,
  );
  const [playerLoading, setPlayerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const thumbnailUrl = useMemo(() => {
    if (apiThumbnailUrl && isValidImageUrl(apiThumbnailUrl)) {
      return apiThumbnailUrl;
    }
    return staticThumbnailUrl;
  }, [apiThumbnailUrl, staticThumbnailUrl]);

  useEffect(() => {
    if (!enabled || !contentLink) {
      setPreview(null);
      setError(null);
      setPlayerLoading(false);
      setApiThumbnailUrl(null);
      return;
    }

    const instant = buildInstantPreview(contentLink, platform, videoId);
    setPreview(instant);
    setError(instant ? null : "This link cannot be embedded.");
    if (!videoThumbnailUrl?.trim()) {
      setApiThumbnailUrl(null);
    }

    if (!submissionId) {
      setPlayerLoading(false);
      return;
    }

    const needsApi = shouldFetchContentPreviewApi(platform, contentLink);
    if (!needsApi) {
      setPlayerLoading(false);
      return;
    }

    let cancelled = false;
    setPlayerLoading(true);

    void fetchContentPreviewCached(submissionId)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        const thumb =
          data.mode === "iframe" || data.mode === "direct"
            ? data.thumbnailUrl
            : undefined;
        if (thumb && isValidImageUrl(thumb)) {
          setApiThumbnailUrl(thumb);
        }
      })
      .catch((err: Error) => {
        if (cancelled) return;
        if (instant?.mode === "iframe") {
          setPreview({
            ...instant,
            fallbackMessage: err.message,
          });
        } else if (fallbackEmbed.embedUrl) {
          setPreview({
            mode: "iframe",
            embedUrl: fallbackEmbed.embedUrl,
            platform: fallbackEmbed.platform || "unknown",
            fallbackMessage: err.message,
          });
        } else {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setPlayerLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    submissionId,
    contentLink,
    platform,
    videoId,
    videoThumbnailUrl,
    fallbackEmbed.embedUrl,
    fallbackEmbed.platform,
  ]);

  const resolvedPlatform = preview?.platform ?? fallbackEmbed.platform;
  const isTiktokPreview = submissionPlatformIncludes(resolvedPlatform, "tiktok");
  const isVertical =
    resolvedPlatform === "tiktok" ||
    resolvedPlatform === "instagram" ||
    (resolvedPlatform === "youtube" && isYoutubeShortUrl(contentLink));
  const isYoutubeLandscape =
    resolvedPlatform === "youtube" && !isVertical;

  return {
    /** True while fetching Instagram/TikTok preview/thumbnail from API. */
    playerLoading,
    /** TikTok uses embed preload for poster; skip spinner when only waiting on API thumb. */
    thumbnailLoading:
      playerLoading && !thumbnailUrl && !isTiktokPreview,
    error: preview ? null : error,
    preview,
    thumbnailUrl,
    platform: resolvedPlatform,
    isVertical,
    isYoutubeLandscape,
    fallbackEmbed,
  };
}
