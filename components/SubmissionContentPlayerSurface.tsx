"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { withEmbedAutoplay } from "@/lib/content-embed";
import { Loader2, Play } from "lucide-react";
import type { SubmissionContentPreview } from "@/hooks/use-submission-content-preview";

type SubmissionContentPlayerSurfaceProps = {
  thumbnailUrl: string | null;
  thumbnailLoading?: boolean;
  preview: SubmissionContentPreview | null;
  platform: string | null;
  error: string | null;
  playerLoading: boolean;
  isDark?: boolean;
  title?: string;
  className?: string;
};

export function SubmissionContentPlayerSurface({
  thumbnailUrl,
  thumbnailLoading = false,
  preview,
  platform,
  error,
  playerLoading,
  isDark = false,
  title = "Submission video",
  className,
}: SubmissionContentPlayerSurfaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [embedLoaded, setEmbedLoaded] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);

  const previewKey =
    preview?.mode === "direct"
      ? preview.mediaUrl
      : preview?.mode === "iframe"
        ? preview.embedUrl
        : null;

  useEffect(() => {
    setStarted(false);
    setMediaReady(false);
    setEmbedLoaded(false);
  }, [previewKey]);

  useEffect(() => {
    setThumbFailed(false);
  }, [thumbnailUrl]);

  const isInstagram = platform === "instagram";
  const isTiktok = platform === "tiktok";
  const isTiktokIframe = isTiktok && preview?.mode === "iframe" && !!preview.embedUrl;

  const iframeSrc =
    preview?.mode === "iframe" &&
    preview.embedUrl &&
    (isTiktok || started)
      ? started
        ? withEmbedAutoplay(preview.embedUrl, platform)
        : isTiktok
          ? preview.embedUrl
          : null
      : null;

  useEffect(() => {
    if (!isTiktokIframe) return;
    setEmbedLoaded(false);
    setMediaReady(false);
  }, [iframeSrc, isTiktokIframe]);

  const showPlayer = started && preview && !error;
  const showIframe = !!iframeSrc && (isTiktokIframe || showPlayer);
  const showTiktokPoster = isTiktokIframe && embedLoaded && !started;
  const showThumbnail =
    !!thumbnailUrl &&
    !thumbFailed &&
    !mediaReady &&
    !(isTiktok && embedLoaded);
  const showInstagramPlaceholder =
    isInstagram && !showThumbnail && !showTiktokPoster && !showPlayer && !error;
  const showTiktokPlaceholder =
    isTiktok && !showThumbnail && !showTiktokPoster && !showPlayer && !error;
  const showPlatformPlaceholder =
    showInstagramPlaceholder || showTiktokPlaceholder;

  const handlePlay = useCallback(() => {
    if (!preview || error) return;
    setStarted(true);
  }, [preview, error]);

  const onMediaReady = useCallback(() => {
    setEmbedLoaded(true);
    setMediaReady(true);
  }, []);

  useEffect(() => {
    if (!started || preview?.mode !== "direct" || !videoRef.current) return;
    void videoRef.current.play().catch(() => {});
  }, [started, preview?.mode, previewKey]);

  return (
    <div className={cn("relative h-full w-full", className)}>
      {showThumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl!}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
          decoding="async"
          onError={() => setThumbFailed(true)}
        />
      )}

      {showInstagramPlaceholder && (
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br from-purple-900 via-pink-900 to-orange-800",
            thumbnailLoading && "animate-pulse",
          )}
        />
      )}

      {showTiktokPlaceholder && (
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br from-slate-950 via-cyan-950 to-pink-950",
            thumbnailLoading && "animate-pulse",
          )}
        />
      )}

      {(thumbnailLoading ||
        (thumbFailed && (isInstagram || isTiktok) && !showPlayer) ||
        (isTiktokIframe && !embedLoaded && !started)) &&
        !showPlayer &&
        !showTiktokPoster && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30">
            <Loader2 className="h-6 w-6 animate-spin text-white/90" />
          </div>
        )}

      {!thumbnailUrl && !showPlatformPlaceholder && !showPlayer && !error && (
        <div
          className={cn(
            "absolute inset-0",
            isDark ? "bg-slate-900" : "bg-slate-100",
          )}
        />
      )}

      {showPlayer && preview.mode === "direct" && (
        <video
          ref={videoRef}
          src={preview.mediaUrl}
          controls
          playsInline
          onLoadedData={onMediaReady}
          onCanPlay={onMediaReady}
          className={cn(
            "absolute inset-0 h-full w-full object-contain bg-black z-10",
            !mediaReady && "opacity-0",
          )}
        />
      )}

      {showIframe && preview.mode === "iframe" && iframeSrc && (
        <iframe
          src={iframeSrc}
          title={title}
          onLoad={onMediaReady}
          className={cn(
            "absolute inset-0 h-full w-full border-0 bg-black",
            showTiktokPoster ? "z-[5]" : "z-10",
            !embedLoaded && "opacity-0",
            showPlayer && !mediaReady && "opacity-0",
          )}
          allow={
            platform === "tiktok"
              ? "fullscreen; autoplay"
              : "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          }
          allowFullScreen
        />
      )}

      {showPlayer && (playerLoading || !mediaReady) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
          <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
        </div>
      )}

      {!started && preview && !error && (
        <button
          type="button"
          onClick={handlePlay}
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/25 transition-colors hover:bg-black/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 cursor-pointer"
          aria-label="Play video"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm pointer-events-none">
            <Play className="h-7 w-7 fill-current pl-0.5" />
          </span>
        </button>
      )}

      {error && !thumbnailUrl && (
        <p className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs text-slate-400 z-10">
          {error}
        </p>
      )}

      {error && thumbnailUrl && !preview && (
        <p className="absolute bottom-2 left-2 right-2 z-30 rounded bg-black/70 px-2 py-1 text-center text-[10px] text-slate-300">
          {error}
        </p>
      )}
    </div>
  );
}
