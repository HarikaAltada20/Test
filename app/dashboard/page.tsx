"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  Plus,
  HelpCircle,
  Eye,
  Coins,
  Loader2,
  Gift,
  Megaphone,
  Wallet,
} from "lucide-react";
import { cn, formatLocalDateTime } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useClientAuth } from "@/hooks/use-client-auth";
import { createClient } from "@/utils/supabase/client";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { sumAdvertiserCampaignViews } from "@/lib/brand-dashboard-pc-views";
import { fetchEndedContestPaidCentsById } from "@/lib/brand-recognized-spend";
import {
  computeBrandDashboardContestStats,
  type BrandDashboardContest,
} from "@/lib/brand-dashboard-stats";
import { getAllTimeRange } from "@/lib/admin-date-range";
import { ContestCreationModal } from "@/components/ContestCreationModal";
import { useContestCreation } from "@/hooks/use-contest-creation";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
import GettingStartedModal from "@/components/GettingStartedModal";
import { ReferralEarnModal } from "@/components/ReferralEarnModal";
import { DashboardStatCard } from "@/components/dashboard/DashboardStatCard";
import { AdminDateRangePicker } from "@/components/admin/AdminDateRangePicker";

function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const {
    user,
    isLoading: isAuthLoading,
    isAuthenticated,
  } = useClientAuth({
    redirectTo: "/auth/signin",
  });
  const [profile, setProfile] = useState<any>(null);
  const [recentContests, setRecentContests] = useState<any[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [userCoins, setUserCoins] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [hasProcessedSuccess, setHasProcessedSuccess] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [brandContests, setBrandContests] = useState<BrandDashboardContest[]>(
    [],
  );
  const [dateRange, setDateRange] = useState(() => getAllTimeRange());
  const [datePresetLabel, setDatePresetLabel] = useState("All Time");
  const [brandEndedPaidById, setBrandEndedPaidById] = useState<
    Map<string, number>
  >(() => new Map());
  const [brandViews, setBrandViews] = useState(0);
  const [brandStatsLoading, setBrandStatsLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const { handleCreateContest } = useContestCreation(user?.id);
  const [showPopup, setShowPopup] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [viewButtonsLoading, setViewButtonsLoading] = useState<
    Record<string, boolean>
  >({});
  const [mode, setMode] = useState<"light" | "dark">("light");

  const isAllTimePreset = datePresetLabel === "All Time";
  const statsBadge = isAllTimePreset ? "All time" : datePresetLabel;
  const dateFilter = isAllTimePreset ? null : dateRange;

  // Read mode from data attribute
  useEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode) {
          setMode(currentMode);
        }
      }
    };

    checkMode();

    // Watch for changes in the data attribute
    const observer = new MutationObserver(checkMode);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => observer.disconnect();
  }, []);

  // Handle checkout success - with protection against infinite loops
  useEffect(() => {
    const success = searchParams.get("success");
    const sessionId = searchParams.get("session_id");

    if (success === "true" && sessionId && user && !hasProcessedSuccess) {
      console.log(
        "🎉 Payment successful in dashboard, refreshing profile data...",
      );
      setHasProcessedSuccess(true);

      // Clear URL parameters to prevent refresh loops
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);

      // Refresh profile data after a short delay to allow webhook processing
      const refreshProfileData = async () => {
        try {
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Refetch the profile data to get updated subscription info
          if (user.user_type === "advertiser") {
            const { data: advertiserProfile } = await supabase
              .from("advertiser_profiles")
              .select("*, subscription_info")
              .eq("id", user.id)
              .single();

            if (advertiserProfile) {
              setProfile(advertiserProfile);
              console.log("✅ Profile data refreshed after checkout");
            }
          }
        } catch (error) {
          console.error("Error refreshing profile data:", error);
        }
      };

      refreshProfileData();
    }
  }, [searchParams, user, supabase, hasProcessedSuccess]);

  // Effect to auto-open WelcomePopup ONLY once after login
  useEffect(() => {
    if (
      profile &&
      "company_name" in profile && // ✅ advertiser check
      (!profile?.total_contests_run || profile.total_contests_run === 0) // ✅ no contests
    ) {
      // ✅ Check if user already saw the popup
      const hasSeenPopup = localStorage.getItem("gettingStartedPopupShown");

      if (!hasSeenPopup) {
        setShowPopup(true); // ✅ Open popup first time
        localStorage.setItem("gettingStartedPopupShown", "true"); // ✅ Mark as seen
      }
    }
  }, [profile]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      if (!user) {
        console.warn("DashboardPage: Fetch attempt skipped, no user found.");
        if (isMounted) setIsFetchingData(false);
        return;
      }

      if (isMounted) setIsFetchingData(true);

      try {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("user_type, coins, email, username, full_name, referral_code")
          .eq("id", user.id)
          .single();

        if (!isMounted) return;

        if (userError) {
          console.error(
            "Error fetching user data:",
            userError.message,
            userError.details,
          );
          if (isMounted) setIsFetchingData(false);
          return;
        }

        const userType = userData?.user_type;
        setUserCoins(userData?.coins || 0);

        setUsername(userData?.username || null);
        setReferralCode(userData?.referral_code || userData?.username || null);

        if (userType === "advertiser") {
          // Fetch advertiser profile
          const { data: advertiserProfile, error: profileError } =
            await supabase
              .from("advertiser_profiles")
              .select("*, subscription_info")
              .eq("id", user.id)
              .single();

          if (!isMounted) return;
          if (profileError) {
            console.error(
              "Error fetching advertiser profile:",
              profileError.message,
              profileError.details,
            );
          }

          // Contests with computed live/upcoming/ended status for dashboard stats
          const { data: contests, error: contestsError } = await supabase
            .from("contests_with_status")
            .select(
              "id, title, platform, thumbnail_url, created_at, published_at, moderation_status, status, post_contest_status, contest_type, contest_based_details, post_campaign_last_synced_at",
            )
            .eq("advertiser_id", user.id);

          if (!isMounted) return;
          if (contestsError) {
            console.error("Error fetching contests:", contestsError);
          }

          const contestRows = (contests ?? []) as BrandDashboardContest[];

          // Same exact ended-campaign payouts the billing page uses, so Spend matches
          const endedPaidById = await fetchEndedContestPaidCentsById(
            supabase,
            contestRows.filter(
              (c) =>
                c.moderation_status === "published" && c.status === "ended",
            ),
          );
          if (!isMounted) return;
          setBrandContests(contestRows);
          setBrandEndedPaidById(endedPaidById);

          const stats = computeBrandDashboardContestStats(
            contestRows,
            null,
            endedPaidById,
          );
          setProfile({
            ...advertiserProfile,
            // All campaigns incl. drafts: drives the getting-started prompt
            total_contests_run: contestRows.length,
            total_money_spent: stats.budgetSpendCents,
          });

          const recent = [...contestRows]
            .sort(
              (a, b) =>
                new Date(b.created_at || 0).getTime() -
                new Date(a.created_at || 0).getTime(),
            )
            .slice(0, 3);
          setRecentContests(recent);
        } else if (userType === "creator") {
          const { data: creatorProfile, error: profileError } = await supabase
            .from("creator_profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (!isMounted) return;
          if (profileError) {
            console.error(
              "Error fetching creator profile:",
              profileError.message,
              profileError.details,
            );
          } else {
            setProfile(creatorProfile);
          }

          const { data: recentRows, error: recentError } = await supabase.rpc(
            "creator_dashboard_recent_activity",
          );

          if (!isMounted) return;
          if (recentError) {
            console.error(
              "Error fetching creator recent activity:",
              recentError,
            );
            setRecentContests([]);
          } else {
            setRecentContests((recentRows as any[]) || []);
          }
        } else if (userType === "admin") {
          // Redirect admin users to their dedicated admin dashboard
          router.push("/dashboard/admin");
          return;
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        if (isMounted) {
          setIsFetchingData(false);
        }
      }
    }

    if (isAuthenticated && !isAuthLoading) {
      fetchData();
    } else if (!isAuthLoading && !isAuthenticated) {
      setIsFetchingData(false);
    }

    return () => {
      isMounted = false;
    };
  }, [user, isAuthLoading, isAuthenticated, supabase, router]);

  useEffect(() => {
    if (!isAuthenticated || isAuthLoading || isFetchingData) return;
    if (!profile || !("company_name" in profile)) return;

    let cancelled = false;
    setBrandStatsLoading(true);
    void sumAdvertiserCampaignViews(supabase, brandContests, dateFilter).then(
      ({ totalViews, error }) => {
        if (cancelled) return;
        if (error) console.error("Error fetching campaign views:", error);
        setBrandViews(totalViews);
        setBrandStatsLoading(false);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated,
    isAuthLoading,
    isFetchingData,
    profile,
    supabase,
    brandContests,
    dateFilter,
  ]);

  // Guidelines check moved to opportunities page for creators

  if (isAuthLoading || isFetchingData) {
    return (
      <div className="flex items-center justify-center h-[76vh]">
        <PageLoadingSpinner mode="light" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="text-center p-8">
        Please sign in to view the dashboard.
      </div>
    );
  }

  const handleCreateContestClick = async () => {
    setLoading(true);
    const shouldShowModal = await handleCreateContest();
    if (shouldShowModal) {
      setShowModal(true);
      setLoading(false);
    }
  };

  const isAdvertiser = profile && "company_name" in profile;
  const isDark = mode === "dark";
  const brandContestStats = computeBrandDashboardContestStats(
    brandContests,
    dateFilter,
    brandEndedPaidById,
  );
  const paidSharePercent =
    brandContestStats.budgetSpendCents > 0
      ? Math.min(
          100,
          Math.round(
            (brandContestStats.paidCents / brandContestStats.budgetSpendCents) *
              100,
          ),
        )
      : 0;

  return (
    <div className="space-y-8 bg-background text-foreground transition-colors duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2
          className={cn(
            "w-full pl-2 text-2xl font-bold tracking-tight sm:w-auto text-left md:text-3xl",
            isDark ? "text-white" : "text-slate-900",
          )}
        >
          Dashboard
        </h2>
        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
          {isAdvertiser && (
            <AdminDateRangePicker
              isDark={isDark}
              value={dateRange}
              presetLabel={datePresetLabel}
              onChange={(next, label) => {
                setDateRange(next);
                setDatePresetLabel(label);
              }}
              align="end"
              triggerClassName="h-10 w-full rounded-full sm:w-auto"
            />
          )}
          <button
            onClick={() => setIsReferralModalOpen(true)}
            className={cn(
              "inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium sm:w-auto",
              isDark
                ? "bg-white text-[#1a1a1a] hover:bg-white/90"
                : "bg-[#1a1a1a] text-white hover:bg-black",
            )}
          >
            <Gift className="h-4 w-4" />
            {isAdvertiser ? "Refer & earn 30% commission" : "Refer and earn upto $100"}
          </button>
          {isAdvertiser && (
            <button
              onClick={handleCreateContestClick}
              disabled={loading}
              className={cn(
                "inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium sm:w-auto disabled:opacity-60",
                isDark
                  ? "border border-white/30 bg-transparent text-white hover:bg-white/10"
                  : "border border-[#d5d5db] bg-white text-[#1a1a1a] hover:bg-[#f6f6f7]",
              )}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Campaign
            </button>
          )}
        </div>
      </div>

      <div
        className={cn(
          "grid gap-4 md:grid-cols-2",
          isAdvertiser ? "lg:grid-cols-3" : "xl:grid-cols-4",
        )}
      >
        {isAdvertiser ? (
          <>
            <DashboardStatCard
              tone="sky"
              icon={Eye}
              label="Views"
              value={brandStatsLoading ? "…" : brandViews.toLocaleString()}
              badge={statsBadge}
              visual="sparkline"
              isDark={isDark}
            />
            <DashboardStatCard
              tone="emerald"
              icon={Wallet}
              label="Spend"
              value={formatCurrencyFromCents(brandContestStats.budgetSpendCents)}
              secondary={{
                label: "Paid to creators",
                value: formatCurrencyFromCents(brandContestStats.paidCents),
              }}
              description={`${paidSharePercent}% of spend paid out on ended campaigns`}
              badge={statsBadge}
              visual="progress"
              progress={paidSharePercent}
              isDark={isDark}
            />
            <DashboardStatCard
              tone="violet"
              icon={Megaphone}
              label="Live campaigns"
              value={String(brandContestStats.liveCampaigns)}
              secondary={{
                label: "Published",
                value: String(brandContestStats.campaignsPublished),
              }}
              badge={statsBadge}
              visual="progress"
              progress={
                brandContestStats.campaignsPublished > 0
                  ? Math.round(
                      (brandContestStats.liveCampaigns /
                        brandContestStats.campaignsPublished) *
                        100,
                    )
                  : 0
              }
              isDark={isDark}
            />
          </>
        ) : (
          <>
            <DashboardStatCard
              tone="sky"
              icon={Eye}
              label="Views"
              value={(profile?.total_views || 0).toLocaleString()}
              description="Views on your content"
              badge="All time"
              visual="sparkline"
              isDark={isDark}
            />
            <DashboardStatCard
              tone="emerald"
              icon={Wallet}
              label="Earnings"
              value={formatCurrencyFromCents(profile?.total_money_won || 0)}
              description="Money earned from campaigns"
              badge="All time"
              visual="progress"
              progress={Math.min(
                100,
                Math.round(((profile?.total_money_won || 0) / 200000) * 100) || 8,
              )}
              isDark={isDark}
            />
            <DashboardStatCard
              tone="amber"
              icon={Trophy}
              label="Campaigns won"
              value={String(profile?.total_contests_won || 0)}
              description={`Out of ${profile?.total_contests_participated || 0} participated`}
              badge="All time"
              visual="progress"
              progress={
                (profile?.total_contests_participated || 0) > 0
                  ? Math.round(
                      ((profile?.total_contests_won || 0) /
                        (profile?.total_contests_participated || 1)) *
                        100,
                    )
                  : 0
              }
              isDark={isDark}
            />
            <DashboardStatCard
              tone="violet"
              icon={Coins}
              label="Available coins"
              value={String(userCoins)}
              description="Coins to redeem or use"
              badge="All time"
              visual="line"
              isDark={isDark}
            />
          </>
        )}
      </div>

      {/* Getting Started Section - Only show for advertisers with no contests */}
      {isAdvertiser &&
        (!profile?.total_contests_run || profile.total_contests_run === 0) && (
          <div
            className={cn(
              "rounded-2xl border",
              isDark
                ? "border-white/10 bg-[#161616]"
                : "border-[#ececef] bg-white",
            )}
          >
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4 sm:items-center">
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                      isDark ? "bg-white/10 text-white" : "bg-[#f3f3f5] text-[#1a1a1a]",
                    )}
                  >
                    <HelpCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3
                      className={cn(
                        "mb-1 text-base font-semibold sm:text-lg",
                        isDark ? "text-white" : "text-[#1a1a1a]",
                      )}
                    >
                      New to Game Of Creators?
                    </h3>
                    <p
                      className={cn(
                        "text-sm sm:text-base",
                        isDark ? "text-white/60" : "text-[#55555E]",
                      )}
                    >
                      Learn about our two campaign types: Leaderboard and CPM
                      campaigns
                    </p>
                  </div>
                </div>
                <Button
                  className={cn(
                    "inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-5 text-[15px] font-medium",
                    isDark
                      ? "bg-white text-[#1a1a1a] hover:bg-white/90"
                      : "bg-[#1a1a1a] text-white hover:bg-black",
                  )}
                  onClick={() => setShowPopup(true)}
                >
                  <HelpCircle className="h-4 w-4" />
                  Get Started
                </Button>
                <GettingStartedModal
                  open={showPopup}
                  onClose={() => setShowPopup(false)}
                />
              </div>
            </CardContent>
          </div>
        )}

      <section
        className={cn(
          "overflow-hidden rounded-2xl border",
          isDark ? "border-white/10 bg-[#161616]" : "border-[#ececef] bg-white",
        )}
      >
        <div
          className={cn(
            "border-b px-5 py-4 sm:px-6",
            isDark ? "border-white/10" : "border-[#ececef]",
          )}
        >
          <h3
            className={cn(
              "text-lg font-semibold tracking-tight",
              isDark ? "text-white" : "text-[#1a1a1a]",
            )}
          >
            Recent Activity
          </h3>
          <p className={cn("mt-0.5 text-sm", isDark ? "text-white/55" : "text-[#8d8d95]")}>
            {isAdvertiser
              ? "Your recent campaigns"
              : "Campaigns you've participated in recently"}
          </p>
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          {recentContests && recentContests.length > 0 ? (
            recentContests.map((contest) => (
              <div
                key={contest.id}
                className={cn(
                  "flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
                  isDark
                    ? "border-white/10 bg-white/[0.03]"
                    : "border-[#ececef] bg-[#fafafa]",
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                  <div
                    className={cn(
                      "h-12 w-12 shrink-0 overflow-hidden rounded-xl sm:h-14 sm:w-14",
                      isDark ? "bg-white/10" : "bg-[#ececef]",
                    )}
                  >
                    {contest.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={contest.thumbnail_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Trophy
                          className={cn(
                            "h-5 w-5",
                            isDark ? "text-white/40" : "text-[#a1a1aa]",
                          )}
                          aria-hidden="true"
                        />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm font-semibold sm:text-base",
                        isDark ? "text-white" : "text-[#1a1a1a]",
                      )}
                    >
                      {contest.title}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-xs sm:text-sm",
                        isDark ? "text-white/50" : "text-[#8d8d95]",
                      )}
                    >
                      {contest.platform}
                      {" · "}
                      {isAdvertiser
                        ? formatLocalDateTime(contest.created_at, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : contest.last_submission_at
                          ? `Last submission ${formatLocalDateTime(
                              contest.last_submission_at,
                            )}`
                          : "Last submission —"}
                    </p>
                  </div>
                </div>

                <Link
                  href={
                    isAdvertiser
                      ? `/dashboard/contests/${contest.id}`
                      : `/dashboard/opportunities/${contest.id}`
                  }
                  className="block w-full shrink-0 sm:w-auto"
                >
                  <button
                    type="button"
                    className={cn(
                      "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full px-5 text-[15px] font-medium sm:w-auto",
                      isDark
                        ? "border border-white/20 bg-transparent text-white hover:bg-white/10"
                        : "border border-[#d5d5db] bg-white text-[#1a1a1a] hover:bg-[#f6f6f7]",
                    )}
                    onClick={() => {
                      setViewButtonsLoading((prev) => ({
                        ...prev,
                        [contest.id]: true,
                      }));
                    }}
                    disabled={viewButtonsLoading[contest.id]}
                  >
                    {viewButtonsLoading[contest.id] ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    View
                  </button>
                </Link>
              </div>
            ))
          ) : (
            <div className="flex min-h-[140px] items-center justify-center px-4 py-8">
              <p
                className={cn(
                  "text-center text-sm",
                  isDark ? "text-white/50" : "text-[#8d8d95]",
                )}
              >
                {isAdvertiser
                  ? "No campaigns created yet"
                  : "No campaign activity yet"}
              </p>
            </div>
          )}
        </div>
      </section>

      <ContestCreationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        userId={user?.id || ""}
      />
      <ReferralEarnModal
        isOpen={isReferralModalOpen}
        onClose={() => setIsReferralModalOpen(false)}
        audience={isAdvertiser ? "advertiser" : "creator"}
        referralCode={referralCode}
        username={username}
      />
    </div>
  );
}

export default DashboardPage;
