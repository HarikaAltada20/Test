"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ExternalLink, Instagram, Loader2, Pause, Play } from "lucide-react";
import { useSubmissionContentPreview } from "@/hooks/use-submission-content-preview";
import { SubmissionContentPlayerSurface } from "@/components/SubmissionContentPlayerSurface";

export type ReviewPlayerHandle = {
  togglePlay: () => void;
  setMuted: (muted: boolean) => void;
};

type ReviewPlayerProps = {
  submissionId: string;
  contentLink: string | null | undefined;
  platform?: string | null;
  videoId?: string | null;
  videoThumbnailUrl?: string | null;
  /** Active slide: mount the real player and autoplay. */
  live: boolean;
  /** Neighbour slide: fetch the preview ahead of time, render thumbnail only. */
  prefetch: boolean;
  muted: boolean;
  playbackRate: number;
  /** Current playback position as a share of the clip, 0-100. */
  onWatchedChange?: (percent: number) => void;
  /** Clip length in seconds as reported by the player. */
  onDurationChange?: (seconds: number) => void;
  /** Forward wheel deltas to the feed while an embed is shielded. */
  onWheelForward?: (deltaY: number) => void;
};

type MediaElement = HTMLVideoElement | HTMLIFrameElement;

/** YouTube IFrame API player states. */
const YT_PLAYING = 1;
const YT_BUFFERING = 3;
/** TikTok player/v1 states. */
const TT_PLAYING = 1;
const TT_BUFFERING = 3;

function postYoutubeCommand(
  frame: HTMLIFrameElement,
  func: string,
  args: unknown[] = [],
) {
  frame.contentWindow?.postMessage(
    JSON.stringify({ event: "command", func, args }),
    "*",
  );
}

function postTiktokCommand(frame: HTMLIFrameElement, type: string) {
  frame.contentWindow?.postMessage(
    { type, value: null, "x-tiktok-player": true },
    "*",
  );
}

