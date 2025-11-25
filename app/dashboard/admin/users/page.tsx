"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  EnhancedTabs,
  EnhancedTabsList,
  EnhancedTabsTrigger,
  EnhancedTabsContent,
} from "@/components/ui/enhanced-tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Settings, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type AdvertiserProfile = {
  id: string;
  company_name?: string | null;
  website_url?: string | null;
  total_money_spent?: number | null;
  total_contests_run?: number | null;
  available_deposit_balance?: number | null;
  withdrawable_balance?: number | null;
  subscription_info?: any | null;
};

type CreatorProfile = {
  id: string;
  youtube_account?: any | null;
  instagram_account?: any | null;
  total_contests_participated?: number | null;
  total_contests_won?: number | null;
  total_views?: number | null;
  total_money_won?: number | null;
  withdrawable_balance?: number | null;
  total_submissions_made?: number | null;
  total_submissions_won?: number | null;
  date_of_birth?: string | null;
  gender?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  address?: string | null;
  languages?: string[] | any | null;
  categories?: any | null;
  subcategories?: any | null;
  interests?: string[] | any | null;
};

type User = {
  id: string;
  email: string;
  username?: string | null;
  full_name: string;
  user_type: string;
  is_active: boolean;
  coins: number;
  created_at: string;
  updated_at: string;
  profile_picture_url?: string | null;
  referral_code?: string | null;
  referred_by?: string | null;
  advertisers_referred?: number | null;
  creators_referred?: number | null;
  total_lifetime_coins_earned?: number | null;
  email_confirmed_at?: string | null;
  ip_address?: string | null;
  affiliate_earnings?: number | null;
  other_earnings?: number | null;
  // Supabase may return this as an array or a single object depending on the relationship
  advertiser_profiles?: AdvertiserProfile[] | AdvertiserProfile | null;
  creator_profiles?: CreatorProfile[] | CreatorProfile | null;
};

function SubcategoriesCell({
  subcategories,
  onViewAll,
}: {
  subcategories: string[];
  onViewAll: (subcategories: any, categories: any) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [showMoreButton, setShowMoreButton] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && contentRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const contentWidth = contentRef.current.scrollWidth;
        // Add some padding for the "More" button (approximately 60px)
        setShowMoreButton(contentWidth > containerWidth - 60);
      }
    };

    // Check after a short delay to ensure content is rendered
    const timeoutId = setTimeout(checkOverflow, 0);

    // Re-check on window resize
    window.addEventListener("resize", checkOverflow);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", checkOverflow);
    };
  }, [subcategories]);

  if (subcategories.length === 0) {
    return <div>-</div>;
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap items-center gap-1 w-full"
    >
      <span
        ref={contentRef}
        className={`text-sm ${showMoreButton ? "truncate flex-1 min-w-0" : ""}`}
        style={showMoreButton ? { maxWidth: "calc(100% - 10px)" } : {}}
      >
        {subcategories.join(", ")}
      </span>
      {showMoreButton && (
        <Button
          variant="ghost"
          size="sm"
          className="text-purple-600 underlineh-6 px-2 text-xs flex-shrink-0"
          onClick={() => onViewAll(subcategories, null)}
        >
          More
        </Button>
      )}
    </div>
  );
}

function InterestsCell({
  interests,
  onViewAll,
}: {
  interests: string[];
  onViewAll: (interests: any) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [showMoreButton, setShowMoreButton] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && contentRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const contentWidth = contentRef.current.scrollWidth;
        // Add some padding for the "More" button (approximately 60px)
        setShowMoreButton(contentWidth > containerWidth - 60);
      }
    };

    // Check after a short delay to ensure content is rendered
    const timeoutId = setTimeout(checkOverflow, 0);

    // Re-check on window resize
    window.addEventListener("resize", checkOverflow);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", checkOverflow);
    };
  }, [interests]);

  if (interests.length === 0) {
    return <div>-</div>;
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap items-center gap-1 w-full"
    >
      <span
        ref={contentRef}
        className={`text-sm ${showMoreButton ? "truncate flex-1 min-w-0" : ""}`}
        style={showMoreButton ? { maxWidth: "calc(100% - 60px)" } : {}}
      >
        {interests.join(", ")}
      </span>
      {showMoreButton && (
        <Button
          variant="ghost"
          size="sm"
          className="text-purple-600 h-6 px-2 text-xs underline flex-shrink-0"
          onClick={() => onViewAll(interests)}
        >
          More
        </Button>
      )}
    </div>
  );
}

