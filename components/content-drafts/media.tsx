"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Film, Loader2, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDuration, type DraftMedia } from "@/lib/content-drafts";
import { fetchDraftMedia } from "./api";

/** Signed URLs last an hour; reuse them for 45 minutes. */
const URL_REUSE_MS = 45 * 60 * 1000;
const posterCache = new Map<string, { url: string | null; at: number }>();

/** Poster URLs for list thumbnails, fetched in one request per change. */
export function useDraftPosters(versionIds: (string | null | undefined)[]): Record<string, string | null> {
  const key = Array.from(new Set(versionIds.filter((v): v is string => !!v))).sort().join(",");
  const [posters, setPosters] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    const now = Date.now();
    const known: Record<string, string | null> = {};
    const missing: string[] = [];
    for (const id of ids) {
      const hit = posterCache.get(id);
      if (hit && now - hit.at < URL_REUSE_MS) known[id] = hit.url;
      else missing.push(id);
    }
    setPosters(known);
    if (missing.length === 0) return;
    let cancelled = false;
    fetchDraftMedia(missing.slice(0, 100), false)
      .then((media) => {
        const at = Date.now();
        const next: Record<string, string | null> = {};
        for (const id of missing) next[id] = null;
        for (const m of media) next[m.version_id] = m.poster_url;
        for (const [id, url] of Object.entries(next)) posterCache.set(id, { url, at });
        if (!cancelled) setPosters((prev) => ({ ...prev, ...next }));
      })
      .catch(() => {
        // Thumbnails are optional; the placeholder stays.
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return posters;
}

type ThumbProps = {
  posterUrl: string | null | undefined;
  durationSec?: number | string | null;
  className?: string;
};

/** Vertical video thumbnail with a duration chip, or a film placeholder. */
export function DraftThumb({ posterUrl, durationSec, className }: ThumbProps) {
  const [broken, setBroken] = useState(false);
  const duration = formatDuration(durationSec);
  return (
    <div
      className={cn(
        "relative flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100 dark:bg-white/10",
        className,
      )}
      aria-hidden="true"
    >
      {posterUrl && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <Film className="h-5 w-5 text-gray-400 dark:text-gray-500" />
      )}
      {duration && (
        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[10px] font-medium leading-4 text-white">
          {duration}
        </span>
      )}
    </div>
  );
}

type PlayerProps = {
  versionId: string;
  /** The campaign's files were deleted after it ended. */
  purged?: boolean;
  className?: string;
};

/**
 * Plays one draft version from a short-lived signed URL. If the browser can't
 * play the format (for example some iPhone HEVC files in Chrome), it offers a
 * download instead.
 */
export function DraftVideoPlayer({ versionId, purged = false, className }: PlayerProps) {
  const [media, setMedia] = useState<DraftMedia | null>(null);
  const [loading, setLoading] = useState(!purged);
  const [failed, setFailed] = useState<"load" | "play" | null>(null);
  const retried = useRef(false);

  const load = async (cancelled?: () => boolean) => {
    setLoading(true);
    setFailed(null);
    try {
      const [m] = await fetchDraftMedia([versionId], true);
      if (cancelled?.()) return;
      setMedia(m ?? null);
      if (!m?.video_url) setFailed("load");
    } catch {
      if (!cancelled?.()) setFailed("load");
    } finally {
      if (!cancelled?.()) setLoading(false);
    }
  };

  useEffect(() => {
    retried.current = false;
    setMedia(null);
    if (purged) {
      setLoading(false);
      return;
    }
    let done = false;
    load(() => done);
    return () => {
      done = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId, purged]);

  const frame = cn(
    "relative mx-auto flex aspect-[9/16] w-full max-w-[320px] items-center justify-center overflow-hidden rounded-lg bg-black",
    className,
  );

  if (purged) {
    return (
      <div className={cn(frame, "bg-gray-100 dark:bg-white/5")}>
        <p className="max-w-xs px-6 text-center text-sm text-gray-600 dark:text-gray-300">
          The video file was deleted 30 days after the campaign ended. The details and history
          are kept.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={frame} aria-busy="true">
        <Loader2 className="h-6 w-6 animate-spin text-white/70" aria-label="Loading video" />
      </div>
    );
  }

  if (failed || !media?.video_url) {
    return (
      <div className={cn(frame, "flex-col gap-3 px-6 text-center")}>
        <p className="text-sm text-white/90">
          {failed === "play"
            ? "This video format can't be previewed in your browser."
            : "Couldn't load the video."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {media?.download_url && (
            <a href={media.download_url} className={buttonVariants({ size: "sm", variant: "secondary" })}>
              <Download aria-hidden="true" /> Download to watch
            </a>
          )}
          {failed === "load" && (
            <Button size="sm" variant="secondary" onClick={() => load()}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Try again
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={frame}>
      <video
        key={media.video_url}
        src={media.video_url}
        poster={media.poster_url ?? undefined}
        controls
        playsInline
        preload="metadata"
        className="h-full w-full object-contain"
        onError={() => {
          // An expired link gets one fresh URL; a second failure means the format.
          if (!retried.current) {
            retried.current = true;
            load();
          } else {
            setFailed("play");
          }
        }}
      />
      {media.download_url && (
        <a
          href={media.download_url}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Download video"
          title="Download"
        >
          <Download className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}
