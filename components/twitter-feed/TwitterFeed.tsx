"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ExternalLink,
  Eye,
  ThumbsUp,
  RefreshCw,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { cn, formatTimeAgo, isContestEnded } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  getMetricsRefreshCooldownInfoOpportunities,
  getMetricsRefreshCooldownInfoBrand,
  getMetricsRefreshCooldownInfoAdmin,
  formatRemainingTime,
} from "@/lib/constants";
import { PaginationControls } from "@/components/ui/pagination-controls";

export interface TwitterFeedProps {
  contestId: string;
  contestTitle?: string;
  isDark?: boolean;
  showHeader?: boolean;
  className?: string;
  lastMetricsUpdated?: string | null;
  cooldownType?: "opportunities" | "brand" | "admin"; // "opportunities" for creators (2 hours), "brand" for brands (3 minutes), "admin" for admins (1 minute)
  contestStatus?: string | null;
  /** When set to in_review, verification_complete, or payouts_processed, Refresh Feed is disabled (metrics locked). */
  postContestStatus?: string | null;
  disableRefreshWhenContestEnded?: boolean;
  /** When true (e.g. opportunities/creator view), show "Refresh my tweets" and allow refresh even when contest ended (creator-only refresh, 2h cooldown). */
  allowRefreshMyTweetsWhenEnded?: boolean;
  /**
   * When set (e.g. opportunities/creator view), refresh only this creator's tweets/metrics.
   * Feed filtering uses the Creators sidebar like the brand view; this prop does not hide it.
   */
  creatorOnlyUserId?: string | null;
  /**
   * Brand/admin contest views use toolbar **Refresh Metrics** (same full-contest sync). Set false to hide duplicate "Refresh Feed" here.
   */
  showRefreshButton?: boolean;
}

export interface TwitterTweet {
  id: string;
  tweet_id: string;
  tweet_url: string;
  twitter_username: string;
  tweet_text: string;
  tweet_created_at: string;
  tweet_type: "tweet" | "quote" | "retweet" | "reply";
  likes: number;
  replies: number;
  retweets: number;
  impressions: number;
  points: number;
  creator?: {
    id: string;
    username: string | null;
    full_name: string | null;
    profile_picture_url: string | null;
  };
}

export interface TwitterCreator {
  id: string;
  username: string | null;
  full_name: string | null;
  profile_picture_url: string | null;
  tweetCount: number;
}

type TwitterMetricsRefreshRunSummary = {
  id: string;
  status: string;
  is_raid?: boolean;
  started_at?: string | null;
  finished_at?: string | null;
  total_batches?: number | null;
  current_batch_index?: number | null;
  total_participants?: number | null;
  processed_participants?: number | null;
  tweets_upserted?: number | null;
  error_message?: string | null;
};

/**
 * Reusable Twitter Feed Component
 * Displays a live feed of Twitter campaign tweets with creator filtering
 */