// Column definitions for each tab
const allColumns = {
  all: [
    { id: "id", label: "ID" },
    { id: "full_name", label: "Full Name" },
    { id: "profile", label: "Profile" },
    { id: "email", label: "Email" },
    { id: "user_type", label: "User Type" },
    { id: "referral_code", label: "Referral Code" },
    { id: "referred_by", label: "Referred By" },
    { id: "coins", label: "Coins" },
    { id: "advertisers_referred", label: "Advertisers Referred" },
    { id: "creators_referred", label: "Creators Referred" },
    { id: "username", label: "Username" },
    { id: "total_lifetime_coins", label: "Total Lifetime Coins" },
    { id: "affiliate_earnings", label: "Affiliate Earnings" },
    { id: "other_earnings", label: "Other Earnings" },
  ],
  advertisers: [
    { id: "id", label: "ID" },
    { id: "full_name", label: "Full Name" },
    { id: "profile", label: "Profile" },
    { id: "email", label: "Email" },
    { id: "username", label: "Username" },
    { id: "company_name", label: "Company Name" },
    { id: "website_url", label: "Website URL" },
    { id: "total_money_spent", label: "Total Money Spent" },
    { id: "total_contests_run", label: "Total Contests Run" },
    { id: "available_deposit_balance", label: "Available Deposit Balance" },
    { id: "withdrawable_balance", label: "Withdrawable Balance" },
    { id: "subscription_info", label: "Subscription Info" },
  ],
  creators: [
    { id: "id", label: "ID" },
    { id: "full_name", label: "Full Name" },
    { id: "profile", label: "Profile" },
    { id: "email", label: "Email" },
    { id: "username", label: "Username" },
    { id: "youtube_account", label: "YouTube Account" },
    { id: "instagram_account", label: "Instagram Account" },
    { id: "contests_participated", label: "Contests Participated" },
    { id: "contests_won", label: "Contests Won" },
    { id: "total_views", label: "Total Views" },
    { id: "total_money_won", label: "Total Money Won" },
    { id: "withdrawable_balance", label: "Withdrawable Balance" },
    { id: "total_submissions_made", label: "Total Submissions Made" },
    { id: "total_submissions_won", label: "Total Submissions Won" },
    { id: "date_of_birth", label: "Date of Birth" },
    { id: "gender", label: "Gender" },
    { id: "country", label: "Country" },
    { id: "state", label: "State" },
    { id: "city", label: "City" },
    { id: "address", label: "Address" },
    { id: "language", label: "Language" },
    { id: "categories", label: "Categories" },
    { id: "subcategories", label: "Subcategories" },
    { id: "interests", label: "Interests" },
  ],
};

