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
  cooldownType?: "opportunities" | "brand" | "admin"; // "opportunities" for creators (1 hour), "brand" for brands (3 minutes), "admin" for admins (1 minute)
  contestStatus?: string | null;
  disableRefreshWhenContestEnded?: boolean;
  /** When true (e.g. opportunities/creator view), show "Refresh my tweets" and allow refresh even when contest ended (creator-only refresh, 1h cooldown). */
  allowRefreshMyTweetsWhenEnded?: boolean;
  /** When set (e.g. opportunities/creator view), only load and show this creator's tweets. Hides creator filter. */
  creatorOnlyUserId?: string | null;
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
  cooldownType = "opportunities", // Default to opportunities (creators) - 1 hour cooldown
  contestStatus,
  disableRefreshWhenContestEnded = false,
  allowRefreshMyTweetsWhenEnded = false,
  creatorOnlyUserId = null,
}: TwitterFeedProps) {
  const { toast } = useToast();
  const [tweets, setTweets] = useState<TwitterTweet[]>([]);
  const [creators, setCreators] = useState<TwitterCreator[]>([]);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(
    creatorOnlyUserId ?? null
  );
  const effectiveCreatorId = creatorOnlyUserId ?? selectedCreatorId;
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [pageLimit, setPageLimit] = useState(50);
  const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);
  const [currentLastMetricsUpdated, setCurrentLastMetricsUpdated] = useState<
    string | null | undefined
  >(lastMetricsUpdated);
  const tweetsLoadedRef = useRef<string | null>(null);
  const contestEnded =
    disableRefreshWhenContestEnded && isContestEnded(contestStatus);

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
    if (!currentLastMetricsUpdated) return;

    const interval = setInterval(() => {
      // Force re-render to update cooldown display
      setCurrentLastMetricsUpdated((prev) => prev);
    }, 30000); // Update every 30 seconds for smoother countdown

    return () => clearInterval(interval);
  }, [currentLastMetricsUpdated]);

  // When creatorOnlyUserId is set (e.g. opportunities), keep filter locked to that creator
  useEffect(() => {
    if (creatorOnlyUserId) {
      setSelectedCreatorId(creatorOnlyUserId);
    }
  }, [creatorOnlyUserId]);

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
    if (isRefreshingFeed) return;
    if (contestEnded && !allowRefreshMyTweetsWhenEnded) {
      toast({
        title: "Contest Ended",
        description:
          "This contest has ended so refreshing the feed is disabled.",
        variant: "destructive",
      });
      return;
    }

    // Check cooldown before making request - use appropriate cooldown based on context
    const cooldownInfo =
      cooldownType === "admin"
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
    let result: { queued?: boolean; error?: string } | undefined = undefined;
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
        return;
      }

      if (result?.queued) {
        // Feed refresh queued; poll until done then reload
        const previousUpdated = currentLastMetricsUpdated ?? null;
        const pollIntervalMs = 3000;
        const pollMaxMs = 120000;
        const startedAt = Date.now();
        const pollTimer = setInterval(async () => {
          if (Date.now() - startedAt > pollMaxMs) {
            clearInterval(pollTimer);
            setIsRefreshingFeed(false);
            return;
          }
          try {
            const res = await fetch(
              `/api/contests/${contestId}/last-metrics-updated`
            );
            if (!res.ok) return;
            const data = await res.json();
            const newUpdated = data.last_metrics_updated ?? null;
            if (newUpdated && newUpdated !== previousUpdated) {
              clearInterval(pollTimer);
              setIsRefreshingFeed(false);
              window.location.reload();
            }
          } catch {
            // ignore
          }
        }, pollIntervalMs);
      } else {
        toast({
          title: "Success!",
          description: "Twitter feed refreshed successfully",
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
      if (!result?.queued) {
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
        "space-y-6",
        isDark ? "bg-[#170337]" : "bg-white",
        className
      )}
    >
      {showHeader && (
        <div
          className={cn(
            "flex items-center justify-between p-4 rounded-t-xl border-b",
            isDark ? "bg-[#170337] border-gray-600" : "bg-white border-gray-200"
          )}
        >
          <div className="flex items-center gap-3">
            <h1
              className={cn(
                "text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              Twitter Feed
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {(() => {
              // Use appropriate cooldown based on cooldownType prop
              const cooldownInfo =
                cooldownType === "admin"
                  ? getMetricsRefreshCooldownInfoAdmin(
                      currentLastMetricsUpdated
                    )
                  : cooldownType === "brand"
                  ? getMetricsRefreshCooldownInfoBrand(
                      currentLastMetricsUpdated
                    )
                  : getMetricsRefreshCooldownInfoOpportunities(
                      currentLastMetricsUpdated
                    );

              const waitLabel = formatRemainingTime(cooldownInfo.remainingMs);
              const disableByContestEnded =
                contestEnded && !allowRefreshMyTweetsWhenEnded;
              const isDisabled =
                disableByContestEnded ||
                isRefreshingFeed ||
                !cooldownInfo.canRefresh;
              const disabledReason = disableByContestEnded
                ? "Contest has ended"
                : !cooldownInfo.canRefresh
                ? `Please wait ${waitLabel}`
                : isRefreshingFeed
                ? "Refreshing..."
                : "";
              const defaultLabel = allowRefreshMyTweetsWhenEnded
                ? "Refresh my tweets"
                : "Refresh Feed";
              const label = disableByContestEnded
                ? "Contest Ended"
                : isRefreshingFeed
                ? "Refreshing..."
                : !cooldownInfo.canRefresh
                ? `Wait ${waitLabel}`
                : defaultLabel;

              return (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshFeed}
                  disabled={isDisabled}
                  className={cn(
                    "flex items-center gap-2",
                    isDisabled
                      ? "opacity-60 cursor-not-allowed"
                      : isDark
                      ? "text-white hover:bg-gray-700"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                  title={
                    disabledReason ||
                    (allowRefreshMyTweetsWhenEnded
                      ? "Refresh your tweets and metrics (1h cooldown)"
                      : "Refresh Twitter feed")
                  }
                >
                  {isRefreshingFeed ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span>{label}</span>
                </Button>
              );
            })()}
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Main Feed */}
        <div className="flex-1 space-y-4">
          {isLoading && tweets.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
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
                    "border",
                    isDark
                      ? "bg-[#170337] border-gray-700 hover:border-purple-500"
                      : "bg-white border-gray-200 hover:border-purple-300"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        {(() => {
                          const typeColors = getTweetTypeColor(
                            tweet.tweet_type
                          );
                          return (
                            <Badge
                              className={cn(
                                "text-xs font-bold px-2.5 py-1 rounded-md border-0",
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
                            "text-sm",
                            isDark ? "text-gray-400" : "text-gray-600"
                          )}
                        >
                          from @{tweet.twitter_username}
                        </span>
                        <span
                          className={cn(
                            "text-sm",
                            isDark ? "text-gray-500" : "text-gray-500"
                          )}
                        >
                          {timeAgo}
                        </span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div
                        className={cn(
                          "p-3 rounded-lg border",
                          isDark
                            ? "bg-gray-800/50 border-gray-700 text-white"
                            : "bg-gray-50 border-gray-200 text-gray-900"
                        )}
                      >
                        <p className="whitespace-pre-wrap">
                          {tweet.tweet_text}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Eye
                          className={cn(
                            "h-4 w-4",
                            isDark ? "text-gray-400" : "text-gray-600"
                          )}
                        />
                        <span
                          className={cn(
                            "text-sm",
                            isDark ? "text-gray-300" : "text-gray-700"
                          )}
                        >
                          {tweet.impressions || 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ThumbsUp className="h-4 w-4 text-pink-500" />
                        <span
                          className={cn(
                            "text-sm",
                            isDark ? "text-gray-300" : "text-gray-700"
                          )}
                        >
                          {tweet.likes || 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-green-500" />
                        <span
                          className={cn(
                            "text-sm",
                            isDark ? "text-gray-300" : "text-gray-700"
                          )}
                        >
                          {tweet.retweets || 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MessageCircle
                          className={cn(
                            "h-4 w-4",
                            isDark ? "text-gray-400" : "text-gray-600"
                          )}
                        />
                        <span
                          className={cn(
                            "text-sm",
                            isDark ? "text-gray-300" : "text-gray-700"
                          )}
                        >
                          {tweet.replies || 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="text-sm font-semibold text-green-500">
                            +{tweet.points || 0}.0
                          </span>
                        </div>
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
                            "text-sm flex items-center gap-2 hover:underline",
                            isDark ? "text-purple-400" : "text-purple-600"
                          )}
                        >
                          Click to view tweet
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span
                          className={cn(
                            "text-sm flex items-center gap-2 opacity-50",
                            isDark ? "text-gray-400" : "text-gray-500"
                          )}
                        >
                          Click to view tweet
                          <ExternalLink className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              className={cn("py-4 mt-6", isDark ? "bg-[#170337]" : "bg-white")}
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

        {/* Creator Sidebar - hide when showing only one creator (e.g. opportunities) */}
        {creators.length > 0 && !creatorOnlyUserId && (
          <div
            className={cn(
              "w-64 border rounded-lg p-4",
              isDark
                ? "bg-[#170337] border-gray-700"
                : "bg-white border-gray-200"
            )}
          >
            <h3
              className={cn(
                "font-semibold mb-4",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              Creators
            </h3>
            <div className="space-y-2">
              <button
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