export function TwitterFeed({
  contestId,
  contestTitle = "Contest",
  isDark = false,
  showHeader = true,
  className,
  lastMetricsUpdated,
  cooldownType = "opportunities", // Default to opportunities (creators) - 2 hour cooldown
  contestStatus,
  postContestStatus = null,
  disableRefreshWhenContestEnded = false,
  allowRefreshMyTweetsWhenEnded = false,
  creatorOnlyUserId = null,
  showRefreshButton = true,
}: TwitterFeedProps) {
  const { toast } = useToast();
  const [tweets, setTweets] = useState<TwitterTweet[]>([]);
  const [creators, setCreators] = useState<TwitterCreator[]>([]);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(
    null
  );
  // creatorOnlyUserId controls refresh/cooldown only; for display we use selectedCreatorId.
  const effectiveCreatorId = selectedCreatorId;
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [pageLimit, setPageLimit] = useState(50);
  const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);
  const [twitterRun, setTwitterRun] =
    useState<TwitterMetricsRefreshRunSummary | null>(null);
  const [twitterRunProgress, setTwitterRunProgress] = useState<number>(0);
  const [twitterRunElapsedSeconds, setTwitterRunElapsedSeconds] =
    useState<number | null>(null);
  const [currentLastMetricsUpdated, setCurrentLastMetricsUpdated] = useState<
    string | null | undefined
  >(lastMetricsUpdated);
  const [creatorLastRefreshedAt, setCreatorLastRefreshedAt] = useState<
    string | null
  >(null);
  const [creatorNextRefreshAvailableAt, setCreatorNextRefreshAvailableAt] =
    useState<string | null>(null);
  // Used to force re-render so countdown timers stay accurate.
  const [creatorCooldownTick, setCreatorCooldownTick] = useState(0);
  const tweetsLoadedRef = useRef<string | null>(null);
  const contestEnded =
    disableRefreshWhenContestEnded && isContestEnded(contestStatus);
  const metricsLocked =
    postContestStatus === "in_review" ||
    postContestStatus === "verification_complete" ||
    postContestStatus === "payouts_processed";

  const creatorOnlyMode = !!creatorOnlyUserId;
  // creatorCooldownTick bumps on an interval to force re-renders; Date.now() is read each render.
  void creatorCooldownTick;
  const nowMs = Date.now();
  const creatorNextRefreshMs = creatorNextRefreshAvailableAt
    ? new Date(creatorNextRefreshAvailableAt).getTime()
    : null;
  const creatorCanRefresh =
    creatorNextRefreshMs === null ? true : nowMs >= creatorNextRefreshMs;
  const creatorRemainingMs =
    creatorNextRefreshMs === null ? 0 : Math.max(0, creatorNextRefreshMs - nowMs);

  // Load creator-specific refresh cooldown only when we're in "my tweets" mode.
  useEffect(() => {
    if (!creatorOnlyMode || !creatorOnlyUserId || !contestId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/contests/${contestId}/twitter-creator-refresh-status?creatorId=${creatorOnlyUserId}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setCreatorLastRefreshedAt(data.last_refreshed_at ?? null);
        setCreatorNextRefreshAvailableAt(data.next_refresh_available_at ?? null);
      } catch {
        // Ignore: cooldown will fall back to "enabled"
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contestId, creatorOnlyMode, creatorOnlyUserId]);

  // Re-render periodically so the remaining countdown doesn't look stale.
  useEffect(() => {
    if (!creatorOnlyMode) return;
    const interval = setInterval(() => setCreatorCooldownTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, [creatorOnlyMode]);

  // Reset loaded flag when contest changes (same pattern as leaderboard)
  useEffect(() => {
    if (contestId) {
      // Check if we need to reset based on contest change
      // The feedKey includes creatorId, so we check if contestId part changed
      if (
        tweetsLoadedRef.current &&
        !tweetsLoadedRef.current.startsWith(`${contestId}-`)
      ) {
        tweetsLoadedRef.current = null;
      }
    }
  }, [contestId]);

  // --- Twitter refresh run tracking (persists across tab switches) ---
  const twitterRunActive =
    twitterRun?.status === "pending" || twitterRun?.status === "running";

  const runStorageKey = useCallback(() => {
    const scope = creatorOnlyUserId ? `creator:${creatorOnlyUserId}` : "all";
    return `twitter-refresh-run:${contestId}:${scope}`;
  }, [contestId, creatorOnlyUserId]);

  const twitterRunTargetProgressRef = useRef<number | null>(null);
  const twitterRunStartedAtMsRef = useRef<number | null>(null);
  const progressTickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const runStatusPollIntervalRef = useRef<
    ReturnType<typeof setInterval> | null
  >(null);
  const trackedRunIdRef = useRef<string | null>(null);

  const clearTwitterRunIntervals = useCallback(() => {
    if (progressTickIntervalRef.current) {
      clearInterval(progressTickIntervalRef.current);
      progressTickIntervalRef.current = null;
    }
    if (runStatusPollIntervalRef.current) {
      clearInterval(runStatusPollIntervalRef.current);
      runStatusPollIntervalRef.current = null;
    }
  }, []);

  const formatMmSs = useCallback((seconds: number) => {
    const s = Math.max(0, seconds);
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(
      2,
      "0",
    )}`;
  }, []);

  const startTrackingTwitterRun = useCallback(
    (run: TwitterMetricsRefreshRunSummary) => {
      if (!contestId) return;
      const runId = run.id;

      // If we already track this run, don't restart timers.
      if (
        trackedRunIdRef.current === runId &&
        progressTickIntervalRef.current &&
        runStatusPollIntervalRef.current
      ) {
        return;
      }

      trackedRunIdRef.current = runId;
      twitterRunTargetProgressRef.current = Math.floor(
        90 + Math.random() * 10,
      );
      twitterRunStartedAtMsRef.current = run.started_at
        ? new Date(run.started_at).getTime()
        : Date.now();

      try {
        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            runStorageKey(),
            JSON.stringify({
              runId,
              startedAt: run.started_at ?? new Date().toISOString(),
            }),
          );
        }
      } catch {
        // ignore
      }

      setTwitterRun(run);
      setTwitterRunProgress(1);
      setTwitterRunElapsedSeconds(0);
      setIsRefreshingFeed(true);

      clearTwitterRunIntervals();

      // Progress tick (visual only)
      const avgMs = 60_000; // 1 minute average for "Refresh my tweets"
      progressTickIntervalRef.current = setInterval(() => {
        const startedMs = twitterRunStartedAtMsRef.current;
        if (!startedMs) return;

        const elapsedMs = Date.now() - startedMs;
        const cap = twitterRunTargetProgressRef.current ?? 95;

        const computed = 1 + (elapsedMs / avgMs) * (cap - 1);
        const nextProgress = Math.max(1, Math.min(cap, computed));

        setTwitterRunProgress(nextProgress);
        setTwitterRunElapsedSeconds(Math.max(0, Math.floor(elapsedMs / 1000)));
      }, 250);

      // Poll DB-backed run status (real completion signal)
      const pollIntervalMs = 3000;
      runStatusPollIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(
            `/api/contests/${contestId}/twitter-metrics-refresh/status`,
          );
          if (!res.ok) return;
          const data = await res.json();
          const latestRun = data?.run as
            | TwitterMetricsRefreshRunSummary
            | null;
          if (!latestRun) return;

          // Ignore other runs; we only care about the runId we started/tracked.
          if (latestRun.id !== runId) return;

          setTwitterRun(latestRun);
          const status = latestRun.status;
          const isTerminal =
            status === "completed" ||
            status === "failed" ||
            status === "cancelled";

          if (!isTerminal) return;

          clearTwitterRunIntervals();
          setTwitterRunProgress(100);
          try {
            if (typeof window !== "undefined") {
              sessionStorage.removeItem(runStorageKey());
            }
          } catch {
            // ignore
          }

          if (status === "completed") {
            // Keep the button disabled until reload so users cannot double-trigger during the gap.
            setIsRefreshingFeed(true);
            setTwitterRun(null);
            toast({
              title: "Sync complete",
              description:
                "Your tweets and metrics were updated. Refreshing this page…",
            });
            setTimeout(() => window.location.reload(), 800);
          } else {
            setIsRefreshingFeed(false);
            toast({
              title: "Refresh failed",
              description:
                latestRun.error_message?.slice(0, 500) ??
                "The refresh run ended with an error.",
              variant: "destructive",
            });
          }
        } catch {
          // ignore polling errors
        }
      }, pollIntervalMs);
    },
    [contestId, clearTwitterRunIntervals, toast],
  );

  // Rehydrate loader/progress if a run is already active (e.g. tab switch).
  useEffect(() => {
    if (!contestId) return;
    let cancelled = false;

    (async () => {
      try {
        // Synchronous-ish rehydrate: if we have a stored runId, disable immediately,
        // then reconcile with DB status.
        try {
          const raw =
            typeof window !== "undefined"
              ? sessionStorage.getItem(runStorageKey())
              : null;
          if (raw) {
            const parsed = JSON.parse(raw) as
              | { runId?: string; startedAt?: string }
              | undefined;
            if (parsed?.runId) {
              startTrackingTwitterRun({
                id: parsed.runId,
                status: "running",
                started_at: parsed.startedAt ?? new Date().toISOString(),
                finished_at: null,
              });
            }
          }
        } catch {
          // ignore
        }

        const res = await fetch(
          `/api/contests/${contestId}/twitter-metrics-refresh/status`,
        );
        if (!res.ok) return;
        const data = await res.json();
        const run = data?.run as TwitterMetricsRefreshRunSummary | null;
        if (cancelled) return;
        if (!run) {
          // No run in DB; clear any stale stored run.
          try {
            if (typeof window !== "undefined") {
              sessionStorage.removeItem(runStorageKey());
            }
          } catch {
            // ignore
          }
          return;
        }

        if (run.status === "pending" || run.status === "running") {
          startTrackingTwitterRun(run);
        } else {
          clearTwitterRunIntervals();
          setTwitterRun(null);
          setTwitterRunProgress(0);
          setTwitterRunElapsedSeconds(null);
          setIsRefreshingFeed(false);
          try {
            if (typeof window !== "undefined") {
              sessionStorage.removeItem(runStorageKey());
            }
          } catch {
            // ignore
          }
        }
      } catch {
        // best-effort only
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    contestId,
    clearTwitterRunIntervals,
    runStorageKey,
    startTrackingTwitterRun,
  ]);

  useEffect(() => {
    return () => {
      clearTwitterRunIntervals();
    };
  }, [clearTwitterRunIntervals]);

  // IMPORTANT: This function ONLY reads from database - NO Twitter API calls
  // Twitter API calls are ONLY made when refresh buttons are clicked
  // This saves API calls and ensures data is only fetched when explicitly requested
  const loadTweets = useCallback(
    async (
      page: number = 1,
      creatorId: string | null = null,
      limit: number = pageLimit
    ) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });
        if (creatorId) {
          params.append("creatorId", creatorId);
        }
        // This endpoint only reads from twitter_campaign_tweets table - NO API calls
        const response = await fetch(
          `/api/contests/${contestId}/twitter-feed?${params}`
        );
        const data = await response.json();
        if (data.success) {
          setTweets(data.tweets || []);
          setCreators(data.creators || []);
          setTotalPages(data.totalPages || 1);
          setCurrentPage(data.currentPage || 1);
          setTotalEntries(data.totalEntries || 0);
        } else {
          toast({
            title: "Error",
            description: data.error || "Failed to load tweets",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error loading Twitter feed:", error);
        toast({
          title: "Error",
          description: "Failed to load Twitter feed",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [contestId, toast, pageLimit]
  );

  // Update lastMetricsUpdated when prop changes
  useEffect(() => {
    setCurrentLastMetricsUpdated(lastMetricsUpdated);
  }, [lastMetricsUpdated]);

  // Update cooldown display every 30 seconds for accurate countdown
  useEffect(() => {
    if (creatorOnlyMode) return;
    if (!currentLastMetricsUpdated) return;

    const interval = setInterval(() => {
      // Force re-render to update cooldown display
      setCurrentLastMetricsUpdated((prev) => prev);
    }, 30000); // Update every 30 seconds for smoother countdown

    return () => clearInterval(interval);
  }, [currentLastMetricsUpdated, creatorOnlyMode]);

  // Note: creatorOnlyUserId intentionally does NOT lock the displayed feed filter.

  // Load tweets only if not already loaded (to avoid refetching on tab switch)
  // IMPORTANT: This only reads from database - NO Twitter API calls
  // Twitter API calls ONLY happen when refresh buttons are clicked
  useEffect(() => {
    // Track if tweets have been loaded for current contest/creator combination
    const feedKey = `${contestId}-${effectiveCreatorId || "all"}`;
    const hasLoaded = tweetsLoadedRef.current === feedKey;

    // Only load if we haven't loaded for this contest/creator combination yet
    // This reads from DB only - saves API calls
    if (!hasLoaded) {
      loadTweets(1, effectiveCreatorId);
      tweetsLoadedRef.current = feedKey;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCreatorId, contestId]);

  // IMPORTANT: This is the ONLY function that triggers Twitter API calls
  // This is called ONLY when the "Refresh Feed" button is clicked
  // All other operations (tab switch, pagination, filtering) only read from DB
  const handleRefreshFeed = async () => {
    if (isRefreshingFeed || twitterRunActive) return;
    if (metricsLocked) {
      toast({
        title: "Refresh disabled",
        description:
          "Metrics are locked after contest review begins. No further refresh allowed.",
        variant: "destructive",
      });
      return;
    }
    if (contestEnded && !allowRefreshMyTweetsWhenEnded) {
      toast({
        title: "Contest Ended",
        description:
          "This contest has ended so refreshing the feed is disabled.",
        variant: "destructive",
      });
      return;
    }

    // Check cooldown before making request.
    // In "my tweets" mode we use creator-specific cooldown (twitter_campaign_leaderboard.next_refresh_available_at).
    const cooldownInfo = creatorOnlyMode
      ? { canRefresh: creatorCanRefresh, remainingMs: creatorRemainingMs }
      : cooldownType === "admin"
      ? getMetricsRefreshCooldownInfoAdmin(currentLastMetricsUpdated)
      : cooldownType === "brand"
      ? getMetricsRefreshCooldownInfoBrand(currentLastMetricsUpdated)
      : getMetricsRefreshCooldownInfoOpportunities(currentLastMetricsUpdated);

    if (!cooldownInfo.canRefresh) {
      toast({
        title: "Please Wait",
        description: `You can refresh again in ${formatRemainingTime(
          cooldownInfo.remainingMs
        )}`,
        variant: "destructive",
      });
      return;
    }

    setIsRefreshingFeed(true);
    let result:
      | { queued?: boolean; error?: string; runId?: string }
      | undefined = undefined;
    let keepRefreshingUntilReload = false;
    try {
      const response = await fetch(
        `/api/contests/${contestId}/twitter-refresh-feed`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      result = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          toast({
            title: "Please Wait",
            description: result?.error || "Please wait before refreshing again",
            variant: "destructive",
          });
        } else {
          throw new Error(result?.error || "Failed to refresh feed");
        }
        setIsRefreshingFeed(false);
        return;
      }

      if (result?.queued) {
        // Feed refresh queued; track progress + completion using DB run status (persists across tab switches).
        const runId = result.runId;
        if (runId) {
          try {
            const res = await fetch(
              `/api/contests/${contestId}/twitter-metrics-refresh/status`,
            );
            if (res.ok) {
              const data = await res.json();
              const run = data?.run as TwitterMetricsRefreshRunSummary | null;
              if (
                run?.id === runId &&
                (run.status === "pending" || run.status === "running")
              ) {
                startTrackingTwitterRun(run);
                return;
              }
            }
          } catch {
            // ignore; we'll fallback to approximate started_at
          }

          startTrackingTwitterRun({
            id: runId,
            status: "running",
            started_at: new Date().toISOString(),
            finished_at: null,
          });
          return;
        }

        // Fallback (should be rare): old timestamp-based polling.
        const previousUpdated = currentLastMetricsUpdated ?? null;
        const previousCreatorRefreshedAt = creatorLastRefreshedAt ?? null;
        const pollIntervalMs = 3000;
        const pollMaxMs = 120000;
        const startedAt = Date.now();
        const pollTimer = setInterval(async () => {
          if (Date.now() - startedAt > pollMaxMs) {
            clearInterval(pollTimer);
            setIsRefreshingFeed(false);
            toast({
              title: "Refresh taking longer than expected",
              description:
                "The update may still be running in the background. Try reloading the page in a moment.",
              variant: "destructive",
            });
            return;
          }
          try {
            if (creatorOnlyMode && creatorOnlyUserId) {
              const res = await fetch(
                `/api/contests/${contestId}/twitter-creator-refresh-status?creatorId=${creatorOnlyUserId}`,
              );
              if (!res.ok) return;
              const data = await res.json();
              const newCreatorRefreshedAt = data.last_refreshed_at ?? null;
              if (
                newCreatorRefreshedAt &&
                newCreatorRefreshedAt !== previousCreatorRefreshedAt
              ) {
                clearInterval(pollTimer);
                setIsRefreshingFeed(true);
                toast({
                  title: "Sync complete",
                  description:
                    "Your tweets and metrics were updated. Refreshing this page…",
                });
                window.location.reload();
              }
            } else {
              const res = await fetch(
                `/api/contests/${contestId}/last-metrics-updated`,
              );
              if (!res.ok) return;
              const data = await res.json();
              const newUpdated = data.last_metrics_updated ?? null;
              if (newUpdated && newUpdated !== previousUpdated) {
                clearInterval(pollTimer);
                setIsRefreshingFeed(true);
                toast({
                  title: "Sync complete",
                  description:
                    "Your feed was updated. Refreshing this page…",
                });
                window.location.reload();
              }
            }
          } catch {
            // ignore
          }
        }, pollIntervalMs);
      } else {
        keepRefreshingUntilReload = true;
        toast({
          title: "Sync complete",
          description: "Twitter feed refreshed successfully. Updating…",
        });
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (error: any) {
      console.error("Error refreshing feed:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to refresh feed",
        variant: "destructive",
      });
    } finally {
      if (!result?.queued && !keepRefreshingUntilReload) {
        setIsRefreshingFeed(false);
      }
    }
  };

  const getTweetTypeLabel = (type: string): string => {
    switch (type) {
      case "quote":
        return "QUOTE";
      case "retweet":
        return "RETWEET";
      case "reply":
        return "REPLY";
      default:
        return "TWEET";
    }
  };

  const getTweetTypeColor = (
    type: string
  ): { bg: string; text: string; border: string } => {
    switch (type) {
      case "quote":
        return {
          bg: "bg-blue-500",
          text: "text-white",
          border: "border-blue-500",
        };
      case "retweet":
        return {
          bg: "bg-green-500",
          text: "text-white",
          border: "border-green-500",
        };
      case "reply":
        return {
          bg: "bg-purple-500",
          text: "text-white",
          border: "border-purple-500",
        };
      default:
        return {
          bg: "bg-gray-700",
          text: "text-white",
          border: "border-gray-700",
        };
    }
  };

  return (
    <div
      className={cn(
        "w-full max-w-full min-w-0 space-y-4 sm:space-y-6",
        isDark ? "bg-[#170337]" : "bg-white",
        className
      )}
    >
      {showHeader && (
        <div
          className={cn(
            "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 p-4 sm:p-5 rounded-t-xl border-b shadow-sm",
            isDark
              ? "bg-gradient-to-b from-[#1a0a3d]/90 to-[#170337] border-white/10"
              : "bg-gradient-to-b from-white to-purple-50/35 border-gray-200/90",
          )}
        >
          <div className="min-w-0 flex-1 space-y-1 sm:pr-2 md:pr-4">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  "inline-flex h-2 w-2 shrink-0 rounded-full",
                  isDark ? "bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.6)]" : "bg-purple-500",
                )}
                aria-hidden
              />
              <h1
                className={cn(
                  "text-lg sm:text-xl md:text-2xl font-bold tracking-tight truncate",
                  isDark ? "text-white" : "text-gray-900",
                )}
              >
                Twitter Feed
              </h1>
            </div>
            {showRefreshButton ? (
              <p
                className={cn(
                  "text-xs sm:text-sm max-w-xl leading-relaxed",
                  isDark ? "text-gray-400" : "text-gray-600",
                )}
              >
                {creatorOnlyMode
                  ? "Pull the latest posts and metrics from X for your account. Updates can take up to a minute."
                  : "Preview posts stored for this contest. Use refresh to sync the latest from X when allowed."}
              </p>
            ) : null}
            {!showRefreshButton && (
              <p
                className={cn(
                  "text-xs font-normal mt-1.5 max-w-xl leading-relaxed",
                  isDark ? "text-gray-400" : "text-gray-600",
                )}
              >
                To pull the latest posts from X for <strong>all creators</strong>,
                use <strong>Refresh Metrics</strong> in the submissions toolbar
                (same sync; this tab only previews DB data).
              </p>
            )}
          </div>
          {showRefreshButton && (
            <div className="flex flex-col items-stretch sm:items-end gap-2 flex-shrink-0 w-full sm:w-auto sm:max-w-[min(100%,20rem)] relative z-[1] isolate">
              {(() => {
                const cooldownInfo = creatorOnlyMode
                  ? { canRefresh: creatorCanRefresh, remainingMs: creatorRemainingMs }
                  : cooldownType === "admin"
                  ? getMetricsRefreshCooldownInfoAdmin(currentLastMetricsUpdated)
                  : cooldownType === "brand"
                  ? getMetricsRefreshCooldownInfoBrand(currentLastMetricsUpdated)
                  : getMetricsRefreshCooldownInfoOpportunities(currentLastMetricsUpdated);

                const waitLabel = formatRemainingTime(cooldownInfo.remainingMs);
                const disableByContestEnded =
                  contestEnded && !allowRefreshMyTweetsWhenEnded;
                const isButtonBusy = isRefreshingFeed || twitterRunActive;
                const isInitialFeedLoading = isLoading && tweets.length === 0;
                const isDisabled =
                  metricsLocked ||
                  disableByContestEnded ||
                  isButtonBusy ||
                  isInitialFeedLoading ||
                  !cooldownInfo.canRefresh;
                const disabledReason = metricsLocked
                  ? "Metrics are locked after contest review begins"
                  : disableByContestEnded
                  ? "Contest has ended"
                  : isInitialFeedLoading
                  ? "Loading feed..."
                  : !cooldownInfo.canRefresh
                  ? `Please wait ${waitLabel}`
                  : isButtonBusy
                  ? "Refreshing in progress..."
                  : "";
                const defaultLabel = creatorOnlyMode
                  ? "Refresh my tweets"
                  : allowRefreshMyTweetsWhenEnded
                  ? "Refresh my tweets"
                  : "Refresh Feed";
                const label = disableByContestEnded
                  ? "Contest Ended"
                  : isButtonBusy
                  ? "Refreshing..."
                  : !cooldownInfo.canRefresh
                  ? `Wait ${waitLabel}`
                  : defaultLabel;

                return (
                  <div
                    className={cn(
                      "rounded-xl border p-3 sm:p-3.5 w-full sm:min-w-[260px] sm:max-w-sm shadow-sm transition-shadow",
                      isDark
                        ? "border-purple-500/25 bg-white/[0.04] backdrop-blur-sm"
                        : "border-purple-200/80 bg-white/80 backdrop-blur-sm hover:shadow-md",
                      isButtonBusy &&
                        (isDark
                          ? "ring-1 ring-fuchsia-500/30"
                          : "ring-1 ring-purple-200"),
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-wider",
                          isDark ? "text-purple-300/90" : "text-purple-700/80",
                        )}
                      >
                        Sync from X
                      </span>
                      {isButtonBusy && (
                        <span
                          className={cn(
                            "text-[10px] tabular-nums font-medium",
                            isDark ? "text-fuchsia-200" : "text-purple-600",
                          )}
                        >
                          {Math.max(
                            1,
                            Math.min(100, Math.floor(twitterRunProgress || 1)),
                          )}
                          %
                        </span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshFeed}
                      disabled={isDisabled}
                      className={cn(
                        "w-full h-10 rounded-lg font-medium gap-2 border-2 transition-all",
                        isDark
                          ? "border-purple-400/40 text-purple-100 hover:bg-purple-950/50 hover:border-purple-400/60"
                          : "border-purple-400/50 text-purple-700 hover:bg-purple-50 hover:border-purple-500",
                        isDisabled && "opacity-55 cursor-not-allowed hover:bg-transparent",
                        isButtonBusy &&
                          (isDark
                            ? "border-purple-400/50 bg-purple-950/30"
                            : "border-purple-500/60 bg-purple-50/80"),
                      )}
                      title={
                        disabledReason ||
                        (creatorOnlyMode
                          ? "Fetch & update only your tweets and metrics (2h cooldown)"
                          : allowRefreshMyTweetsWhenEnded
                            ? "Refresh your tweets and metrics (2h cooldown)"
                            : "Refresh Twitter feed")
                      }
                    >
                      {isButtonBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      ) : (
                        <RefreshCw className="h-4 w-4 shrink-0" />
                      )}
                      <span className="truncate">{label}</span>
                    </Button>

                    {isButtonBusy && (
                      <div className="mt-3 space-y-1.5">
                        <div
                          className={cn(
                            "flex items-center justify-between gap-2 text-[11px]",
                            isDark ? "text-gray-400" : "text-gray-600",
                          )}
                        >
                          <span>
                            {twitterRunElapsedSeconds !== null
                              ? `Elapsed ${formatMmSs(twitterRunElapsedSeconds)}`
                              : "Starting…"}
                          </span>
                          <span className="text-[10px] opacity-80 shrink-0">
                            This can take up to a minute
                          </span>
                        </div>
                        <div
                          className={cn(
                            "h-2 w-full rounded-full overflow-hidden",
                            isDark ? "bg-white/10" : "bg-purple-100/80",
                          )}
                        >
                          <div
                            className={cn(
                              "h-full rounded-full transition-[width] duration-300 ease-out shadow-sm",
                              isDark
                                ? "bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400"
                                : "bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500",
                            )}
                            style={{
                              width: `${Math.max(
                                1,
                                Math.min(100, Math.floor(twitterRunProgress || 1)),
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 min-[500px]:flex-row min-[500px]:gap-6 min-w-0">
        {/* Main Feed — below creators on mobile; left column on ≥500px */}
        <div className="order-2 min-[500px]:order-1 flex-1 min-w-0 space-y-4">
          {isLoading && tweets.length === 0 ? (
            <Card
              className={cn(
                "border overflow-hidden",
                isDark
                  ? "bg-[#180438]/80 border-purple-500/20"
                  : "bg-gradient-to-br from-white to-purple-50/50 border-purple-100",
              )}
            >
              <CardContent className="flex flex-col items-center justify-center gap-4 py-14 px-6">
                <div className="relative">
                  <div
                    className={cn(
                      "absolute inset-0 rounded-full blur-xl opacity-40",
                      isDark ? "bg-fuchsia-500" : "bg-purple-400",
                    )}
                  />
                  <Loader2
                    className={cn(
                      "relative h-10 w-10 animate-spin",
                      isDark ? "text-fuchsia-300" : "text-purple-600",
                    )}
                  />
                </div>
                <div className="text-center space-y-1">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      isDark ? "text-white" : "text-gray-900",
                    )}
                  >
                    Loading your feed
                  </p>
                  <p
                    className={cn(
                      "text-xs max-w-xs",
                      isDark ? "text-gray-400" : "text-gray-600",
                    )}
                  >
                    Fetching posts from the contest database. You can sync from X
                    after this finishes.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : tweets.length === 0 ? (
            <Card
              className={cn(
                isDark ? "bg-[#170337] border-gray-600" : "bg-white"
              )}
            >
              <CardContent className="p-8 text-center">
                <p className={cn(isDark ? "text-gray-400" : "text-gray-600")}>
                  No tweets found. Tweets will appear here once they are
                  fetched.
                </p>
              </CardContent>
            </Card>
          ) : (
            tweets.map((tweet) => {
              const timeAgo = formatTimeAgo(tweet.tweet_created_at);
              return (
                <Card
                  key={tweet.id}
                  className={cn(
                    "border overflow-hidden",
                    isDark
                      ? "bg-[#170337] border-gray-700 hover:border-purple-500"
                      : "bg-white border-gray-200 hover:border-purple-300"
                  )}
                >
                  <CardContent className="relative overflow-hidden p-3.5 sm:p-4">
                    <div
                      className={cn(
                        "pointer-events-none absolute left-0 top-0 bottom-0 w-1",
                        isDark
                          ? "bg-gradient-to-b from-fuchsia-400/50 via-purple-400/40 to-transparent"
                          : "bg-gradient-to-b from-purple-500/60 via-fuchsia-500/50 to-transparent",
                      )}
                      aria-hidden
                    />

                    <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-3">
                        {(() => {
                          const typeColors = getTweetTypeColor(
                            tweet.tweet_type
                          );
                          return (
                            <Badge
                              className={cn(
                                "text-[11px] font-bold px-2.5 py-1 rounded-md border-0 shrink-0",
                                typeColors.bg,
                                typeColors.text
                              )}
                            >
                              {getTweetTypeLabel(tweet.tweet_type)}
                            </Badge>
                          );
                        })()}
                        <span
                          className={cn(
                            "min-w-0 text-sm break-words",
                            isDark ? "text-gray-300" : "text-gray-700"
                          )}
                        >
                          @{tweet.twitter_username}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-xs sm:text-sm sm:text-right tabular-nums",
                          isDark ? "text-gray-400" : "text-gray-500",
                        )}
                      >
                        {timeAgo}
                      </span>
                    </div>

                    <div className="mb-3.5 min-w-0 overflow-hidden">
                      <div
                        className={cn(
                          "p-3.5 rounded-xl border break-words relative",
                          isDark
                            ? "bg-white/[0.04] border-white/10 text-white"
                            : "bg-gradient-to-br from-white to-purple-50/60 border-purple-100 text-gray-900"
                        )}
                      >
                        <div
                          className={cn(
                            "absolute left-3 top-3 text-lg leading-none select-none",
                            isDark ? "text-white/20" : "text-purple-300/70",
                          )}
                          aria-hidden
                        >
                          “
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm sm:text-[15px] leading-relaxed pl-4">
                          {tweet.tweet_text}
                        </p>
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {[
                          {
                            Icon: Eye,
                            iconClass: isDark ? "text-emerald-300" : "text-emerald-600",
                            chipBg: isDark
                              ? "bg-emerald-500/10 border-emerald-500/25"
                              : "bg-emerald-50 border-emerald-100",
                            text: `${(tweet.impressions || 0).toLocaleString()} Impressions`,
                          },
                          {
                            Icon: ThumbsUp,
                            iconClass: isDark ? "text-pink-300" : "text-pink-600",
                            chipBg: isDark
                              ? "bg-pink-500/10 border-pink-500/25"
                              : "bg-pink-50 border-pink-100",
                            text: `${tweet.likes || 0} Likes`,
                          },
                          {
                            Icon: RefreshCw,
                            iconClass: isDark ? "text-teal-300" : "text-teal-600",
                            chipBg: isDark
                              ? "bg-teal-500/10 border-teal-500/25"
                              : "bg-teal-50 border-teal-100",
                            text: `${tweet.retweets || 0} Retweets`,
                          },
                          {
                            Icon: MessageCircle,
                            iconClass: isDark ? "text-sky-300" : "text-sky-600",
                            chipBg: isDark
                              ? "bg-sky-500/10 border-sky-500/25"
                              : "bg-sky-50 border-sky-100",
                            text: `${tweet.replies || 0} Replies`,
                          },
                        ].map(({ Icon, iconClass, chipBg, text }) => (
                          <div
                            key={text}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] sm:text-xs font-medium tabular-nums",
                              chipBg,
                              isDark ? "text-slate-200" : "text-slate-700",
                            )}
                          >
                            <Icon
                              className={cn("h-3.5 w-3.5 shrink-0", iconClass)}
                              aria-hidden
                            />
                            <span className="whitespace-nowrap">{text}</span>
                          </div>
                        ))}
                      </div>

                      <div
                        className={cn(
                          "inline-flex items-center gap-2 rounded-xl border px-3 py-2 w-full sm:w-auto sm:ml-auto",
                          isDark
                            ? "bg-white/[0.04] border-white/10 text-white"
                            : "bg-white/90 border-violet-100 shadow-sm text-gray-900",
                        )}
                      >
                        <div className="w-2 h-2 shrink-0 bg-green-500 rounded-full" />
                        <span className="text-sm font-semibold tabular-nums">
                          +{(tweet.points || 0).toFixed(1)} points
                        </span>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "mt-4 pt-4 border-t",
                        isDark ? "border-gray-700" : "border-gray-200"
                      )}
                    >
                      {tweet.tweet_url ? (
                        <a
                          href={tweet.tweet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "text-sm inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 w-full sm:w-auto border transition-colors",
                            isDark
                              ? "border-white/10 text-purple-200 hover:bg-white/[0.06]"
                              : "border-purple-200 text-purple-700 hover:bg-purple-50"
                          )}
                        >
                          View on X
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span
                          className={cn(
                            "text-sm inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 w-full sm:w-auto border opacity-50",
                            isDark ? "text-gray-400" : "text-gray-500"
                          )}
                        >
                          View on X
                          <ExternalLink className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}

          {/* Pagination — show whenever there are entries so page size / position are visible */}
          {totalEntries > 0 && (
            <div
              className={cn(
                "py-3 sm:py-4 mt-4 sm:mt-6 min-w-0 overflow-x-auto",
                isDark ? "bg-[#170337]" : "bg-white"
              )}
            >
              <PaginationControls
                page={currentPage}
                limit={pageLimit}
                total={totalEntries}
                totalPages={totalPages}
                hasNextPage={currentPage < totalPages}
                hasPreviousPage={currentPage > 1}
                onPageChange={(page) => {
                  setCurrentPage(page);
                  loadTweets(page, effectiveCreatorId, pageLimit);
                }}
                onLimitChange={(limit) => {
                  setPageLimit(limit);
                  loadTweets(1, effectiveCreatorId, limit);
                }}
                loading={isLoading}
                isDark={isDark}
                showResultInfo={true}
                showPageSizeSelector={true}
                showEdgeButtons={true}
                showPrevNextButtons={true}
                pageSizeOptions={[25, 50, 100]}
              />
            </div>
          )}
        </div>

        {/* Creators — first on mobile + compact horizontal strip; right sidebar ≥500px */}
        {creators.length > 0 && (
          <div
            className={cn(
              "order-1 min-[500px]:order-2 w-full min-[500px]:w-64 flex-shrink-0 border rounded-lg p-3 sm:p-4 min-w-0",
              isDark
                ? "bg-[#170337] border-gray-700"
                : "bg-white border-gray-200"
            )}
          >
            <h3
              className={cn(
                "font-semibold text-sm sm:text-base mb-2 min-[500px]:mb-4",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              <span className="hidden min-[500px]:inline">Creators</span>
              <span
                className={cn(
                  "min-[500px]:hidden block text-[11px] font-semibold uppercase tracking-wide",
                  isDark ? "text-gray-400" : "text-gray-500"
                )}
              >
                Filter by creator
              </span>
            </h3>

            <div
              className={cn(
                "flex min-[500px]:hidden flex-row flex-nowrap gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory",
                "[scrollbar-width:thin]"
              )}
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <button
                type="button"
                onClick={() => setSelectedCreatorId(null)}
                className={cn(
                  "snap-start shrink-0 flex items-center gap-2 pl-1 pr-3 py-2 rounded-full border transition-colors",
                  selectedCreatorId === null
                    ? isDark
                      ? "bg-purple-900/50 border-purple-500/50 text-white"
                      : "bg-purple-100 border-purple-200 text-purple-900"
                    : isDark
                      ? "border-gray-600 text-gray-300 hover:bg-gray-800/80"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold",
                    selectedCreatorId === null
                      ? "bg-purple-600 text-white"
                      : isDark
                        ? "bg-gray-700 text-gray-200"
                        : "bg-gray-200 text-gray-700"
                  )}
                >
                  All
                </span>
                <span className="text-left text-sm font-medium whitespace-nowrap">
                  All creators
                </span>
              </button>
              {creators.map((creator) => (
                <button
                  type="button"
                  key={creator.id}
                  onClick={() => setSelectedCreatorId(creator.id)}
                  className={cn(
                    "snap-start shrink-0 flex items-center gap-2 pl-1 pr-3 py-2 rounded-full border transition-colors max-w-[220px]",
                    selectedCreatorId === creator.id
                      ? isDark
                        ? "bg-purple-900/50 border-purple-500/50 text-white"
                        : "bg-purple-100 border-purple-200 text-purple-900"
                      : isDark
                        ? "border-gray-600 text-gray-300 hover:bg-gray-800/80"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={creator.profile_picture_url || ""} />
                    <AvatarFallback className="text-xs">
                      {(creator.username || creator.full_name || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-medium truncate">
                      {creator.full_name || creator.username || "Unknown"}
                    </p>
                    <p
                      className={cn(
                        "text-[11px] truncate tabular-nums",
                        isDark ? "text-gray-400" : "text-gray-500"
                      )}
                    >
                      {creator.tweetCount} tweets
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div className="hidden min-[500px]:block space-y-2">
              <button
                type="button"
                onClick={() => setSelectedCreatorId(null)}
                className={cn(
                  "w-full text-left p-2 rounded-lg transition-colors",
                  selectedCreatorId === null
                    ? isDark
                      ? "bg-purple-900/50 text-white"
                      : "bg-purple-100 text-purple-900"
                    : isDark
                      ? "hover:bg-gray-800 text-gray-300"
                      : "hover:bg-gray-100 text-gray-700"
                )}
              >
                All Creators
              </button>
              {creators.map((creator) => (
                <button
                  type="button"
                  key={creator.id}
                  onClick={() => setSelectedCreatorId(creator.id)}
                  className={cn(
                    "w-full text-left p-2 rounded-lg transition-colors flex items-center gap-3",
                    selectedCreatorId === creator.id
                      ? isDark
                        ? "bg-purple-900/50 text-white"
                        : "bg-purple-100 text-purple-900"
                      : isDark
                        ? "hover:bg-gray-800 text-gray-300"
                        : "hover:bg-gray-100 text-gray-700"
                  )}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={creator.profile_picture_url || ""} />
                    <AvatarFallback>
                      {(creator.username || creator.full_name || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {creator.full_name || creator.username || "Unknown"}
                    </p>
                    <p
                      className={cn(
                        "text-xs truncate",
                        isDark ? "text-gray-400" : "text-gray-500"
                      )}
                    >
                      {creator.tweetCount} tweets
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