export default function AdminUsersPage() {
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedSubscriptionInfo, setSelectedSubscriptionInfo] = useState<
    any | null
  >(null);
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] =
    useState(false);
  const [selectedSubcategories, setSelectedSubcategories] = useState<
    any | null
  >(null);
  const [selectedCategories, setSelectedCategories] = useState<any | null>(
    null
  );
  const [isSubcategoriesDialogOpen, setIsSubcategoriesDialogOpen] =
    useState(false);
  const [selectedInterests, setSelectedInterests] = useState<any | null>(null);
  const [isInterestsDialogOpen, setIsInterestsDialogOpen] = useState(false);

  // Column visibility state - initialize all columns as visible
  const [visibleColumns, setVisibleColumns] = useState<
    Record<string, Set<string>>
  >({
    all: new Set(allColumns.all.map((col) => col.id)),
    advertisers: new Set(allColumns.advertisers.map((col) => col.id)),
    creators: new Set(allColumns.creators.map((col) => col.id)),
  });
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  // Toggle column visibility
  const toggleColumn = (columnId: string) => {
    setVisibleColumns((prev) => {
      const newState = { ...prev };
      const currentSet = new Set(newState[activeTab]);
      if (currentSet.has(columnId)) {
        currentSet.delete(columnId);
      } else {
        currentSet.add(columnId);
      }
      newState[activeTab] = currentSet;
      return newState;
    });
  };

  // Check if column is visible
  const isColumnVisible = (columnId: string) => {
    return visibleColumns[activeTab]?.has(columnId) ?? true;
  };

  // Get count of visible columns for current tab
  const getVisibleColumnsCount = () => {
    return (
      visibleColumns[activeTab]?.size ??
      allColumns[activeTab as keyof typeof allColumns].length
    );
  };

  // Filter by tab
  const tabFiltered = useMemo(() => {
    if (activeTab === "all") return rows;
    if (activeTab === "advertisers") {
      // Show all users with user_type === "advertiser"
      // advertiser_profiles data will be shown when available
      return rows.filter((r) => r.user_type === "advertiser");
    }
    if (activeTab === "creators") {
      return rows.filter((r) => r.user_type === "creator");
    }
    return rows;
  }, [rows, activeTab]);

  // Calculate counts for each tab
  const allUsersCount = rows.length;
  const advertisersCount = rows.filter(
    (r) => r.user_type === "advertiser"
  ).length;
  const creatorsCount = rows.filter((r) => r.user_type === "creator").length;

  // Paginated data
  const paginatedData = useMemo(() => {
    const start = (page - 1) * limit;
    const end = start + limit;
    return tabFiltered.slice(start, end);
  }, [tabFiltered, page, limit]);

  const totalPages = Math.ceil(tabFiltered.length / limit);
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  // Reset to page 1 when tab changes
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/users`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch");
      setRows(json.items || []);
    } catch (e) {
      console.error("Error loading users:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Users Management</CardTitle>
            <Button
              variant="outline"
              onClick={() => setShowColumnSettings(true)}
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Customize Tiles
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <EnhancedTabs value={activeTab} onValueChange={setActiveTab}>
            <EnhancedTabsList>
              <EnhancedTabsTrigger value="all">
                All Users
                <Badge variant="secondary" className="ml-2">
                  {allUsersCount}
                </Badge>
              </EnhancedTabsTrigger>
              <EnhancedTabsTrigger value="advertisers">
                Advertisers
                <Badge variant="secondary" className="ml-2">
                  {advertisersCount}
                </Badge>
              </EnhancedTabsTrigger>
              <EnhancedTabsTrigger value="creators">
                Creators
                <Badge variant="secondary" className="ml-2">
                  {creatorsCount}
                </Badge>
              </EnhancedTabsTrigger>
            </EnhancedTabsList>
          </EnhancedTabs>
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  {isColumnVisible("id") && (
                    <TableHead className="whitespace-nowrap border-r">
                      ID
                    </TableHead>
                  )}
                  {isColumnVisible("full_name") && (
                    <TableHead className="whitespace-nowrap border-r">
                      Full Name
                    </TableHead>
                  )}
                  {isColumnVisible("profile") && (
                    <TableHead className="whitespace-nowrap border-r">
                      Profile
                    </TableHead>
                  )}
                  {isColumnVisible("email") && (
                    <TableHead className="whitespace-nowrap border-r">
                      Email
                    </TableHead>
                  )}
                  {activeTab === "advertisers" && (
                    <>
                      {isColumnVisible("username") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Username
                        </TableHead>
                      )}
                      {isColumnVisible("company_name") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Company Name
                        </TableHead>
                      )}
                      {isColumnVisible("website_url") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Website URL
                        </TableHead>
                      )}
                      {isColumnVisible("total_money_spent") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Total Money Spent
                        </TableHead>
                      )}
                      {isColumnVisible("total_contests_run") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Total Contests Run
                        </TableHead>
                      )}
                      {isColumnVisible("available_deposit_balance") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Available Deposit Balance
                        </TableHead>
                      )}
                      {isColumnVisible("withdrawable_balance") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Withdrawable Balance
                        </TableHead>
                      )}
                      {isColumnVisible("subscription_info") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Subscription Info
                        </TableHead>
                      )}
                    </>
                  )}
                  {activeTab === "creators" && (
                    <>
                      {isColumnVisible("username") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Username
                        </TableHead>
                      )}
                      {isColumnVisible("youtube_account") && (
                        <TableHead className="whitespace-nowrap border-r">
                          YouTube Account
                        </TableHead>
                      )}
                      {isColumnVisible("instagram_account") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Instagram Account
                        </TableHead>
                      )}
                      {isColumnVisible("contests_participated") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Contests Participated
                        </TableHead>
                      )}
                      {isColumnVisible("contests_won") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Contests Won
                        </TableHead>
                      )}
                      {isColumnVisible("total_views") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Total Views
                        </TableHead>
                      )}
                      {isColumnVisible("total_money_won") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Total Money Won
                        </TableHead>
                      )}
                      {isColumnVisible("withdrawable_balance") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Withdrawable Balance
                        </TableHead>
                      )}
                      {isColumnVisible("total_submissions_made") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Total Submissions Made
                        </TableHead>
                      )}
                      {isColumnVisible("total_submissions_won") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Total Submissions Won
                        </TableHead>
                      )}
                      {isColumnVisible("date_of_birth") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Date of Birth
                        </TableHead>
                      )}
                      {isColumnVisible("gender") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Gender
                        </TableHead>
                      )}
                      {isColumnVisible("country") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Country
                        </TableHead>
                      )}
                      {isColumnVisible("state") && (
                        <TableHead className="whitespace-nowrap border-r">
                          State
                        </TableHead>
                      )}
                      {isColumnVisible("city") && (
                        <TableHead className="whitespace-nowrap border-r">
                          City
                        </TableHead>
                      )}
                      {isColumnVisible("address") && (
                        <TableHead className="whitespace-nowrap border-r min-w-[250px] max-w-md">
                          Address
                        </TableHead>
                      )}
                      {isColumnVisible("language") && (
                        <TableHead className="whitespace-nowrap border-r min-w-[150px] max-w-sm">
                          Language
                        </TableHead>
                      )}
                      {isColumnVisible("categories") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Categories
                        </TableHead>
                      )}
                      {isColumnVisible("subcategories") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Subcategories
                        </TableHead>
                      )}
                      {isColumnVisible("interests") && (
                        <TableHead className="whitespace-nowrap">
                          Interests
                        </TableHead>
                      )}
                    </>
                  )}
                  {activeTab !== "advertisers" && activeTab !== "creators" && (
                    <>
                      {isColumnVisible("user_type") && (
                        <TableHead className="whitespace-nowrap border-r">
                          User Type
                        </TableHead>
                      )}
                      {isColumnVisible("referral_code") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Referral Code
                        </TableHead>
                      )}
                      {isColumnVisible("referred_by") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Referred By
                        </TableHead>
                      )}
                      {isColumnVisible("coins") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Coins
                        </TableHead>
                      )}
                      {isColumnVisible("advertisers_referred") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Advertisers Referred
                        </TableHead>
                      )}
                      {isColumnVisible("creators_referred") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Creators Referred
                        </TableHead>
                      )}
                      {isColumnVisible("username") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Username
                        </TableHead>
                      )}
                      {isColumnVisible("total_lifetime_coins") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Total Lifetime Coins
                        </TableHead>
                      )}
                      {isColumnVisible("affiliate_earnings") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Affiliate Earnings
                        </TableHead>
                      )}
                      {isColumnVisible("other_earnings") && (
                        <TableHead className="whitespace-nowrap">
                          Other Earnings
                        </TableHead>
                      )}
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={getVisibleColumnsCount()}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg
                          className="animate-spin h-5 w-5 text-muted-foreground"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        <span>Loading users...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : tabFiltered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={getVisibleColumnsCount()}
                      className="text-center text-sm text-muted-foreground"
                    >
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((r) => {
                    // Supabase returns advertiser_profiles as an object (one-to-one) or null
                    // But it might also return as an array in some cases, so handle both
                    const advertiserProfile = Array.isArray(
                      r.advertiser_profiles
                    )
                      ? r.advertiser_profiles.length > 0
                        ? r.advertiser_profiles[0]
                        : null
                      : r.advertiser_profiles || null;
                    // Handle both array and object cases for creator_profiles
                    const creatorProfile = Array.isArray(r.creator_profiles)
                      ? r.creator_profiles.length > 0
                        ? r.creator_profiles[0]
                        : null
                      : r.creator_profiles || null;
                    return (
                      <TableRow key={r.id}>
                        {isColumnVisible("id") && (
                          <TableCell className="font-mono text-xs whitespace-nowrap border-r">
                            {r.id}
                          </TableCell>
                        )}
                        {isColumnVisible("full_name") && (
                          <TableCell className="whitespace-nowrap border-r">
                            {r.full_name}
                          </TableCell>
                        )}
                        {isColumnVisible("profile") && (
                          <TableCell className="whitespace-nowrap border-r">
                            <Avatar className="w-10 h-10">
                              <AvatarImage
                                src={r.profile_picture_url || undefined}
                                alt={r.full_name}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                              <AvatarFallback className="text-xs">
                                {r.full_name?.[0]?.toUpperCase() ||
                                  r.email?.[0]?.toUpperCase() ||
                                  "?"}
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                        )}
                        {isColumnVisible("email") && (
                          <TableCell className="whitespace-nowrap border-r">
                            {r.email}
                          </TableCell>
                        )}
                        {activeTab === "advertisers" ? (
                          <>
                            {isColumnVisible("username") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {r.username || "N/A"}
                              </TableCell>
                            )}
                            {isColumnVisible("company_name") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {advertiserProfile?.company_name || "-"}
                              </TableCell>
                            )}
                            {isColumnVisible("website_url") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {advertiserProfile?.website_url ? (
                                  <a
                                    href={advertiserProfile.website_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                  >
                                    {advertiserProfile.website_url}
                                  </a>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                            )}
                            {isColumnVisible("total_money_spent") && (
                              <TableCell className="whitespace-nowrap border-r">
                                $
                                {(
                                  (advertiserProfile?.total_money_spent || 0) /
                                  100
                                ).toFixed(2)}
                              </TableCell>
                            )}
                            {isColumnVisible("total_contests_run") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {advertiserProfile?.total_contests_run || 0}
                              </TableCell>
                            )}
                            {isColumnVisible("available_deposit_balance") && (
                              <TableCell className="whitespace-nowrap border-r">
                                $
                                {(
                                  (advertiserProfile?.available_deposit_balance ||
                                    0) / 100
                                ).toFixed(2)}
                              </TableCell>
                            )}
                            {isColumnVisible("withdrawable_balance") && (
                              <TableCell className="whitespace-nowrap border-r">
                                $
                                {(
                                  (advertiserProfile?.withdrawable_balance ||
                                    0) / 100
                                ).toFixed(2)}
                              </TableCell>
                            )}
                            {isColumnVisible("subscription_info") && (
                              <TableCell className="whitespace-nowrap">
                                {advertiserProfile?.subscription_info ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedSubscriptionInfo(
                                        advertiserProfile.subscription_info
                                      );
                                      setIsSubscriptionDialogOpen(true);
                                    }}
                                  >
                                    View Details
                                  </Button>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                            )}
                          </>
                        ) : activeTab === "creators" ? (
                          <>
                            {isColumnVisible("username") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {r.username || "N/A"}
                              </TableCell>
                            )}
                            {isColumnVisible("youtube_account") && (
                              <TableCell className="border-r min-w-[200px]">
                                {(() => {
                                  const ytAccount =
                                    creatorProfile?.youtube_account;
                                  if (!ytAccount) return "-";
                                  try {
                                    const account =
                                      typeof ytAccount === "string"
                                        ? JSON.parse(ytAccount)
                                        : ytAccount;
                                    return (
                                      <div className="space-y-1">
                                        <div className="font-medium text-sm">
                                          {account?.channel_title || "YouTube"}
                                        </div>
                                        {account?.subscriber_count && (
                                          <div className="text-xs text-muted-foreground">
                                            {account.subscriber_count.toLocaleString()}{" "}
                                            subscribers
                                          </div>
                                        )}
                                        {account?.video_count && (
                                          <div className="text-xs text-muted-foreground">
                                            {account.video_count.toLocaleString()}{" "}
                                            videos
                                          </div>
                                        )}
                                      </div>
                                    );
                                  } catch {
                                    return (
                                      <Badge variant="secondary">
                                        Connected
                                      </Badge>
                                    );
                                  }
                                })()}
                              </TableCell>
                            )}
                            {isColumnVisible("instagram_account") && (
                              <TableCell className="min-w-[200px] border-r">
                                {(() => {
                                  const igAccount =
                                    creatorProfile?.instagram_account;
                                  if (!igAccount) return "-";
                                  try {
                                    const account =
                                      typeof igAccount === "string"
                                        ? JSON.parse(igAccount)
                                        : igAccount;
                                    return (
                                      <div className="space-y-1">
                                        <div className="font-medium text-sm">
                                          {account?.name_of_account ||
                                            account?.username ||
                                            "Instagram"}
                                        </div>
                                        {account?.username && (
                                          <div className="text-xs text-muted-foreground">
                                            @{account.username}
                                          </div>
                                        )}
                                        {account?.followers_count !==
                                          undefined && (
                                          <div className="text-xs text-muted-foreground">
                                            {account.followers_count.toLocaleString()}{" "}
                                            followers
                                          </div>
                                        )}
                                        {account?.account_type && (
                                          <div className="text-xs text-muted-foreground">
                                            {account.account_type}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  } catch {
                                    return (
                                      <Badge variant="secondary">
                                        Connected
                                      </Badge>
                                    );
                                  }
                                })()}
                              </TableCell>
                            )}
                            {isColumnVisible("contests_participated") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {creatorProfile?.total_contests_participated ||
                                  0}
                              </TableCell>
                            )}
                            {isColumnVisible("contests_won") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {creatorProfile?.total_contests_won || 0}
                              </TableCell>
                            )}
                            {isColumnVisible("total_views") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {creatorProfile?.total_views?.toLocaleString() ||
                                  0}
                              </TableCell>
                            )}
                            {isColumnVisible("total_money_won") && (
                              <TableCell className="whitespace-nowrap border-r">
                                $
                                {(
                                  (creatorProfile?.total_money_won || 0) / 100
                                ).toFixed(2)}
                              </TableCell>
                            )}
                            {isColumnVisible("withdrawable_balance") && (
                              <TableCell className="whitespace-nowrap border-r">
                                $
                                {(
                                  (creatorProfile?.withdrawable_balance || 0) /
                                  100
                                ).toFixed(2)}
                              </TableCell>
                            )}
                            {isColumnVisible("total_submissions_made") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {creatorProfile?.total_submissions_made || 0}
                              </TableCell>
                            )}
                            {isColumnVisible("total_submissions_won") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {creatorProfile?.total_submissions_won || 0}
                              </TableCell>
                            )}
                            {isColumnVisible("date_of_birth") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {creatorProfile?.date_of_birth
                                  ? new Date(
                                      creatorProfile.date_of_birth
                                    ).toLocaleDateString()
                                  : "-"}
                              </TableCell>
                            )}
                            {isColumnVisible("gender") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {creatorProfile?.gender || "-"}
                              </TableCell>
                            )}
                            {isColumnVisible("country") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {creatorProfile?.country || "-"}
                              </TableCell>
                            )}
                            {isColumnVisible("state") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {creatorProfile?.state || "-"}
                              </TableCell>
                            )}
                            {isColumnVisible("city") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {creatorProfile?.city || "-"}
                              </TableCell>
                            )}
                            {isColumnVisible("address") && (
                              <TableCell className="border-r min-w-[250px] max-w-md">
                                <div className="break-words">
                                  {creatorProfile?.address || "-"}
                                </div>
                              </TableCell>
                            )}
                            {isColumnVisible("language") && (
                              <TableCell className="border-r min-w-[150px] max-w-sm">
                                <div className="break-words">
                                  {Array.isArray(creatorProfile?.languages)
                                    ? creatorProfile.languages.join(", ")
                                    : creatorProfile?.languages || "-"}
                                </div>
                              </TableCell>
                            )}
                            {isColumnVisible("categories") && (
                              <TableCell className="whitespace-nowrap border-r max-w-xs">
                                <div className="truncate">
                                  {creatorProfile?.categories
                                    ? Array.isArray(creatorProfile.categories)
                                      ? creatorProfile.categories.join(", ")
                                      : typeof creatorProfile.categories ===
                                        "string"
                                      ? creatorProfile.categories
                                      : JSON.stringify(
                                          creatorProfile.categories
                                        )
                                    : "-"}
                                </div>
                              </TableCell>
                            )}
                            {isColumnVisible("subcategories") && (
                              <TableCell className="border-r max-w-xs">
                                {(() => {
                                  const subcategories =
                                    creatorProfile?.subcategories;
                                  if (!subcategories) return <div>-</div>;

                                  let subcategoriesArray: string[] = [];
                                  if (Array.isArray(subcategories)) {
                                    subcategoriesArray = subcategories;
                                  } else if (
                                    typeof subcategories === "string"
                                  ) {
                                    // Try to parse if it's a JSON string, otherwise split by comma
                                    try {
                                      const parsed = JSON.parse(subcategories);
                                      subcategoriesArray = Array.isArray(parsed)
                                        ? parsed
                                        : [subcategories];
                                    } catch {
                                      subcategoriesArray = subcategories
                                        .split(",")
                                        .map((s) => s.trim());
                                    }
                                  } else {
                                    subcategoriesArray = [
                                      JSON.stringify(subcategories),
                                    ];
                                  }

                                  return (
                                    <SubcategoriesCell
                                      subcategories={subcategoriesArray}
                                      onViewAll={(subcats, cats) => {
                                        setSelectedSubcategories(
                                          creatorProfile?.subcategories
                                        );
                                        setSelectedCategories(
                                          creatorProfile?.categories
                                        );
                                        setIsSubcategoriesDialogOpen(true);
                                      }}
                                    />
                                  );
                                })()}
                              </TableCell>
                            )}
                            {isColumnVisible("interests") && (
                              <TableCell className="border-r max-w-xs">
                                {(() => {
                                  const interests = creatorProfile?.interests;
                                  if (!interests) return <div>-</div>;

                                  let interestsArray: string[] = [];
                                  if (Array.isArray(interests)) {
                                    interestsArray = interests;
                                  } else if (typeof interests === "string") {
                                    // Try to parse if it's a JSON string, otherwise split by comma
                                    try {
                                      const parsed = JSON.parse(interests);
                                      interestsArray = Array.isArray(parsed)
                                        ? parsed
                                        : [interests];
                                    } catch {
                                      interestsArray = interests
                                        .split(",")
                                        .map((s) => s.trim());
                                    }
                                  } else {
                                    interestsArray = [
                                      JSON.stringify(interests),
                                    ];
                                  }

                                  return (
                                    <InterestsCell
                                      interests={interestsArray}
                                      onViewAll={(interestsList) => {
                                        setSelectedInterests(
                                          creatorProfile?.interests
                                        );
                                        setIsInterestsDialogOpen(true);
                                      }}
                                    />
                                  );
                                })()}
                              </TableCell>
                            )}
                          </>
                        ) : (
                          <>
                            {isColumnVisible("user_type") && (
                              <TableCell className="whitespace-nowrap border-r">
                                <Badge
                                  variant={
                                    r.user_type === "admin"
                                      ? "destructive"
                                      : r.user_type === "advertiser"
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {r.user_type}
                                </Badge>
                              </TableCell>
                            )}
                            {isColumnVisible("referral_code") && (
                              <TableCell className="font-mono text-xs whitespace-nowrap border-r">
                                {r.referral_code || "-"}
                              </TableCell>
                            )}
                            {isColumnVisible("referred_by") && (
                              <TableCell className="font-mono text-xs whitespace-nowrap border-r">
                                {r.referred_by || "-"}
                              </TableCell>
                            )}
                            {isColumnVisible("coins") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {r.coins || 0}
                              </TableCell>
                            )}
                            {isColumnVisible("advertisers_referred") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {r.advertisers_referred || 0}
                              </TableCell>
                            )}
                            {isColumnVisible("creators_referred") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {r.creators_referred || 0}
                              </TableCell>
                            )}
                            {isColumnVisible("username") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {r.username || "N/A"}
                              </TableCell>
                            )}
                            {isColumnVisible("total_lifetime_coins") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {r.total_lifetime_coins_earned || 0}
                              </TableCell>
                            )}
                            {isColumnVisible("affiliate_earnings") && (
                              <TableCell className="whitespace-nowrap border-r">
                                $
                                {((r.affiliate_earnings || 0) / 100).toFixed(2)}
                              </TableCell>
                            )}
                            {isColumnVisible("other_earnings") && (
                              <TableCell className="whitespace-nowrap">
                                ${((r.other_earnings || 0) / 100).toFixed(2)}
                              </TableCell>
                            )}
                          </>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {!loading && tabFiltered.length > 0 && (
            <div className="mt-4">
              <PaginationControls
                page={page}
                limit={limit}
                total={tabFiltered.length}
                totalPages={totalPages}
                hasNextPage={hasNextPage}
                hasPreviousPage={hasPreviousPage}
                onPageChange={setPage}
                onLimitChange={setLimit}
                loading={loading}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Column Customization Dialog */}
      <Dialog open={showColumnSettings} onOpenChange={setShowColumnSettings}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customize Columns</DialogTitle>
            <DialogDescription>
              Select which columns to display in the{" "}
              {activeTab === "all"
                ? "All Users"
                : activeTab === "advertisers"
                ? "Advertisers"
                : "Creators"}{" "}
              table. Click on a column to toggle its visibility.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {allColumns[activeTab as keyof typeof allColumns].map(
                (column) => {
                  const isVisible = isColumnVisible(column.id);
                  return (
                    <div
                      key={column.id}
                      className={cn(
                        "p-3 border rounded-lg cursor-pointer transition-all",
                        isVisible
                          ? "bg-purple-50 border-purple-200 text-gray-900"
                          : "border-gray-300 hover:bg-gray-100 text-gray-700"
                      )}
                      onClick={() => toggleColumn(column.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-4 h-4 rounded border-2 flex items-center justify-center",
                            isVisible
                              ? "bg-purple-600 border-purple-600"
                              : "border-gray-400"
                          )}
                        >
                          {isVisible && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span className="text-sm font-medium">
                          {column.label}
                        </span>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isSubscriptionDialogOpen}
        onOpenChange={setIsSubscriptionDialogOpen}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subscription Information</DialogTitle>
            <DialogDescription>
              Detailed subscription information for this advertiser
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {selectedSubscriptionInfo ? (
              <div className="bg-muted p-4 rounded-lg">
                <pre className="text-xs overflow-auto whitespace-pre-wrap break-words">
                  {JSON.stringify(selectedSubscriptionInfo, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="text-muted-foreground">
                No subscription information available
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isSubcategoriesDialogOpen}
        onOpenChange={setIsSubcategoriesDialogOpen}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subcategories</DialogTitle>
            <DialogDescription>
              Complete list of subcategories for this creator
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {(() => {
              // Parse and organize subcategories by category
              let subcategoriesByCategory: Record<string, string[]> = {};
              let flatSubcategories: string[] = [];

              if (selectedSubcategories) {
                // Handle different formats
                if (Array.isArray(selectedSubcategories)) {
                  selectedSubcategories.forEach((item: any) => {
                    if (typeof item === "object" && item !== null) {
                      // Format: {category: string, subcategory: string}
                      if (item.category && item.subcategory) {
                        if (!subcategoriesByCategory[item.category]) {
                          subcategoriesByCategory[item.category] = [];
                        }
                        if (
                          !subcategoriesByCategory[item.category].includes(
                            item.subcategory
                          )
                        ) {
                          subcategoriesByCategory[item.category].push(
                            item.subcategory
                          );
                        }
                      } else {
                        // Could be a different object format, add as flat
                        flatSubcategories.push(JSON.stringify(item));
                      }
                    } else if (typeof item === "string") {
                      flatSubcategories.push(item);
                    }
                  });
                } else if (typeof selectedSubcategories === "object") {
                  // Format: Record<string, string[]> (object with category keys)
                  subcategoriesByCategory = selectedSubcategories as Record<
                    string,
                    string[]
                  >;
                } else if (typeof selectedSubcategories === "string") {
                  // Try to parse JSON string
                  try {
                    const parsed = JSON.parse(selectedSubcategories);
                    if (Array.isArray(parsed)) {
                      parsed.forEach((item: any) => {
                        if (
                          typeof item === "object" &&
                          item?.category &&
                          item?.subcategory
                        ) {
                          if (!subcategoriesByCategory[item.category]) {
                            subcategoriesByCategory[item.category] = [];
                          }
                          if (
                            !subcategoriesByCategory[item.category].includes(
                              item.subcategory
                            )
                          ) {
                            subcategoriesByCategory[item.category].push(
                              item.subcategory
                            );
                          }
                        } else {
                          flatSubcategories.push(String(item));
                        }
                      });
                    } else if (typeof parsed === "object") {
                      subcategoriesByCategory = parsed;
                    }
                  } catch {
                    flatSubcategories.push(selectedSubcategories);
                  }
                }
              }

              // Parse categories if available
              let categoriesList: string[] = [];
              if (selectedCategories) {
                if (Array.isArray(selectedCategories)) {
                  categoriesList = selectedCategories.filter(
                    (cat) => typeof cat === "string"
                  );
                } else if (typeof selectedCategories === "string") {
                  try {
                    const parsed = JSON.parse(selectedCategories);
                    if (Array.isArray(parsed)) {
                      categoriesList = parsed.filter(
                        (cat) => typeof cat === "string"
                      );
                    }
                  } catch {
                    categoriesList = [selectedCategories];
                  }
                }
              }

              // Get all unique category names
              const allCategories = Array.from(
                new Set([
                  ...categoriesList,
                  ...Object.keys(subcategoriesByCategory),
                ])
              );

              const hasOrganizedSubcategories =
                Object.keys(subcategoriesByCategory).length > 0;
              const hasFlatSubcategories = flatSubcategories.length > 0;
              const totalCount =
                Object.values(subcategoriesByCategory).reduce(
                  (sum, arr) => sum + arr.length,
                  0
                ) + flatSubcategories.length;

              if (!hasOrganizedSubcategories && !hasFlatSubcategories) {
                return (
                  <p className="text-muted-foreground">
                    No subcategories available
                  </p>
                );
              }

              return (
                <div className="space-y-6">
                  {/* Summary */}
                  <div>
                    <span className="text-sm font-medium">
                      Total: {totalCount} subcategories
                    </span>
                  </div>

                  {/* Subcategories organized by category */}
                  {hasOrganizedSubcategories && (
                    <div className="space-y-4">
                      {allCategories.map((category) => {
                        const subcats = subcategoriesByCategory[category];
                        if (!subcats || subcats.length === 0) return null;

                        return (
                          <div key={category} className="space-y-2">
                            <h3 className="text-base font-semibold text-foreground capitalize">
                              {category}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {subcats.map((subcat, index) => (
                                <Badge
                                  key={index}
                                  variant="secondary"
                                  className="text-sm py-1.5 px-3 font-normal"
                                >
                                  {subcat}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Flat subcategories (if any that couldn't be organized) */}
                  {hasFlatSubcategories && (
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold text-foreground">
                        Other Subcategories
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {flatSubcategories.map((subcat, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="text-sm py-1.5 px-3 font-normal"
                          >
                            {subcat}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isInterestsDialogOpen}
        onOpenChange={setIsInterestsDialogOpen}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All Interests</DialogTitle>
            <DialogDescription>
              Complete list of interests for this creator
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {(() => {
              let interestsArray: string[] = [];

              if (selectedInterests) {
                if (Array.isArray(selectedInterests)) {
                  interestsArray = selectedInterests.filter(
                    (item: any) => typeof item === "string"
                  );
                } else if (typeof selectedInterests === "string") {
                  try {
                    const parsed = JSON.parse(selectedInterests);
                    if (Array.isArray(parsed)) {
                      interestsArray = parsed.filter(
                        (item: any) => typeof item === "string"
                      );
                    } else {
                      interestsArray = [selectedInterests];
                    }
                  } catch {
                    interestsArray = selectedInterests
                      .split(",")
                      .map((s) => s.trim());
                  }
                }
              }

              const totalCount = interestsArray.length;

              if (totalCount === 0) {
                return (
                  <p className="text-muted-foreground">
                    No interests available
                  </p>
                );
              }

              return (
                <div className="space-y-6">
                  {/* Summary */}
                  <div>
                    <span className="text-sm font-medium">
                      Total: {totalCount} interests
                    </span>
                  </div>

                  {/* Interests as badges */}
                  <div className="flex flex-wrap gap-2">
                    {interestsArray.map((interest, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="text-sm py-1.5 px-3 font-normal"
                      >
                        {interest}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
