"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign, Filter, Trophy, Info, Share2, Users } from "lucide-react";
import { User, UserResponse } from "@supabase/supabase-js";
import { formatMoney } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Define types for filters and sorting
type StatusFilterType = 'all' | 'live' | 'upcoming';
type PlatformFilterType = 'all' | 'youtube' | 'instagram'; // Add more as needed
type ContestTypeFilterType = 'all' | 'leaderboard' | 'cpm';
type SortOptionType = 'newest_first' | 'end_date_asc' | 'value_high_low' | 'cpm_rate_high_low';

export default function OpportunitiesPage({
  user,
}: {
  user: UserResponse["data"]["user"];
}) {
  const [availableContests, setAvailableContests] = useState<any[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  // New state variables for filters and sorting
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilterType>('all');
  const [typeFilter, setTypeFilter] = useState<ContestTypeFilterType>('all');
  const [sortOption, setSortOption] = useState<SortOptionType>('newest_first');
  const [displayedContests, setDisplayedContests] = useState<any[]>([]);

  useEffect(() => {
    if (!user) {
      console.log(
        "OpportunitiesPage: No user found after auth load, redirecting to signin."
      );
      router.push("/");
      return;
    }

    async function fetchData(currentUser: User) {
      setIsFetchingData(true);

      try {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("user_type")
          .eq("id", currentUser.id)
          .single();

        if (userError) {
          console.error("Error fetching user type:", userError);
          setIsFetchingData(false);
          setAvailableContests([]);
          return;
        }

        if (userData?.user_type === "advertiser") {
          console.log(
            "OpportunitiesPage: Advertiser detected, redirecting to contests."
          );
          router.push("/dashboard/contests");
          return;
        }

        const { data: contests, error: contestError } = await supabase
          .from("contests_with_status")
          .select("*")
          .not("status", "eq", "draft")
          .not("status", "eq", "incomplete")
          .order("created_at", { ascending: false });

        if (contestError) {
          console.error("Error fetching contests:", contestError);
          setAvailableContests([]);
        } else {
          setAvailableContests(contests || []);
        }
      } catch (error) {
        console.error("Unexpected error in fetchData:", error);
        setAvailableContests([]);
      } finally {
        setIsFetchingData(false);
      }
    }

    fetchData(user);
  }, [user, router, supabase]);

  // useEffect for filtering and sorting
  useEffect(() => {
    let contestsToDisplay = [...availableContests];

    // Status Filter
    if (statusFilter !== 'all') {
      contestsToDisplay = contestsToDisplay.filter(contest => {
        if (statusFilter === 'live') return contest.status === 'active';
        if (statusFilter === 'upcoming') return contest.status === 'upcoming';
        return true; // Should not happen if logic is correct
      });
    }

    // Platform Filter
    if (platformFilter !== 'all') {
      contestsToDisplay = contestsToDisplay.filter(
        (contest) => contest.platform?.toLowerCase() === platformFilter
      );
    }

    // Contest Type Filter
    if (typeFilter !== 'all') {
      contestsToDisplay = contestsToDisplay.filter(
        (contest) => contest.contest_type === typeFilter
      );
    }

    // Sorting
    contestsToDisplay.sort((a, b) => {
      switch (sortOption) {
        case 'newest_first':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'end_date_asc':
          if (!a.end_date) return 1;
          if (!b.end_date) return -1;
          return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
        case 'value_high_low': // Combined Prize/Budget
          let valueA = 0;
          let valueB = 0;
          if (a.contest_type === 'leaderboard' && a.contest_based_details?.leaderboard_contest?.total_prize) {
            valueA = a.contest_based_details.leaderboard_contest.total_prize;
          } else if (a.contest_type === 'cpm' && a.contest_based_details?.cpm_contest?.total_budget) {
            valueA = a.contest_based_details.cpm_contest.total_budget;
          }
          if (b.contest_type === 'leaderboard' && b.contest_based_details?.leaderboard_contest?.total_prize) {
            valueB = b.contest_based_details.leaderboard_contest.total_prize;
          } else if (b.contest_type === 'cpm' && b.contest_based_details?.cpm_contest?.total_budget) {
            valueB = b.contest_based_details.cpm_contest.total_budget;
          }
          return valueB - valueA;
        case 'cpm_rate_high_low': // CPM
          const rateA = a.contest_type === 'cpm' && a.contest_based_details?.cpm_contest?.cpm_rate_usd ? a.contest_based_details.cpm_contest.cpm_rate_usd : 0;
          const rateB = b.contest_type === 'cpm' && b.contest_based_details?.cpm_contest?.cpm_rate_usd ? b.contest_based_details.cpm_contest.cpm_rate_usd : 0;
          return rateB - rateA;
        default:
          return 0;
      }
    });

    setDisplayedContests(contestsToDisplay);
  }, [availableContests, statusFilter, platformFilter, typeFilter, sortOption]);

  const handleViewDetails = (id: string) => {
    router.push(`/dashboard/opportunities/${id}`);
  };

  if (isFetchingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p>Loading opportunities...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          You need to be logged in to view opportunities.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Opportunities</h1>
        {/* Filters and Sorters will go here - Old filter button removed */}
      </div>

      {/* Status Filter Tabs */}
      <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilterType)} className="mb-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filter and Sort Select Dropdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Platform Filter */}
        <Select value={platformFilter} onValueChange={(value) => setPlatformFilter(value as PlatformFilterType)}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            {/* Add more platforms as needed */}
          </SelectContent>
        </Select>

        {/* Contest Type Filter */}
        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as ContestTypeFilterType)}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Contest Types</SelectItem>
            <SelectItem value="leaderboard">Leaderboard</SelectItem>
            <SelectItem value="cpm">CPM</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort By */}
        <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOptionType)}>
          <SelectTrigger>
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest_first">Newest First</SelectItem>
            <SelectItem value="end_date_asc">End Date (Soonest)</SelectItem>
            <SelectItem value="value_high_low">Prize/Budget (High to Low)</SelectItem>
            <SelectItem value="cpm_rate_high_low">CPM Rate (High to Low)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {displayedContests && displayedContests.length > 0 ? (
          displayedContests.map((contest) => (
            <Card
              key={contest.id}
              className="overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out border border-slate-200 dark:border-slate-700 flex flex-col group bg-white dark:bg-slate-850 hover:border-rose-500 dark:hover:border-rose-500"
            >
              <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                {contest.thumbnail_url ? (
                  <img
                    src={contest.thumbnail_url || "/placeholder.svg"}
                    alt={contest.title}
                    className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
                  />
                ) : (
                  <Trophy className="h-16 w-16 text-slate-400 dark:text-slate-500" />
                )}
              </div>
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start mb-1">
                  <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors duration-300 mr-2 leading-tight">
                    {contest.title}
                  </CardTitle>
                  <div className="flex flex-shrink-0 space-x-1.5">
                    <Badge
                      className={cn(
                        "capitalize text-xs px-2 py-1 font-medium",
                        contest.status === "active" && "bg-green-500 border-green-500 text-white",
                        contest.status === "upcoming" && "bg-blue-500 border-blue-500 text-white",
                        contest.status === "ended" && "bg-slate-500 border-slate-500 text-white",
                        !["active", "upcoming", "ended"].includes(contest.status) && "bg-yellow-400 border-yellow-400 text-yellow-900"
                      )}
                    >
                      {contest.status}
                    </Badge>
                    {contest.contest_type && (
                      <Badge
                        variant={contest.contest_type === 'cpm' ? "secondary" : "default"}
                        className="capitalize text-xs px-2 py-1 font-medium border"
                      >
                        {contest.contest_type === 'cpm' ? 'CPM' : 'Leaderboard'}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 flex-grow flex flex-col justify-between">
                <div className="space-y-2 text-sm mb-3">
                  {contest.platform && (
                    <div className="flex items-center text-slate-500 dark:text-slate-400">
                      <Share2 className="h-4 w-4 mr-2 flex-shrink-0 text-rose-500" />
                      <span>Platform: <span className="font-semibold text-slate-700 dark:text-slate-300 capitalize">{contest.platform}</span></span>
                    </div>
                  )}
                  <div className="flex items-center text-slate-500 dark:text-slate-400">
                    <Calendar className="h-4 w-4 mr-2 flex-shrink-0 text-rose-500" />
                    <span>
                      Ends:
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {contest.end_date
                          ? `${new Date(contest.end_date).toLocaleDateString()}`
                          : "N/A"}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center text-slate-500 dark:text-slate-400">
                    <DollarSign className="h-4 w-4 mr-2 flex-shrink-0 text-rose-500" />
                    <span className="text-md">
                      {contest.contest_type === 'cpm' && contest.contest_based_details?.cpm_contest ? (
                        <>Budget: <span className="font-bold text-slate-800 dark:text-slate-100">{formatMoney(contest.contest_based_details.cpm_contest.total_budget * 100)}</span></>
                      ) : contest.contest_type === 'leaderboard' && contest.contest_based_details?.leaderboard_contest ? (
                        <>Prize Pool: <span className="font-bold text-slate-800 dark:text-slate-100">{formatMoney(contest.contest_based_details.leaderboard_contest.total_prize)}</span></>
                      ) : contest.total_prize ? (
                        <>Prize Pool: <span className="font-bold text-slate-800 dark:text-slate-100">{formatMoney(contest.total_prize || 0)}</span></>
                      ) : (
                        <>Budget/Prize: <span className="font-bold text-slate-800 dark:text-slate-100">N/A</span></>
                      )}
                    </span>
                  </div>
                  {/* Display CPM Rate for CPM contests */}
                  {contest.contest_type === 'cpm' && contest.contest_based_details?.cpm_contest?.cpm_rate_usd != null && (
                    <div className="flex items-center text-slate-500 dark:text-slate-400">
                      <DollarSign className="h-4 w-4 mr-2 flex-shrink-0 text-rose-500" /> {/* Re-using DollarSign, consider a different one if available/better */}
                      <span>CPM Rate: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatMoney(contest.contest_based_details.cpm_contest.cpm_rate_usd * 100)} / 1k views</span></span>
                    </div>
                  )}
                  {/* Display Total Submissions for Leaderboard contests */}
                  {/* {contest.contest_type === 'leaderboard' && contest.live_submission_count != null && (
                    <div className="flex items-center text-slate-500 dark:text-slate-400">
                      <Users className="h-4 w-4 mr-2 flex-shrink-0 text-rose-500" />
                      <span>Submissions: <span className="font-semibold text-slate-700 dark:text-slate-300">{contest.live_submission_count}</span></span>
                    </div>
                  )} */}
                  {contest.contest_type && (
                    <div className="flex items-center text-slate-500 dark:text-slate-400">
                      <Info className="h-4 w-4 mr-2 flex-shrink-0 text-rose-500" />
                      <span>Type: <span className="font-semibold text-slate-700 dark:text-slate-300 capitalize">{contest.contest_type === 'cpm' ? 'CPM Based' : 'Leaderboard'}</span></span>
                    </div>
                  )}
                </div>
                {/* Budget Spent Progress Bar for CPM contests */}
                {contest.contest_type === 'cpm' && contest.contest_based_details?.cpm_contest?.total_budget != null && contest.contest_based_details.cpm_contest.total_budget > 0 && (
                  <div className="mt-2 mb-3">
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                      <span>Spent: {formatMoney((contest.budget_spent || 0) * 100)}</span>
                      <span>{(((contest.budget_spent || 0) / contest.contest_based_details.cpm_contest.total_budget) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-rose-500 h-2 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(((contest.budget_spent || 0) / contest.contest_based_details.cpm_contest.total_budget) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                <div className="pt-2 mt-auto"> {/* Ensure button is at the bottom */}
                  <Button
                    className="w-full font-semibold bg-rose-600 hover:bg-rose-700 text-white dark:bg-rose-500 dark:hover:bg-rose-600 transition-colors duration-200 py-2.5"
                    onClick={() => handleViewDetails(contest.id)}
                  >
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <Trophy className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-medium mb-2">No contests match your criteria</h2>
            <p className="text-muted-foreground mb-4">
              Try adjusting your filters or check back later.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
