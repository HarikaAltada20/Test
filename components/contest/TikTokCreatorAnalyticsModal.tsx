"use client";

import React, { Fragment, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Info,
  Globe,
  Users,
  User,
  Layout,
  Clock,
  RefreshCw,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface TikTokDemographicRow {
  dimension_value: string;
  distribution: number;
}

interface TikTokDemographics {
  audience_age?: TikTokDemographicRow[];
  audience_gender?: TikTokDemographicRow[];
  audience_country?: TikTokDemographicRow[];
  audience_device?: TikTokDemographicRow[];
}

export type TikTokCreatorAnalyticsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contestId: string;
  creatorId: string;
  creatorLabel: string;
  isDark?: boolean;
  onFetchComplete?: () => void;
};

const TIKTOK_AQUA = "#00f2ea";
const TIKTOK_PINK = "#ff0050";

function formatInt(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Math.round(n),
  );
}

function formatMs(ms: number): string {
  if (!ms || ms <= 0) return "0s";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

type TiktokSubmissionAnalyticsRow = {
  id: string;
  content_link: string;
  views: number | null;
  other_stats: Record<string, unknown> | null;
  last_insights_update: string | null;
  insights_status: string | null;
};

type AnalyticsResponse = {
  demographics: TikTokDemographics | null;
  lastSyncedAt: string | null;
  hasMarketingAccount: boolean;
  submissions?: TiktokSubmissionAnalyticsRow[];
};

function parseTiktokStats(row: TiktokSubmissionAnalyticsRow) {
  const raw = row.other_stats;
  const tiktok =
    raw && typeof raw === "object" && "tiktok" in raw
      ? (raw.tiktok as Record<string, unknown>)
      : null;
  const views = Number(row.views ?? tiktok?.views ?? 0);
  const likes = Number(
    tiktok?.likes ?? tiktok?.like_count ?? 0,
  );
  const comments = Number(
    tiktok?.comments ?? tiktok?.comment_count ?? 0,
  );
  const shares = Number(
    tiktok?.shares ?? tiktok?.share_count ?? 0,
  );
  const saves = Number(
    tiktok?.saves ?? tiktok?.save_count ?? tiktok?.collect_count ?? 0,
  );
  const favorites = Number(tiktok?.favorites ?? 0);
  const reach = Number(
    tiktok?.reach ?? tiktok?.reach_count ?? tiktok?.video_reach_count ?? 0,
  );
  const avgMs = Number(tiktok?.avg_watch_time_ms ?? 0);
  const totalMs = Number(tiktok?.total_watch_time_ms ?? 0);
  const fullVideoWatchedRate = Number(
    tiktok?.full_video_watched_rate ?? tiktok?.fullVideoWatchedRate ?? 0,
  );
  const newFollowers = Number(tiktok?.new_followers ?? 0);
  const profileViews = Number(tiktok?.profile_views ?? 0);
  const websiteClicks = Number(tiktok?.website_clicks ?? 0);
  const phoneNumberClicks = Number(tiktok?.phone_number_clicks ?? 0);
  const leadSubmissions = Number(tiktok?.lead_submissions ?? 0);
  const appDownloadClicks = Number(tiktok?.app_download_clicks ?? 0);
  const emailClicks = Number(tiktok?.email_clicks ?? 0);
  const addressClicks = Number(tiktok?.address_clicks ?? 0);
  return {
    views,
    likes,
    comments,
    shares,
    saves,
    favorites,
    reach,
    avgMs,
    totalMs,
    fullVideoWatchedRate,
    newFollowers,
    profileViews,
    websiteClicks,
    phoneNumberClicks,
    leadSubmissions,
    appDownloadClicks,
    emailClicks,
    addressClicks,
    impressionSources: tiktok?.impression_sources ?? null,
    audienceGenders: tiktok?.audience_genders ?? null,
    audienceCountries: tiktok?.audience_countries ?? null,
    audienceCities: tiktok?.audience_cities ?? null,
    audienceTypes: tiktok?.audience_types ?? null,
    videoViewRetention: tiktok?.video_view_retention ?? null,
    engagementLikes: tiktok?.engagement_likes ?? null,
    mediaType: tiktok?.media_type != null ? String(tiktok.media_type) : null,
    videoDurationSec: Number(tiktok?.video_duration_sec ?? 0),
    lastUpdated: tiktok?.last_updated
      ? String(tiktok.last_updated)
      : row.last_insights_update,
    insightsStatus: row.insights_status,
  };
}

function hasReelBusinessInsights(m: ReturnType<typeof parseTiktokStats>): boolean {
  if (
    m.fullVideoWatchedRate > 0 ||
    m.favorites > 0 ||
    m.newFollowers > 0 ||
    m.profileViews > 0 ||
    m.websiteClicks > 0 ||
    m.phoneNumberClicks > 0 ||
    m.leadSubmissions > 0 ||
    m.appDownloadClicks > 0 ||
    m.emailClicks > 0 ||
    m.addressClicks > 0
  ) {
    return true;
  }
  const arrays = [
    m.impressionSources,
    m.audienceGenders,
    m.audienceCountries,
    m.audienceCities,
    m.audienceTypes,
    m.videoViewRetention,
    m.engagementLikes,
  ];
  return arrays.some((a) => Array.isArray(a) && a.length > 0);
}

/** TikTok returns `percentage` as a fraction (e.g. 0.75) for many breakdown fields. */
function pctDisplay(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return n <= 1 ? n * 100 : n;
}

function InsightBreakdownTable({
  title,
  rows,
  labelKey,
  isDark,
}: {
  title: string;
  rows: Record<string, unknown>[];
  labelKey: string;
  isDark?: boolean;
}) {
  const sorted = [...rows].sort(
    (a, b) => pctDisplay(b.percentage) - pctDisplay(a.percentage),
  );
  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2",
        isDark ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-slate-50/80",
      )}
    >
      <h4 className="text-xs font-semibold">{title}</h4>
      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
        {sorted.map((r, i) => {
          const label = String(r[labelKey] ?? "—");
          const p = pctDisplay(r.percentage);
          return (
            <div key={`${label}-${i}`} className="flex justify-between gap-2 text-[11px]">
              <span className="truncate font-medium" title={label}>
                {formatLabel(label)}
              </span>
              <span className="tabular-nums shrink-0">{p.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TikTokCreatorAnalyticsModal({
  open,
  onOpenChange,
  contestId,
  creatorId,
  creatorLabel,
  isDark,
  onFetchComplete,
}: TikTokCreatorAnalyticsModalProps) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && creatorId) {
      void fetchAnalytics();
    }
  }, [open, creatorId, contestId]);

  const fetchAnalytics = async (opts?: { sync?: boolean }) => {
    if (opts?.sync) setSyncing(true);
    else setLoading(true);
    setError(null);
    try {
      const qs = opts?.sync ? "?sync=1" : "";
      const response = await fetch(
        `/api/admin/contests/${contestId}/creators/${creatorId}/tiktok-account-analytics${qs}`,
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.details || body?.error || "Failed to fetch TikTok analytics",
        );
      }
      const jsonData = (await response.json()) as AnalyticsResponse;
      setData(jsonData);
    } catch (err: unknown) {
      console.error("[TikTokAnalyticsModal] fetch error:", err);
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
      setSyncing(false);
      onFetchComplete?.();
    }
  };

  const demographics = data?.demographics;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0",
        isDark ? "bg-[#06021D] border-white/10 text-white" : "bg-white"
      )}>
        <DialogHeader className={cn(
          "p-6 border-b",
          isDark ? "border-white/10 bg-[#170337]" : "bg-slate-50 border-slate-200"
        )}>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 flex-wrap">
                TikTok analytics
                <span className="text-sm font-normal text-muted-foreground mr-2">
                  for {creatorLabel}
                </span>
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                Core counts blend the Login Kit Display API with TikTok for Business
                when connected: organic post metrics (reach, watch time, traffic sources,
                audience breakdowns, retention, etc.) come from{" "}
                <code className="text-[10px]">/v1.3/business/video/list/</code> where
                your app has the right scopes; TCM video reports can still supplement
                saves. Field availability matches what you see in TikTok Analytics for
                that post.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Pull latest views, shares, and marketing metrics from TikTok (may take a few seconds).
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || syncing}
              onClick={() => void fetchAnalytics({ sync: true })}
              className="gap-2 shrink-0"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh from TikTok
            </Button>
          </div>

          {loading && !data ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <p className="text-sm text-muted-foreground">Fetching TikTok analytics...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center space-y-4">
              <p className="text-red-500 font-medium">{error}</p>
              <Button onClick={() => void fetchAnalytics()} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          ) : !data ? null : (
            <>
              {/* Reel / submission metrics for this contest */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  Reels in this contest
                </h3>
                {!data.submissions?.length ? (
                  <p className="text-sm text-muted-foreground">No TikTok submissions in this contest.</p>
                ) : (
                  <div className="rounded-xl border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className={isDark ? "border-white/10" : ""}>
                          <TableHead className="min-w-[140px]">Link</TableHead>
                          <TableHead className="text-right">Views</TableHead>
                          <TableHead className="text-right">Likes</TableHead>
                          <TableHead className="text-right">Comments</TableHead>
                          <TableHead className="text-right">Shares</TableHead>
                          <TableHead className="text-right">Saves</TableHead>
                          <TableHead className="text-right">Reach</TableHead>
                          <TableHead className="text-right">Avg watch</TableHead>
                          <TableHead className="text-right">Total watch</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.submissions.map((row) => {
                          const m = parseTiktokStats(row);
                          const impressionRows = Array.isArray(m.impressionSources)
                            ? (m.impressionSources as Record<string, unknown>[]).filter(
                                (x) => x && typeof x === "object",
                              )
                            : [];
                          const genderRows = Array.isArray(m.audienceGenders)
                            ? (m.audienceGenders as Record<string, unknown>[]).filter(
                                (x) => x && typeof x === "object",
                              )
                            : [];
                          const countryRows = Array.isArray(m.audienceCountries)
                            ? (m.audienceCountries as Record<string, unknown>[]).filter(
                                (x) => x && typeof x === "object",
                              )
                            : [];
                          const cityRows = Array.isArray(m.audienceCities)
                            ? (m.audienceCities as Record<string, unknown>[]).filter(
                                (x) => x && typeof x === "object",
                              )
                            : [];
                          const typeRows = Array.isArray(m.audienceTypes)
                            ? (m.audienceTypes as Record<string, unknown>[]).filter(
                                (x) => x && typeof x === "object",
                              )
                            : [];
                          const retentionRows = Array.isArray(m.videoViewRetention)
                            ? (m.videoViewRetention as Record<string, unknown>[]).filter(
                                (x) => x && typeof x === "object",
                              )
                            : [];
                          const likeTimingRows = Array.isArray(m.engagementLikes)
                            ? (m.engagementLikes as Record<string, unknown>[]).filter(
                                (x) => x && typeof x === "object",
                              )
                            : [];
                          const showDeepInsights =
                            data.hasMarketingAccount && hasReelBusinessInsights(m);

                          return (
                            <Fragment key={row.id}>
                              <TableRow
                                className={isDark ? "border-white/10" : ""}
                              >
                                <TableCell className="font-medium">
                                  {row.content_link ? (
                                    <a
                                      href={row.content_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={cn(
                                        "inline-flex items-center gap-1 text-cyan-600 hover:underline",
                                        isDark && "text-cyan-400",
                                      )}
                                    >
                                      Open
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatInt(m.views)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatInt(m.likes)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatInt(m.comments)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatInt(m.shares)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {!data.hasMarketingAccount &&
                                  m.saves === 0 &&
                                  m.favorites === 0 ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                    formatInt(Math.max(m.saves, m.favorites))
                                  )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {!data.hasMarketingAccount && m.reach === 0 ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                    formatInt(m.reach)
                                  )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-xs">
                                  {!data.hasMarketingAccount && m.avgMs === 0 ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                    formatMs(m.avgMs)
                                  )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-xs">
                                  {!data.hasMarketingAccount && m.totalMs === 0 ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                    formatMs(m.totalMs)
                                  )}
                                </TableCell>
                              </TableRow>
                              {showDeepInsights ? (
                                <TableRow
                                  className={cn(
                                    "border-0 hover:bg-transparent",
                                    isDark ? "border-white/10" : "",
                                  )}
                                >
                                  <TableCell colSpan={9} className="p-0 pt-1 pb-3">
                                    <Collapsible className="group">
                                      <CollapsibleTrigger
                                        className={cn(
                                          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                                          isDark
                                            ? "bg-white/[0.06] text-slate-200 hover:bg-white/10"
                                            : "bg-slate-100 text-slate-800 hover:bg-slate-200/80",
                                        )}
                                      >
                                        <span>Post-level insights (Business API)</span>
                                        <ChevronDown className="h-4 w-4 shrink-0 opacity-70 transition-transform group-data-[state=open]:rotate-180" />
                                      </CollapsibleTrigger>
                                      <CollapsibleContent className="px-3 pt-3 space-y-3">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                                          <div className={cn("rounded-md p-2", isDark ? "bg-white/[0.04]" : "bg-slate-50")}>
                                            <div className="text-muted-foreground">Full-view rate</div>
                                            <div className="font-semibold tabular-nums">
                                              {(m.fullVideoWatchedRate <= 1
                                                ? m.fullVideoWatchedRate * 100
                                                : m.fullVideoWatchedRate
                                              ).toFixed(2)}
                                              %
                                            </div>
                                          </div>
                                          <div className={cn("rounded-md p-2", isDark ? "bg-white/[0.04]" : "bg-slate-50")}>
                                            <div className="text-muted-foreground">Favorites</div>
                                            <div className="font-semibold tabular-nums">
                                              {formatInt(m.favorites)}
                                            </div>
                                          </div>
                                          <div className={cn("rounded-md p-2", isDark ? "bg-white/[0.04]" : "bg-slate-50")}>
                                            <div className="text-muted-foreground">New followers</div>
                                            <div className="font-semibold tabular-nums">
                                              {formatInt(m.newFollowers)}
                                            </div>
                                          </div>
                                          <div className={cn("rounded-md p-2", isDark ? "bg-white/[0.04]" : "bg-slate-50")}>
                                            <div className="text-muted-foreground">Profile views</div>
                                            <div className="font-semibold tabular-nums">
                                              {formatInt(m.profileViews)}
                                            </div>
                                          </div>
                                        </div>
                                        {(m.websiteClicks > 0 ||
                                          m.phoneNumberClicks > 0 ||
                                          m.leadSubmissions > 0 ||
                                          m.appDownloadClicks > 0 ||
                                          m.emailClicks > 0 ||
                                          m.addressClicks > 0) && (
                                          <div
                                            className={cn(
                                              "grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] rounded-lg border p-2",
                                              isDark ? "border-white/10" : "border-slate-200",
                                            )}
                                          >
                                            {m.websiteClicks > 0 && (
                                              <div>
                                                <span className="text-muted-foreground">Website clicks </span>
                                                <span className="font-semibold tabular-nums">{formatInt(m.websiteClicks)}</span>
                                              </div>
                                            )}
                                            {m.phoneNumberClicks > 0 && (
                                              <div>
                                                <span className="text-muted-foreground">Phone clicks </span>
                                                <span className="font-semibold tabular-nums">{formatInt(m.phoneNumberClicks)}</span>
                                              </div>
                                            )}
                                            {m.leadSubmissions > 0 && (
                                              <div>
                                                <span className="text-muted-foreground">Leads </span>
                                                <span className="font-semibold tabular-nums">{formatInt(m.leadSubmissions)}</span>
                                              </div>
                                            )}
                                            {m.appDownloadClicks > 0 && (
                                              <div>
                                                <span className="text-muted-foreground">App download clicks </span>
                                                <span className="font-semibold tabular-nums">{formatInt(m.appDownloadClicks)}</span>
                                              </div>
                                            )}
                                            {m.emailClicks > 0 && (
                                              <div>
                                                <span className="text-muted-foreground">Email clicks </span>
                                                <span className="font-semibold tabular-nums">{formatInt(m.emailClicks)}</span>
                                              </div>
                                            )}
                                            {m.addressClicks > 0 && (
                                              <div>
                                                <span className="text-muted-foreground">Address clicks </span>
                                                <span className="font-semibold tabular-nums">{formatInt(m.addressClicks)}</span>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        {(m.mediaType || m.videoDurationSec > 0) && (
                                          <p className="text-[11px] text-muted-foreground">
                                            {m.mediaType ? <>Type: {m.mediaType}</> : null}
                                            {m.mediaType && m.videoDurationSec > 0 ? " · " : null}
                                            {m.videoDurationSec > 0 ? (
                                              <>Length: {m.videoDurationSec.toFixed(1)}s</>
                                            ) : null}
                                          </p>
                                        )}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          {impressionRows.length > 0 && (
                                            <InsightBreakdownTable
                                              title="Traffic sources"
                                              rows={impressionRows}
                                              labelKey="impression_source"
                                              isDark={isDark}
                                            />
                                          )}
                                          {genderRows.length > 0 && (
                                            <InsightBreakdownTable
                                              title="Audience — gender"
                                              rows={genderRows}
                                              labelKey="gender"
                                              isDark={isDark}
                                            />
                                          )}
                                          {countryRows.length > 0 && (
                                            <InsightBreakdownTable
                                              title="Audience — top countries"
                                              rows={countryRows}
                                              labelKey="country"
                                              isDark={isDark}
                                            />
                                          )}
                                          {cityRows.length > 0 && (
                                            <InsightBreakdownTable
                                              title="Audience — top cities"
                                              rows={cityRows}
                                              labelKey="city_name"
                                              isDark={isDark}
                                            />
                                          )}
                                          {typeRows.length > 0 && (
                                            <InsightBreakdownTable
                                              title="Audience — viewer types"
                                              rows={typeRows}
                                              labelKey="type"
                                              isDark={isDark}
                                            />
                                          )}
                                        </div>
                                        {retentionRows.length > 0 && (
                                          <InsightBreakdownTable
                                            title="View retention (by second)"
                                            rows={retentionRows.slice(0, 30)}
                                            labelKey="second"
                                            isDark={isDark}
                                          />
                                        )}
                                        {likeTimingRows.length > 0 && (
                                          <InsightBreakdownTable
                                            title="Engagement likes (by second in video)"
                                            rows={likeTimingRows.slice(0, 30)}
                                            labelKey="second"
                                            isDark={isDark}
                                          />
                                        )}
                                        <p className="text-[10px] text-muted-foreground leading-snug">
                                          Some metrics update on a 24–48h delay and may be empty if the post
                                          had no activity for 7+ days or lacks permissions in your TikTok app.
                                        </p>
                                      </CollapsibleContent>
                                    </Collapsible>
                                  </TableCell>
                                </TableRow>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {!data.hasMarketingAccount && (
                  <p className="text-xs text-amber-700 dark:text-amber-300/90 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    Per TikTok&apos;s published Display API video object, only views, likes,
                    comments, and shares are guaranteed from the creator&apos;s TikTok login
                    connection. Saves, reach, and watch time require TikTok Marketing access
                    and depend on what your TCM/report endpoints actually return.
                  </p>
                )}
              </div>

              <Separator className={isDark ? "bg-white/10" : ""} />

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Audience demographics</h3>
                <p className="text-xs text-muted-foreground">
                  Requires TikTok Business / Marketing connection with audience insights.
                </p>
              </div>
            </>
          )}

          {!loading && data?.hasMarketingAccount && demographics && (
            <div className="space-y-8">
              <div
                className={cn(
                  "flex items-center gap-2 p-3 rounded-xl text-xs",
                  isDark ? "bg-white/5 text-slate-400" : "bg-slate-50 text-slate-500",
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                Last updated:{" "}
                {data.lastSyncedAt
                  ? new Date(data.lastSyncedAt).toLocaleString()
                  : "Never"}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DemographicCard
                  title="Gender"
                  icon={<User className="h-4 w-4" />}
                  rows={demographics.audience_gender || []}
                  isDark={isDark}
                  hint="Distribution of audience by gender."
                />
                <DemographicCard
                  title="Age Range"
                  icon={<Users className="h-4 w-4" />}
                  rows={demographics.audience_age || []}
                  isDark={isDark}
                  hint="Distribution of audience by age range."
                />
                <DemographicCard
                  title="Top Countries"
                  icon={<Globe className="h-4 w-4" />}
                  rows={demographics.audience_country || []}
                  isDark={isDark}
                  hint="Top locations of the audience by country."
                />
                <DemographicCard
                  title="Devices"
                  icon={<Layout className="h-4 w-4" />}
                  rows={demographics.audience_device || []}
                  isDark={isDark}
                  hint="Distribution of devices used by the audience."
                />
              </div>
            </div>
          )}

          {!loading && data?.hasMarketingAccount && !demographics && (
            <div className="py-12 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center p-8">
              <div className="bg-slate-100 text-slate-400 p-4 rounded-full mb-4">
                <Users className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No demographics data</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                TikTok has not returned audience breakdowns yet. Try &quot;Refresh from TikTok&quot; or check
                again later if the audience is small.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DemographicCard({
  title,
  icon,
  rows,
  isDark,
  hint
}: {
  title: string;
  icon: React.ReactNode;
  rows: TikTokDemographicRow[];
  isDark?: boolean;
  hint: string;
}) {
  return (
    <div className={cn(
      "rounded-2xl p-4 space-y-4 border",
      isDark ? "bg-white/[0.04] border-white/10" : "bg-slate-50/80 border-slate-200"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-1.5 rounded-lg",
            isDark ? "bg-purple-500/20 text-purple-400" : "bg-purple-100 text-purple-600"
          )}>
            {icon}
          </div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="text-xs max-w-[200px]">
                {hint}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="space-y-3">
        {rows.length > 0 ? (
          rows.sort((a,b) => b.distribution - a.distribution).map((row, i) => (
            <div key={row.dimension_value} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium truncate max-w-[150px]" title={row.dimension_value}>
                  {formatLabel(row.dimension_value)}
                </span>
                <span className="font-bold tabular-nums">
                  {(row.distribution * 100).toFixed(1)}%
                </span>
              </div>
              <div className={cn(
                "h-2 w-full rounded-full overflow-hidden",
                isDark ? "bg-white/10" : "bg-slate-200"
              )}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${row.distribution * 100}%`,
                    backgroundColor: i % 2 === 0 ? TIKTOK_AQUA : TIKTOK_PINK
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground italic py-4 text-center">No data available</p>
        )}
      </div>
    </div>
  );
}

function formatLabel(label: string): string {
  // TikTok gender labels can be 'Male', 'Female', etc.
  // Age can be '18-24', etc.
  // Country can be ISO codes or full names.
  if (label === "M") return "Male";
  if (label === "F") return "Female";
  if (label === "O") return "Other";
  
  // Try to use Intl for country names if it looks like a 2-letter code
  if (label.length === 2 && label === label.toUpperCase()) {
    try {
      const regionName = new Intl.DisplayNames(['en'], {type: 'region'}).of(label);
      if (regionName) return regionName;
    } catch {}
  }
  
  return label;
}