export const ReviewPlayer = forwardRef<ReviewPlayerHandle, ReviewPlayerProps>(
  function ReviewPlayer(
    {
      submissionId,
      contentLink,
      platform,
      videoId,
      videoThumbnailUrl,
      live,
      prefetch,
      muted,
      playbackRate,
      onWatchedChange,
      onDurationChange,
      onWheelForward,
    },
    ref,
  ) {
    const {
      playerLoading,
      thumbnailLoading,
      error,
      preview,
      thumbnailUrl,
      platform: resolvedPlatform,
    } = useSubmissionContentPreview({
      contentLink,
      submissionId,
      platform,
      videoId,
      videoThumbnailUrl,
      enabled: live || prefetch,
      playable: true,
    });

    const mediaRef = useRef<MediaElement | null>(null);
    const playingRef = useRef(true);
    const mutedRef = useRef(muted);
    const rateRef = useRef(playbackRate);
    const [started, setStarted] = useState(false);
    const [videoFailed, setVideoFailed] = useState(false);
    const [progress, setProgress] = useState({ current: 0, duration: 0 });
    const [flash, setFlash] = useState<{ kind: "play" | "pause"; key: number } | null>(
      null,
    );

    const isYoutubeIframe =
      resolvedPlatform === "youtube" && preview?.mode === "iframe";
    const isInstagram = resolvedPlatform === "instagram";
    const isTiktokIframe =
      resolvedPlatform === "tiktok" && preview?.mode === "iframe";

    const watchedRef = useRef(0);
    const progressRef = useRef(progress);
    const onWatchedRef = useRef(onWatchedChange);
    onWatchedRef.current = onWatchedChange;
    const onDurationRef = useRef(onDurationChange);
    onDurationRef.current = onDurationChange;
    const reportProgress = useCallback((current: number, duration: number) => {
      if (!duration || duration <= 0 || !Number.isFinite(duration)) return;
      if (Math.round(duration) !== Math.round(progressRef.current.duration)) {
        onDurationRef.current?.(duration);
      }
      progressRef.current = { current, duration };
      setProgress({ current, duration });
      const pct = Math.max(0, Math.min(100, Math.round((current / duration) * 100)));
      if (pct !== watchedRef.current) {
        watchedRef.current = pct;
        onWatchedRef.current?.(pct);
      }
    }, []);

    useEffect(() => {
      if (!live) {
        playingRef.current = true;
        watchedRef.current = 0;
        setVideoFailed(false);
        progressRef.current = { current: 0, duration: 0 };
        setProgress({ current: 0, duration: 0 });
      }
    }, [live]);

    const applyMuted = useCallback(
      (next: boolean) => {
        mutedRef.current = next;
        const el = mediaRef.current;
        if (!el) return;
        if (el instanceof HTMLVideoElement) {
          el.muted = next;
          return;
        }
        if (resolvedPlatform === "youtube") {
          postYoutubeCommand(el, next ? "mute" : "unMute");
        } else if (resolvedPlatform === "tiktok") {
          postTiktokCommand(el, next ? "mute" : "unMute");
        }
      },
      [resolvedPlatform],
    );

    const applyRate = useCallback(
      (rate: number) => {
        rateRef.current = rate;
        const el = mediaRef.current;
        if (!el) return;
        if (el instanceof HTMLVideoElement) {
          el.playbackRate = rate;
        } else if (resolvedPlatform === "youtube") {
          postYoutubeCommand(el, "setPlaybackRate", [rate]);
        }
      },
      [resolvedPlatform],
    );

    useEffect(() => {
      applyMuted(muted);
    }, [muted, applyMuted]);

    useEffect(() => {
      applyRate(playbackRate);
    }, [playbackRate, applyRate]);

    // YouTube reports currentTime / duration / playerState once we "listen".
    useEffect(() => {
      if (!live || !isYoutubeIframe) return;
      const onMessage = (event: MessageEvent) => {
        const frame = mediaRef.current;
        if (!(frame instanceof HTMLIFrameElement)) return;
        if (event.source !== frame.contentWindow) return;
        if (typeof event.data !== "string") return;
        let data: { event?: string; info?: Record<string, unknown> };
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        if (data.event !== "infoDelivery" && data.event !== "initialDelivery") return;
        const info = data.info ?? {};
        if (typeof info.playerState === "number") {
          playingRef.current =
            info.playerState === YT_PLAYING || info.playerState === YT_BUFFERING;
        }
        const current =
          typeof info.currentTime === "number" ? info.currentTime : undefined;
        const duration =
          typeof info.duration === "number" ? info.duration : undefined;
        if (current != null || duration != null) {
          reportProgress(
            current ?? progressRef.current.current,
            duration ?? progressRef.current.duration,
          );
        }
      };
      window.addEventListener("message", onMessage);
      return () => window.removeEventListener("message", onMessage);
    }, [live, isYoutubeIframe, reportProgress]);

    // TikTok player/v1 posts { type, value, "x-tiktok-player": true } events.
    useEffect(() => {
      if (!live || !isTiktokIframe) return;
      const onMessage = (event: MessageEvent) => {
        const frame = mediaRef.current;
        if (!(frame instanceof HTMLIFrameElement)) return;
        if (event.source !== frame.contentWindow) return;
        let data: unknown = event.data;
        if (typeof data === "string") {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }
        if (!data || typeof data !== "object") return;
        const msg = data as { type?: string; value?: unknown; "x-tiktok-player"?: boolean };
        if (!msg["x-tiktok-player"]) return;
        if (msg.type === "onStateChange" && typeof msg.value === "number") {
          playingRef.current = msg.value === TT_PLAYING || msg.value === TT_BUFFERING;
          return;
        }
        if (msg.type === "onCurrentTime" && msg.value && typeof msg.value === "object") {
          const { currentTime, duration } = msg.value as {
            currentTime?: unknown;
            duration?: unknown;
          };
          if (typeof currentTime === "number" && typeof duration === "number") {
            reportProgress(currentTime, duration);
          }
        }
      };
      window.addEventListener("message", onMessage);
      return () => window.removeEventListener("message", onMessage);
    }, [live, isTiktokIframe, reportProgress]);

    const handleMediaRef = useCallback(
      (el: MediaElement | null) => {
        mediaRef.current = el;
        if (el instanceof HTMLVideoElement) {
          el.playbackRate = rateRef.current;
          el.addEventListener("timeupdate", () =>
            reportProgress(el.currentTime, el.duration),
          );
          return;
        }
        if (el instanceof HTMLIFrameElement) {
          // Embed APIs accept commands only after the player finishes loading.
          el.addEventListener(
            "load",
            () => {
              if (resolvedPlatform === "youtube") {
                el.contentWindow?.postMessage(
                  JSON.stringify({ event: "listening", id: submissionId, channel: "widget" }),
                  "*",
                );
              }
              window.setTimeout(() => {
                applyMuted(mutedRef.current);
                applyRate(rateRef.current);
              }, 400);
            },
            { once: true },
          );
        }
      },
      [applyMuted, applyRate, reportProgress, resolvedPlatform, submissionId],
    );

    const togglePlay = useCallback(() => {
      const el = mediaRef.current;
      if (!el) return;
      if (el instanceof HTMLVideoElement) {
        const willPlay = el.paused;
        if (willPlay) void el.play().catch(() => {});
        else el.pause();
        setFlash({ kind: willPlay ? "play" : "pause", key: Date.now() });
        return;
      }
      const willPlay = !playingRef.current;
      playingRef.current = willPlay;
      if (resolvedPlatform === "youtube") {
        postYoutubeCommand(el, willPlay ? "playVideo" : "pauseVideo");
      } else if (resolvedPlatform === "tiktok") {
        postTiktokCommand(el, willPlay ? "play" : "pause");
      } else {
        return;
      }
      setFlash({ kind: willPlay ? "play" : "pause", key: Date.now() });
    }, [resolvedPlatform]);

    useEffect(() => {
      if (!flash) return;
      const timer = window.setTimeout(() => setFlash(null), 650);
      return () => window.clearTimeout(timer);
    }, [flash]);

    const seekTo = (fraction: number) => {
      const el = mediaRef.current;
      if (!(el instanceof HTMLIFrameElement) || !progress.duration) return;
      const seconds = Math.max(0, Math.min(1, fraction)) * progress.duration;
      postYoutubeCommand(el, "seekTo", [seconds, true]);
      progressRef.current = { ...progressRef.current, current: seconds };
      setProgress(progressRef.current);
    };

    useImperativeHandle(
      ref,
      () => ({ togglePlay, setMuted: applyMuted }),
      [applyMuted, togglePlay],
    );

    const poster = thumbnailUrl ? (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailUrl}
          alt=""
          aria-hidden
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-2xl"
          decoding="async"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-contain"
          decoding="async"
        />
      </>
    ) : (
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-800" />
    );

    if (!live) {
      return <div className="relative h-full w-full overflow-hidden bg-black">{poster}</div>;
    }

    // Instagram's embed page can't autoplay or be controlled, so Review Mode
    // only ever plays a real video file and otherwise links out.
    const instagramHasFile = isInstagram && preview?.mode === "direct" && !videoFailed;
    const instagramWaiting =
      isInstagram && !instagramHasFile && !videoFailed && !error && playerLoading;
    if (isInstagram && !instagramHasFile) {
      return (
        <div className="relative h-full w-full overflow-hidden bg-black">
          {poster}
          {instagramWaiting ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Loader2 className="h-8 w-8 animate-spin text-white/90" />
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/65 px-6 text-center text-white backdrop-blur-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500">
                <Instagram className="h-6 w-6" />
              </span>
              <p className="text-sm font-semibold">This reel can&apos;t play inside Game of Creators</p>
              <p className="text-xs text-white/70">
                Instagram didn&apos;t return a playable video. It may be private, deleted, or
                temporarily rate-limited.
              </p>
              {contentLink && (
                <a
                  href={contentLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900 transition-colors hover:bg-white/90"
                >
                  Watch on Instagram
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}
        </div>
      );
    }

    const progressPct =
      progress.duration > 0
        ? Math.min(100, (progress.current / progress.duration) * 100)
        : 0;

    return (
      <div className="relative h-full w-full overflow-hidden bg-black">
        <SubmissionContentPlayerSurface
          thumbnailUrl={thumbnailUrl}
          thumbnailLoading={thumbnailLoading}
          preview={preview}
          platform={resolvedPlatform}
          error={error}
          playerLoading={playerLoading}
          isDark
          showcase
          autoPlay
          loop
          chromeless
          muted={muted}
          mediaRef={handleMediaRef}
          onStartedChange={setStarted}
          onMediaError={() => setVideoFailed(true)}
        />

        {/* Keeps the pointer out of YouTube's iframe so its hover chrome never shows. */}
        {isYoutubeIframe && started && (
          <button
            type="button"
            className="absolute inset-0 z-[35] cursor-pointer bg-transparent"
            onWheel={(event) => onWheelForward?.(event.deltaY)}
            onClick={togglePlay}
            aria-label="Play or pause"
          />
        )}

        {flash && (
          <div
            key={flash.key}
            className="pointer-events-none absolute inset-0 z-[36] flex items-center justify-center"
          >
            <span className="flex h-16 w-16 animate-in fade-in zoom-in-75 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm duration-200">
              {flash.kind === "play" ? (
                <Play className="ml-1 h-7 w-7 fill-current" />
              ) : (
                <Pause className="h-7 w-7 fill-current" />
              )}
            </span>
          </div>
        )}

        {isYoutubeIframe && started && progress.duration > 0 && (
          <div
            className="group absolute inset-x-0 bottom-0 z-[37] h-3 cursor-pointer"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              seekTo((event.clientX - rect.left) / rect.width);
            }}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(progress.duration)}
            aria-valuenow={Math.round(progress.current)}
          >
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25 transition-[height] group-hover:h-1.5">
              <div
                className="h-full bg-white"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  },
);
