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
import {
  Settings,
  X,
  Check,
  ChevronDown,
  Filter,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAllSubscriptionPlans,
  getSubscriptionPlanById,
} from "@/lib/subscription-utils-client";

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
    { id: "created_at", label: "Created At" },
    { id: "updated_at", label: "Updated At" },
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
    { id: "created_at", label: "Created At" },
    { id: "updated_at", label: "Updated At" },
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
    { id: "created_at", label: "Created At" },
    { id: "updated_at", label: "Updated At" },
  ],
};

export default function AdminUsersPage() {
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [activeTab, setActiveTab] = useState("all");
  // Initialize mode state with proper detection to prevent flash
  const [mode, setMode] = useState<"light" | "dark">(() => {
    // Check if we're in browser environment
    if (typeof window !== "undefined") {
      // Try to get theme from data-theme attribute first
      const themeElement = document.documentElement;
      const dataTheme = themeElement.getAttribute("data-theme") as
        | "light"
        | "dark";
      if (dataTheme) return dataTheme;

      // Fallback to data-mode attribute
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const dataMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (dataMode) return dataMode;
      }

      // Check localStorage as last resort
      try {
        const savedMode = localStorage.getItem("dashboard-mode") as
          | "light"
          | "dark";
        if (savedMode) return savedMode;

        const preset = localStorage.getItem("dashboard-preset");
        if (preset === "game-of-creators" || preset === "dark-professional") {
          return "dark";
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }
    return "light";
  });
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
  const [editingUserType, setEditingUserType] = useState<string | null>(null);
  const [updatingUserType, setUpdatingUserType] = useState<string | null>(null);
  const [availableSubscriptionPlans, setAvailableSubscriptionPlans] = useState<
    { id: string; name: string }[]
  >([]);
  // Sort state per tab - each tab maintains its own sort state
  const [sortState, setSortState] = useState<
    Record<string, { column: string | null; order: "asc" | "desc" | null }>
  >({
    all: { column: null, order: null },
    advertisers: { column: null, order: null },
    creators: { column: null, order: null },
  });

  // Load all subscription plans from constants for dropdown filtering
  useEffect(() => {
    const allPlans = getAllSubscriptionPlans();
    const plansArray = allPlans.map((plan: any) => ({
      id: plan.productId || plan.id || "",
      name: plan.displayName || plan.name || plan.id || "Unknown",
    }));
    setAvailableSubscriptionPlans(plansArray);
  }, []);

  // Helper functions to get/set sort state for current tab
  const getSortState = () => {
    return sortState[activeTab] || { column: null, order: null };
  };

  const setSortColumn = (column: string | null) => {
    setSortState((prev) => ({
      ...prev,
      [activeTab]: {
        ...(prev[activeTab] || { column: null, order: null }),
        column,
      },
    }));
  };

  const setSortOrder = (order: "asc" | "desc" | null) => {
    setSortState((prev) => ({
      ...prev,
      [activeTab]: {
        ...(prev[activeTab] || { column: null, order: null }),
        order,
      },
    }));
  };

  const setSort = (column: string | null, order: "asc" | "desc" | null) => {
    setSortState((prev) => ({
      ...prev,
      [activeTab]: {
        column,
        order,
      },
    }));
  };

  // Get current tab's sort values (reactive to sortState and activeTab changes)
  const sortColumn = useMemo(
    () => getSortState().column,
    [sortState, activeTab]
  );
  const sortOrder = useMemo(() => getSortState().order, [sortState, activeTab]);

  // Reusable sortable table header for any column
  const SortableHeader = ({
    columnId,
    label,
    className,
  }: {
    columnId: string;
    label: string;
    className?: string;
  }) => (
    <TableHead
      className={cn(
        "whitespace-nowrap border-r",
        isDark ? "bg-[#391A6A]" : "bg-[#F9FAFB]",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span>{label}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setSortColumn(columnId);
                setSortOrder("asc");
              }}
              className={cn(
                sortColumn === columnId && sortOrder === "asc" && "bg-accent"
              )}
            >
              Sort by Ascending
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSortColumn(columnId);
                setSortOrder("desc");
              }}
              className={cn(
                sortColumn === columnId && sortOrder === "desc" && "bg-accent"
              )}
            >
              Sort by Descending
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSortColumn(null);
                setSortOrder(null);
              }}
            >
              Clear Sort
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TableHead>
  );

  // Column visibility state - initialize all columns as visible
  const [visibleColumns, setVisibleColumns] = useState<
    Record<string, Set<string>>
  >({
    all: new Set(allColumns.all.map((col) => col.id)),
    advertisers: new Set(allColumns.advertisers.map((col) => col.id)),
    creators: new Set(allColumns.creators.map((col) => col.id)),
  });
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [stickyHeader, setStickyHeader] = useState(true);

  // Filter state
  type FilterType = {
    id: string;
    column: string;
    value: string;
    operator?: string; // For comparison operators: "=", ">", "<", ">=", "<="
  };
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<FilterType[]>([]);
  const [emptyFilterColumn, setEmptyFilterColumn] = useState<string>("");
  const [emptyFilterValue, setEmptyFilterValue] = useState<string>("");
  const [emptyFilterOperator, setEmptyFilterOperator] = useState<string>("=");

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

  // Helper for username sorting:
  // Ascending: numbers -> letters/other -> null
  // Descending: letters/other -> numbers -> null.

  const getUsernameSortMeta = (username: string | null | undefined) => {
    if (!username) {
      return { rank: 2, value: "" }; // null/empty last
    }
    const vRaw = username.toLowerCase();
    // Strip leading underscores for comparison
    const v = vRaw.replace(/^_+/, "");
    const firstChar = v.charAt(0);
    const isDigit = /^[0-9]/.test(firstChar);
    const isLetter = /^[a-z]/.test(firstChar);

    // base rank 0 = numeric, 1 = alphabetic/other, 2 = null/empty
    if (isDigit) return { rank: 0, value: v };
    if (isLetter) return { rank: 1, value: v };
    return { rank: 1, value: v };
  };

  const normalizeForAlphabetSort = (value: string | null | undefined) => {
    if (!value) return "";
    const lower = value.toLowerCase();
    // Find the first Unicode letter (covers fancy script letters ).
    const match = lower.match(/\p{L}/u);
    if (!match || match.index === undefined) {
      // No letter found – fall back to the full lowercased string.
      return lower;
    }
    return lower.slice(match.index);
  };

  // Helper function to get column value from a row for filtering
  const getColumnValue = (row: User, columnId: string): any => {
    switch (columnId) {
      case "id":
        return row.id;
      case "full_name":
        return row.full_name;
      case "email":
        return row.email;
      case "username":
        return row.username;
      case "user_type":
        return row.user_type;
      case "referral_code":
        return row.referral_code;
      case "referred_by":
        return row.referred_by;
      case "coins":
        return row.coins;
      case "advertisers_referred":
        return row.advertisers_referred;
      case "creators_referred":
        return row.creators_referred;
      case "total_lifetime_coins":
        return row.total_lifetime_coins_earned;
      case "affiliate_earnings":
        return row.affiliate_earnings;
      case "other_earnings":
        return row.other_earnings;
      case "created_at":
        return row.created_at;
      case "updated_at":
        return row.updated_at;
      // Advertiser-specific columns
      case "company_name":
        if (row.advertiser_profiles) {
          const profiles = Array.isArray(row.advertiser_profiles)
            ? row.advertiser_profiles
            : [row.advertiser_profiles];
          return profiles[0]?.company_name;
        }
        return null;
      case "website_url":
        if (row.advertiser_profiles) {
          const profiles = Array.isArray(row.advertiser_profiles)
            ? row.advertiser_profiles
            : [row.advertiser_profiles];
          return profiles[0]?.website_url;
        }
        return null;
      case "total_money_spent":
        if (row.advertiser_profiles) {
          const profiles = Array.isArray(row.advertiser_profiles)
            ? row.advertiser_profiles
            : [row.advertiser_profiles];
          return profiles[0]?.total_money_spent;
        }
        return null;
      case "total_contests_run":
        if (row.advertiser_profiles) {
          const profiles = Array.isArray(row.advertiser_profiles)
            ? row.advertiser_profiles
            : [row.advertiser_profiles];
          return profiles[0]?.total_contests_run;
        }
        return null;
      case "available_deposit_balance":
        if (row.advertiser_profiles) {
          const profiles = Array.isArray(row.advertiser_profiles)
            ? row.advertiser_profiles
            : [row.advertiser_profiles];
          return profiles[0]?.available_deposit_balance;
        }
        return null;
      case "withdrawable_balance":
        if (row.advertiser_profiles) {
          const profiles = Array.isArray(row.advertiser_profiles)
            ? row.advertiser_profiles
            : [row.advertiser_profiles];
          return profiles[0]?.withdrawable_balance;
        }
        // Check creator profiles too
        if (row.creator_profiles) {
          const profiles = Array.isArray(row.creator_profiles)
            ? row.creator_profiles
            : [row.creator_profiles];
          return profiles[0]?.withdrawable_balance;
        }
        return null;
      case "subscription_info":
        if (row.advertiser_profiles) {
          const profiles = Array.isArray(row.advertiser_profiles)
            ? row.advertiser_profiles
            : [row.advertiser_profiles];
          return profiles[0]?.subscription_info;
        }
        return null;
      // Creator-specific columns
      case "contests_participated":
        if (row.creator_profiles) {
          const profiles = Array.isArray(row.creator_profiles)
            ? row.creator_profiles
            : [row.creator_profiles];
          return profiles[0]?.total_contests_participated;
        }
        return null;
      case "contests_won":
        if (row.creator_profiles) {
          const profiles = Array.isArray(row.creator_profiles)
            ? row.creator_profiles
            : [row.creator_profiles];
          return profiles[0]?.total_contests_won;
        }
        return null;
      case "total_views":
        if (row.creator_profiles) {
          const profiles = Array.isArray(row.creator_profiles)
            ? row.creator_profiles
            : [row.creator_profiles];
          return profiles[0]?.total_views;
        }
        return null;
      case "total_money_won":
        if (row.creator_profiles) {
          const profiles = Array.isArray(row.creator_profiles)
            ? row.creator_profiles
            : [row.creator_profiles];
          return profiles[0]?.total_money_won;
        }
        return null;
      case "total_submissions_made":
        if (row.creator_profiles) {
          const profiles = Array.isArray(row.creator_profiles)
            ? row.creator_profiles
            : [row.creator_profiles];
          return profiles[0]?.total_submissions_made;
        }
        return null;
      case "total_submissions_won":
        if (row.creator_profiles) {
          const profiles = Array.isArray(row.creator_profiles)
            ? row.creator_profiles
            : [row.creator_profiles];
          return profiles[0]?.total_submissions_won;
        }
        return null;
      case "date_of_birth":
        if (row.creator_profiles) {
          const profiles = Array.isArray(row.creator_profiles)
            ? row.creator_profiles
            : [row.creator_profiles];
          return profiles[0]?.date_of_birth;
        }
        return null;
      case "gender":
        if (row.creator_profiles) {
          const profiles = Array.isArray(row.creator_profiles)
            ? row.creator_profiles
            : [row.creator_profiles];
          return profiles[0]?.gender;
        }
        return null;
      case "country":
        if (row.creator_profiles) {
          const profiles = Array.isArray(row.creator_profiles)
            ? row.creator_profiles
            : [row.creator_profiles];
          return profiles[0]?.country;
        }
        return null;
      case "state":
        if (row.creator_profiles) {
          const profiles = Array.isArray(row.creator_profiles)
            ? row.creator_profiles
            : [row.creator_profiles];
          return profiles[0]?.state;
        }
        return null;
      case "city":
        if (row.creator_profiles) {
          const profiles = Array.isArray(row.creator_profiles)
            ? row.creator_profiles
            : [row.creator_profiles];
          return profiles[0]?.city;
        }
        return null;
      case "youtube_account":
        if (row.creator_profiles) {
          const profiles = Array.isArray(row.creator_profiles)
            ? row.creator_profiles
            : [row.creator_profiles];
          const profile = profiles[0];
          const yt = profile?.youtube_account;
          if (!yt) return null;
          try {
            const account = typeof yt === "string" ? JSON.parse(yt) : yt;
            return (
              account?.channel_title || account?.channel_custom_url || null
            );
          } catch {
            return null;
          }
        }
        return null;
      case "instagram_account":
        if (row.creator_profiles) {
          const profiles = Array.isArray(row.creator_profiles)
            ? row.creator_profiles
            : [row.creator_profiles];
          const profile = profiles[0];
          const ig = profile?.instagram_account;
          if (!ig) return null;
          try {
            const account = typeof ig === "string" ? JSON.parse(ig) : ig;
            return account?.name_of_account || account?.username || null;
          } catch {
            return null;
          }
        }
        return null;
      case "language":
        if (row.creator_profiles) {
          const profiles = Array.isArray(row.creator_profiles)
            ? row.creator_profiles
            : [row.creator_profiles];
          const profile = profiles[0];
          const langs = profile?.languages;
          if (!langs) return null;
          if (Array.isArray(langs)) {
            return langs.join(", ");
          }
          return typeof langs === "string" ? langs : JSON.stringify(langs);
        }
        return null;
      case "categories":
        if (row.creator_profiles) {
          const profiles = Array.isArray(row.creator_profiles)
            ? row.creator_profiles
            : [row.creator_profiles];
          const profile = profiles[0];
          const categories = profile?.categories;
          if (!categories) return null;
          if (Array.isArray(categories)) {
            return categories.join(", ");
          }
          if (typeof categories === "string") {
            return categories;
          }
          return JSON.stringify(categories);
        }
        return null;
      case "subcategories":
        if (row.creator_profiles) {
          const profiles = Array.isArray(row.creator_profiles)
            ? row.creator_profiles
            : [row.creator_profiles];
          const profile = profiles[0];
          const subcategories = profile?.subcategories;
          if (!subcategories) return null;

          let subcategoriesArray: string[] = [];
          if (Array.isArray(subcategories)) {
            subcategoriesArray = subcategories.map((item: any) => {
              if (typeof item === "object" && item !== null) {
                if (item.category && item.subcategory) {
                  return `${item.category}: ${item.subcategory}`;
                }
                return JSON.stringify(item);
              }
              return String(item);
            });
          } else if (typeof subcategories === "string") {
            try {
              const parsed = JSON.parse(subcategories);
              if (Array.isArray(parsed)) {
                subcategoriesArray = parsed.map((item: any) => {
                  if (typeof item === "object" && item !== null) {
                    if (item.category && item.subcategory) {
                      return `${item.category}: ${item.subcategory}`;
                    }
                    return JSON.stringify(item);
                  }
                  return String(item);
                });
              } else {
                subcategoriesArray = [subcategories];
              }
            } catch {
              subcategoriesArray = subcategories
                .split(",")
                .map((s) => s.trim());
            }
          } else {
            subcategoriesArray = [JSON.stringify(subcategories)];
          }

          return subcategoriesArray.join(", ");
        }
        return null;
      case "interests":
        if (row.creator_profiles) {
          const profiles = Array.isArray(row.creator_profiles)
            ? row.creator_profiles
            : [row.creator_profiles];
          const profile = profiles[0];
          const interests = profile?.interests;
          if (!interests) return null;

          let interestsArray: string[] = [];
          if (Array.isArray(interests)) {
            interestsArray = interests;
          } else if (typeof interests === "string") {
            try {
              const parsed = JSON.parse(interests);
              interestsArray = Array.isArray(parsed) ? parsed : [interests];
            } catch {
              interestsArray = interests.split(",").map((s) => s.trim());
            }
          } else {
            interestsArray = [JSON.stringify(interests)];
          }

          return interestsArray.join(", ");
        }
        return null;
      default:
        return null;
    }
  };

  // Filter by tab
  const tabFiltered = useMemo(() => {
    let filtered = rows;
    if (activeTab === "all") {
      filtered = rows;
    } else if (activeTab === "advertisers") {
      // Show all users with user_type === "advertiser"
      // advertiser_profiles data will be shown when available
      filtered = rows.filter((r) => r.user_type === "advertiser");
    } else if (activeTab === "creators") {
      filtered = rows.filter((r) => r.user_type === "creator");
    }

    // Apply sorting based on active tab
    if (activeTab === "all") {
      if (sortOrder && sortColumn) {
        filtered = [...filtered].sort((a, b) => {
          let aValue: any;
          let bValue: any;

          // Shared helper for referral_code sorting:
          // Ascending: numbers -> letters/other -> null
          // Descending: letters/other -> numbers -> null.

          const getReferralSortMeta = (
            value: string | null | undefined
          ): { rank: number; value: string } => {
            if (!value) return { rank: 2, value: "" };
            const vRaw = value.toLowerCase();
            const v = vRaw.replace(/^_+/, "");
            const firstChar = v.charAt(0);
            const isDigit = /^[0-9]/.test(firstChar);
            const isLetter = /^[a-z]/.test(firstChar);

            if (isDigit) return { rank: 0, value: v };
            if (isLetter) return { rank: 1, value: v };
            return { rank: 1, value: v };
          };

          // Get values based on sort column
          switch (sortColumn) {
            case "id":
              aValue = a.id || "";
              bValue = b.id || "";
              break;
            case "full_name":
              aValue = a.full_name?.toLowerCase() || "";
              bValue = b.full_name?.toLowerCase() || "";
              break;
            case "email":
              aValue = a.email?.toLowerCase() || "";
              bValue = b.email?.toLowerCase() || "";
              break;
            case "user_type":
              aValue = a.user_type?.toLowerCase() || "";
              bValue = b.user_type?.toLowerCase() || "";
              break;
            case "referral_code": {
              const aMeta = getReferralSortMeta(a.referral_code || null);
              const bMeta = getReferralSortMeta(b.referral_code || null);

              // - Asc: numbers -> letters/other -> null
              // - Desc: letters/other -> numbers -> null
              const mapReferralRankForOrder = (rank: number) => {
                if (sortOrder === "asc") return rank;
                // For desc, flip 0 and 1; keep 2 (null) last
                if (rank === 0) return 1;
                if (rank === 1) return 0;
                return 2;
              };

              const aRank = mapReferralRankForOrder(aMeta.rank);
              const bRank = mapReferralRankForOrder(bMeta.rank);

              if (aRank !== bRank) {
                return aRank - bRank;
              }

              // Then compare alphabetically within the same group
              const cmp = aMeta.value.localeCompare(bMeta.value);
              if (cmp !== 0) {
                return sortOrder === "asc" ? cmp : -cmp;
              }

              return 0;
            }
            case "referred_by": {
              const getReferredByMeta = (
                value: string | null | undefined
              ): { rank: number; value: string } => {
                if (!value) return { rank: 2, value: "" }; // null/empty last
                const v = value.toLowerCase();
                const firstChar = v.charAt(0);
                const isDigit = /^[0-9]/.test(firstChar);
                const isLetter = /^[a-z]/.test(firstChar);
                // rank 0 = numeric, 1 = alphabetic/other
                if (isDigit) return { rank: 0, value: v };
                if (isLetter) return { rank: 1, value: v };
                return { rank: 1, value: v };
              };

              const aMeta = getReferredByMeta(a.referred_by || null);
              const bMeta = getReferredByMeta(b.referred_by || null);

              // - Asc: numbers -> letters/other -> null
              // - Desc: letters/other -> numbers -> null
              const mapRankForOrder = (rank: number) => {
                // rank 0: numeric, 1: alpha/other, 2: null/empty
                if (sortOrder === "asc") return rank;
                // For desc, flip 0 and 1; keep 2 (null) last
                if (rank === 0) return 1;
                if (rank === 1) return 0;
                return 2;
              };

              const aRank = mapRankForOrder(aMeta.rank);
              const bRank = mapRankForOrder(bMeta.rank);

              if (aMeta.rank !== bMeta.rank) {
                return aRank - bRank;
              }

              // Then compare alphabetically within the same group
              const cmp = aMeta.value.localeCompare(bMeta.value);
              if (cmp !== 0) {
                return sortOrder === "asc" ? cmp : -cmp;
              }

              return 0;
            }
            case "username": {
              const aMeta = getUsernameSortMeta(a.username);
              const bMeta = getUsernameSortMeta(b.username);

              // - Asc: numbers -> letters/other -> null
              // - Desc: letters/other -> numbers -> null
              const mapUsernameRankForOrder = (rank: number) => {
                // rank 0: numeric, 1: alpha/other, 2: null/empty
                if (sortOrder === "asc") return rank;
                // For desc, flip 0 and 1; keep 2 (null) last
                if (rank === 0) return 1;
                if (rank === 1) return 0;
                return 2;
              };

              const aRank = mapUsernameRankForOrder(aMeta.rank);
              const bRank = mapUsernameRankForOrder(bMeta.rank);

              if (aRank !== bRank) {
                return aRank - bRank;
              }

              // Then compare alphabetically within the same group
              const cmp = aMeta.value.localeCompare(bMeta.value);
              if (cmp !== 0) {
                return sortOrder === "asc" ? cmp : -cmp;
              }

              return 0;
            }
            case "advertisers_referred":
              aValue = a.advertisers_referred || 0;
              bValue = b.advertisers_referred || 0;
              break;
            case "creators_referred":
              aValue = a.creators_referred || 0;
              bValue = b.creators_referred || 0;
              break;
            case "coins":
              aValue = a.coins || 0;
              bValue = b.coins || 0;
              break;
            case "total_lifetime_coins":
              aValue = a.total_lifetime_coins_earned || 0;
              bValue = b.total_lifetime_coins_earned || 0;
              break;
            case "affiliate_earnings":
              aValue = a.affiliate_earnings || 0;
              bValue = b.affiliate_earnings || 0;
              break;
            case "other_earnings":
              aValue = a.other_earnings || 0;
              bValue = b.other_earnings || 0;
              break;
            case "created_at":
              // Convert dates to timestamps for proper chronological sorting
              const aCreatedDate = a.created_at ? new Date(a.created_at) : null;
              const bCreatedDate = b.created_at ? new Date(b.created_at) : null;
              aValue =
                aCreatedDate && !isNaN(aCreatedDate.getTime())
                  ? aCreatedDate.getTime()
                  : Number.MAX_SAFE_INTEGER;
              bValue =
                bCreatedDate && !isNaN(bCreatedDate.getTime())
                  ? bCreatedDate.getTime()
                  : Number.MAX_SAFE_INTEGER;
              break;
            case "updated_at":
              // Convert dates to timestamps for proper chronological sorting
              const aUpdatedDate = a.updated_at ? new Date(a.updated_at) : null;
              const bUpdatedDate = b.updated_at ? new Date(b.updated_at) : null;
              aValue =
                aUpdatedDate && !isNaN(aUpdatedDate.getTime())
                  ? aUpdatedDate.getTime()
                  : Number.MAX_SAFE_INTEGER;
              bValue =
                bUpdatedDate && !isNaN(bUpdatedDate.getTime())
                  ? bUpdatedDate.getTime()
                  : Number.MAX_SAFE_INTEGER;
              break;
            default:
              aValue = a.full_name?.toLowerCase() || "";
              bValue = b.full_name?.toLowerCase() || "";
          }

          // Handle numeric vs string comparison
          if (typeof aValue === "number" && typeof bValue === "number") {
            return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
          } else {
            if (sortOrder === "asc") {
              return String(aValue).localeCompare(String(bValue));
            } else {
              return String(bValue).localeCompare(String(aValue));
            }
          }
        });
      } else if (sortOrder) {
        // Fallback to full_name sorting if no column specified
        filtered = [...filtered].sort((a, b) => {
          const aValue = a.full_name?.toLowerCase() || "";
          const bValue = b.full_name?.toLowerCase() || "";

          if (sortOrder === "asc") {
            return aValue.localeCompare(bValue);
          } else {
            return bValue.localeCompare(aValue);
          }
        });
      }
    } else if (activeTab === "advertisers") {
      if (sortOrder && sortColumn) {
        filtered = [...filtered].sort((a, b) => {
          let aValue: any;
          let bValue: any;

          // Get advertiser profiles
          const aProfile = Array.isArray(a.advertiser_profiles)
            ? a.advertiser_profiles.length > 0
              ? a.advertiser_profiles[0]
              : null
            : a.advertiser_profiles || null;
          const bProfile = Array.isArray(b.advertiser_profiles)
            ? b.advertiser_profiles.length > 0
              ? b.advertiser_profiles[0]
              : null
            : b.advertiser_profiles || null;

          const getSubscriptionPlanName = (rawInfo: any) => {
            if (!rawInfo) return "";
            try {
              const info =
                typeof rawInfo === "string" ? JSON.parse(rawInfo) : rawInfo;

              const isActive =
                info?.status === "active" || info?.status === "trialing";
              if (!isActive) {
                return "";
              }

              if (!info?.product_id) return "";
              const plan = getSubscriptionPlanById(info.product_id);
              return (
                plan?.displayName?.toLowerCase() ||
                plan?.name?.toLowerCase() ||
                ""
              );
            } catch {
              return "";
            }
          };

          // Get values based on sort column
          switch (sortColumn) {
            case "id":
              aValue = a.id || "";
              bValue = b.id || "";
              break;
            case "full_name":
              aValue = a.full_name?.toLowerCase() || "";
              bValue = b.full_name?.toLowerCase() || "";
              break;
            case "email":
              aValue = a.email?.toLowerCase() || "";
              bValue = b.email?.toLowerCase() || "";
              break;
            case "username": {
              const aMeta = getUsernameSortMeta(a.username);
              const bMeta = getUsernameSortMeta(b.username);

              // First compare by rank (numbers vs letters/other vs null/empty).
              // We adjust effective rank based on sortOrder so that:
              // - Asc: numbers -> letters/other -> null
              // - Desc: letters/other -> numbers -> null
              const mapUsernameRankForOrder = (rank: number) => {
                // rank 0: numeric, 1: alpha/other, 2: null/empty
                if (sortOrder === "asc") return rank;
                // For desc, flip 0 and 1; keep 2 (null) last
                if (rank === 0) return 1;
                if (rank === 1) return 0;
                return 2;
              };

              const aRank = mapUsernameRankForOrder(aMeta.rank);
              const bRank = mapUsernameRankForOrder(bMeta.rank);

              if (aRank !== bRank) {
                return aRank - bRank;
              }

              // Then compare alphabetically within the same group
              const cmp = aMeta.value.localeCompare(bMeta.value);
              if (cmp !== 0) {
                return sortOrder === "asc" ? cmp : -cmp;
              }

              return 0;
            }
            case "company_name":
              aValue = aProfile?.company_name?.toLowerCase() || "";
              bValue = bProfile?.company_name?.toLowerCase() || "";
              break;
            case "website_url":
              aValue = aProfile?.website_url?.toLowerCase() || "";
              bValue = bProfile?.website_url?.toLowerCase() || "";
              break;
            case "total_money_spent":
              aValue = aProfile?.total_money_spent || 0;
              bValue = bProfile?.total_money_spent || 0;
              break;
            case "total_contests_run":
              aValue = aProfile?.total_contests_run || 0;
              bValue = bProfile?.total_contests_run || 0;
              break;
            case "available_deposit_balance":
              aValue = aProfile?.available_deposit_balance || 0;
              bValue = bProfile?.available_deposit_balance || 0;
              break;
            case "withdrawable_balance":
              aValue = aProfile?.withdrawable_balance || 0;
              bValue = bProfile?.withdrawable_balance || 0;
              break;
            case "subscription_info":
              aValue = getSubscriptionPlanName(aProfile?.subscription_info);
              bValue = getSubscriptionPlanName(bProfile?.subscription_info);
              break;
            case "created_at":
              // Convert dates to timestamps for proper chronological sorting
              const aCreatedDateAdv = a.created_at
                ? new Date(a.created_at)
                : null;
              const bCreatedDateAdv = b.created_at
                ? new Date(b.created_at)
                : null;
              aValue =
                aCreatedDateAdv && !isNaN(aCreatedDateAdv.getTime())
                  ? aCreatedDateAdv.getTime()
                  : Number.MAX_SAFE_INTEGER;
              bValue =
                bCreatedDateAdv && !isNaN(bCreatedDateAdv.getTime())
                  ? bCreatedDateAdv.getTime()
                  : Number.MAX_SAFE_INTEGER;
              break;
            case "updated_at":
              // Convert dates to timestamps for proper chronological sorting
              const aUpdatedDateAdv = a.updated_at
                ? new Date(a.updated_at)
                : null;
              const bUpdatedDateAdv = b.updated_at
                ? new Date(b.updated_at)
                : null;
              aValue =
                aUpdatedDateAdv && !isNaN(aUpdatedDateAdv.getTime())
                  ? aUpdatedDateAdv.getTime()
                  : Number.MAX_SAFE_INTEGER;
              bValue =
                bUpdatedDateAdv && !isNaN(bUpdatedDateAdv.getTime())
                  ? bUpdatedDateAdv.getTime()
                  : Number.MAX_SAFE_INTEGER;
              break;
            default:
              aValue = a.full_name?.toLowerCase() || "";
              bValue = b.full_name?.toLowerCase() || "";
          }

          // Handle numeric vs string comparison
          if (typeof aValue === "number" && typeof bValue === "number") {
            return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
          } else {
            if (sortOrder === "asc") {
              return String(aValue).localeCompare(String(bValue));
            } else {
              return String(bValue).localeCompare(String(aValue));
            }
          }
        });
      } else if (sortOrder) {
        // Fallback to full_name sorting if no column specified
        filtered = [...filtered].sort((a, b) => {
          const aValue = a.full_name?.toLowerCase() || "";
          const bValue = b.full_name?.toLowerCase() || "";

          if (sortOrder === "asc") {
            return aValue.localeCompare(bValue);
          } else {
            return bValue.localeCompare(aValue);
          }
        });
      }
    } else if (activeTab === "creators") {
      if (sortOrder && sortColumn) {
        filtered = [...filtered].sort((a, b) => {
          let aValue: any;
          let bValue: any;

          // Get creator profiles
          const aProfile = Array.isArray(a.creator_profiles)
            ? a.creator_profiles.length > 0
              ? a.creator_profiles[0]
              : null
            : a.creator_profiles || null;
          const bProfile = Array.isArray(b.creator_profiles)
            ? b.creator_profiles.length > 0
              ? b.creator_profiles[0]
              : null
            : b.creator_profiles || null;

          const getJoined = (value: any): string => {
            if (!value) return "";
            if (Array.isArray(value)) return value.join(", ").toLowerCase();
            if (typeof value === "string") return value.toLowerCase();
            try {
              return JSON.stringify(value).toLowerCase();
            } catch {
              return String(value).toLowerCase();
            }
          };

          // Get values based on sort column
          switch (sortColumn) {
            case "id":
              aValue = a.id || "";
              bValue = b.id || "";
              break;
            case "full_name":
              aValue = a.full_name?.toLowerCase() || "";
              bValue = b.full_name?.toLowerCase() || "";
              break;
            case "email":
              aValue = a.email?.toLowerCase() || "";
              bValue = b.email?.toLowerCase() || "";
              break;
            case "username": {
              const aMeta = getUsernameSortMeta(a.username);
              const bMeta = getUsernameSortMeta(b.username);

              const mapUsernameRankForOrder = (rank: number) => {
                if (sortOrder === "asc") return rank;
                if (rank === 0) return 1;
                if (rank === 1) return 0;
                return 2;
              };

              const aRank = mapUsernameRankForOrder(aMeta.rank);
              const bRank = mapUsernameRankForOrder(bMeta.rank);

              if (aRank !== bRank) {
                return aRank - bRank;
              }

              const cmp = aMeta.value.localeCompare(bMeta.value);
              if (cmp !== 0) {
                return sortOrder === "asc" ? cmp : -cmp;
              }

              return 0;
            }
            case "youtube_account": {
              const getYtName = (profile: CreatorProfile | null) => {
                const yt = profile?.youtube_account;
                if (!yt) return "";
                try {
                  const account = typeof yt === "string" ? JSON.parse(yt) : yt;
                  return (
                    account?.channel_title?.toLowerCase() ||
                    account?.channel_custom_url?.toLowerCase() ||
                    ""
                  );
                } catch {
                  return "";
                }
              };

              const aName = getYtName(aProfile);
              const bName = getYtName(bProfile);

              // Null / empty should be last for both ascending and descending.
              const aEmpty = !aName;
              const bEmpty = !bName;

              if (aEmpty !== bEmpty) {
                // non-empty (false) comes before empty (true)
                return aEmpty ? 1 : -1;
              }

              if (!aEmpty && !bEmpty) {
                const cmp = aName.localeCompare(bName);
                if (cmp !== 0) {
                  return sortOrder === "asc" ? cmp : -cmp;
                }
              }

              return 0;
            }
            case "instagram_account": {
              const getIgName = (profile: CreatorProfile | null) => {
                const ig = profile?.instagram_account;
                if (!ig) return "";
                try {
                  const account = typeof ig === "string" ? JSON.parse(ig) : ig;
                  const rawName =
                    account?.name_of_account || account?.username || "";
                  return normalizeForAlphabetSort(rawName);
                } catch {
                  return "";
                }
              };

              const aName = getIgName(aProfile);
              const bName = getIgName(bProfile);

              // Null / empty should be last for both ascending and descending.
              const aEmpty = !aName;
              const bEmpty = !bName;

              if (aEmpty !== bEmpty) {
                // non-empty (false) comes before empty (true)
                return aEmpty ? 1 : -1;
              }

              if (!aEmpty && !bEmpty) {
                const cmp = aName.localeCompare(bName);
                if (cmp !== 0) {
                  return sortOrder === "asc" ? cmp : -cmp;
                }
              }

              return 0;
            }
            case "contests_participated":
              aValue = aProfile?.total_contests_participated || 0;
              bValue = bProfile?.total_contests_participated || 0;
              break;
            case "contests_won":
              aValue = aProfile?.total_contests_won || 0;
              bValue = bProfile?.total_contests_won || 0;
              break;
            case "total_views":
              aValue = aProfile?.total_views || 0;
              bValue = bProfile?.total_views || 0;
              break;
            case "total_money_won":
              aValue = aProfile?.total_money_won || 0;
              bValue = bProfile?.total_money_won || 0;
              break;
            case "withdrawable_balance":
              aValue = aProfile?.withdrawable_balance || 0;
              bValue = bProfile?.withdrawable_balance || 0;
              break;
            case "total_submissions_made":
              aValue = aProfile?.total_submissions_made || 0;
              bValue = bProfile?.total_submissions_made || 0;
              break;
            case "total_submissions_won":
              aValue = aProfile?.total_submissions_won || 0;
              bValue = bProfile?.total_submissions_won || 0;
              break;
            case "date_of_birth":
              // Convert dates to timestamps for proper chronological sorting
              // Use Number.MAX_SAFE_INTEGER as sentinel for empty dates to ensure they sort last
              const aDate = aProfile?.date_of_birth
                ? new Date(aProfile.date_of_birth)
                : null;
              const bDate = bProfile?.date_of_birth
                ? new Date(bProfile.date_of_birth)
                : null;
              aValue =
                aDate && !isNaN(aDate.getTime())
                  ? aDate.getTime()
                  : Number.MAX_SAFE_INTEGER;
              bValue =
                bDate && !isNaN(bDate.getTime())
                  ? bDate.getTime()
                  : Number.MAX_SAFE_INTEGER;
              break;
            case "gender":
              aValue = aProfile?.gender?.toLowerCase() || "";
              bValue = bProfile?.gender?.toLowerCase() || "";
              break;
            case "country":
              aValue = aProfile?.country?.toLowerCase() || "";
              bValue = bProfile?.country?.toLowerCase() || "";
              break;
            case "state":
              aValue = aProfile?.state?.toLowerCase() || "";
              bValue = bProfile?.state?.toLowerCase() || "";
              break;
            case "city":
              aValue = aProfile?.city?.toLowerCase() || "";
              bValue = bProfile?.city?.toLowerCase() || "";
              break;
            case "address":
              aValue = aProfile?.address?.toLowerCase() || "";
              bValue = bProfile?.address?.toLowerCase() || "";
              break;
            case "language":
              aValue = getJoined(aProfile?.languages);
              bValue = getJoined(bProfile?.languages);
              break;
            case "categories":
              aValue = getJoined(aProfile?.categories);
              bValue = getJoined(bProfile?.categories);
              break;
            case "subcategories":
              aValue = getJoined(aProfile?.subcategories);
              bValue = getJoined(bProfile?.subcategories);
              break;
            case "interests":
              aValue = getJoined(aProfile?.interests);
              bValue = getJoined(bProfile?.interests);
              break;
            case "created_at":
              // Convert dates to timestamps for proper chronological sorting
              const aCreatedDateCreator = a.created_at
                ? new Date(a.created_at)
                : null;
              const bCreatedDateCreator = b.created_at
                ? new Date(b.created_at)
                : null;
              aValue =
                aCreatedDateCreator && !isNaN(aCreatedDateCreator.getTime())
                  ? aCreatedDateCreator.getTime()
                  : Number.MAX_SAFE_INTEGER;
              bValue =
                bCreatedDateCreator && !isNaN(bCreatedDateCreator.getTime())
                  ? bCreatedDateCreator.getTime()
                  : Number.MAX_SAFE_INTEGER;
              break;
            case "updated_at":
              // Convert dates to timestamps for proper chronological sorting
              const aUpdatedDateCreator = a.updated_at
                ? new Date(a.updated_at)
                : null;
              const bUpdatedDateCreator = b.updated_at
                ? new Date(b.updated_at)
                : null;
              aValue =
                aUpdatedDateCreator && !isNaN(aUpdatedDateCreator.getTime())
                  ? aUpdatedDateCreator.getTime()
                  : Number.MAX_SAFE_INTEGER;
              bValue =
                bUpdatedDateCreator && !isNaN(bUpdatedDateCreator.getTime())
                  ? bUpdatedDateCreator.getTime()
                  : Number.MAX_SAFE_INTEGER;
              break;
            default:
              aValue = a.full_name?.toLowerCase() || "";
              bValue = b.full_name?.toLowerCase() || "";
          }

          // Columns where null/empty should always be last
          const nullsLastColumns = [
            "date_of_birth",
            "gender",
            "country",
            "state",
            "city",
            "address",
            "language",
            "categories",
            "subcategories",
            "interests",
            "created_at",
            "updated_at",
          ];

          if (nullsLastColumns.includes(sortColumn)) {
            // Check if values are empty/null
            const aEmpty =
              typeof aValue === "number"
                ? aValue === Number.MAX_SAFE_INTEGER
                : !aValue || String(aValue).trim() === "";
            const bEmpty =
              typeof bValue === "number"
                ? bValue === Number.MAX_SAFE_INTEGER // For date_of_birth, MAX_SAFE_INTEGER means empty
                : !bValue || String(bValue).trim() === "";

            // If both are empty, they are equal
            if (aEmpty && bEmpty) {
              return 0;
            }

            // If only one is empty, it goes to the end (regardless of sort order)
            if (aEmpty !== bEmpty) {
              // non-empty (false) comes before empty (true)
              return aEmpty ? 1 : -1;
            }

            // If neither is empty, proceed with normal comparison
          }

          // Handle numeric vs string comparison
          if (typeof aValue === "number" && typeof bValue === "number") {
            return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
          } else {
            if (sortOrder === "asc") {
              return String(aValue).localeCompare(String(bValue));
            } else {
              return String(bValue).localeCompare(String(aValue));
            }
          }
        });
      } else if (sortOrder) {
        // Fallback to full_name sorting if no column specified
        filtered = [...filtered].sort((a, b) => {
          const aValue = a.full_name?.toLowerCase() || "";
          const bValue = b.full_name?.toLowerCase() || "";

          if (sortOrder === "asc") {
            return aValue.localeCompare(bValue);
          } else {
            return bValue.localeCompare(aValue);
          }
        });
      }
    }

    // Apply filters
    if (filters.length > 0) {
      // Helper function to check if a single filter matches a row
      const doesFilterMatch = (row: User, filter: FilterType): boolean => {
        if (!filter.value.trim()) return true; // Skip empty filters

        const columnValue = getColumnValue(row, filter.column);
        const rawFilterValue = filter.value.trim();
        const filterValue = rawFilterValue.toLowerCase();

        // Exact numeric match for integer count columns (e.g. total_submissions_won)
        // Also supports comparison operators for rankings and other integer fields
        const integerCountColumns = [
          "coins",
          "advertisers_referred",
          "creators_referred",
          "total_lifetime_coins",
          "total_contests_run",
          "contests_participated",
          "contests_won",
          "total_views",
          "total_submissions_made",
          "total_submissions_won",
          // Add "rankings" here when the field is available
        ];

        // Fields that support comparison operators via dropdown
        const integerComparisonColumns = [
          "coins",
          "advertisers_referred",
          "creators_referred",
          "total_lifetime_coins",
          "total_contests_run",
          "contests_participated",
          "contests_won",
          "total_views",
          "total_submissions_made",
          "total_submissions_won",
          // Add "rankings" here when the field is available
        ];

        // Check integer columns first, before null check
        if (integerCountColumns.includes(filter.column)) {
          // For integer columns, treat null/undefined as 0
          const numericColumn = Number(columnValue ?? 0);
          if (!Number.isNaN(numericColumn)) {
            const numericFilter = Number(rawFilterValue);
            if (Number.isNaN(numericFilter)) return false;

            // Use operator from filter state if available, otherwise fallback to parsing from value
            const operator = filter.operator || "=";

            if (
              integerComparisonColumns.includes(filter.column) &&
              operator !== "="
            ) {
              switch (operator) {
                case ">":
                  return numericColumn > numericFilter;
                case "<":
                  return numericColumn < numericFilter;
                case ">=":
                  return numericColumn >= numericFilter;
                case "<=":
                  return numericColumn <= numericFilter;
                case "!=":
                  return numericColumn !== numericFilter;
                default:
                  return numericColumn === numericFilter;
              }
            }

            // Fallback to exact match
            return numericColumn === numericFilter;
          }
          // If conversion to number fails, return false
          return false;
        }

        // Handle different data types for non-integer columns
        if (columnValue === null || columnValue === undefined) {
          return false;
        }

        let columnValueForFiltering: any = columnValue;

        // Special handling for monetary fields that are stored in cents but displayed in dollars
        const centBasedMoneyColumns = [
          "total_money_spent",
          "available_deposit_balance",
          "withdrawable_balance",
          "total_money_won",
          "affiliate_earnings",
          "other_earnings",
        ];

        // Fields that support comparison operators via dropdown
        // For earnings and money fields: values are in dollars (e.g., ">100", "<50", ">=200", "<=10")
        const moneyComparisonColumns = [
          "affiliate_earnings",
          "other_earnings",
          "total_money_spent",
          "available_deposit_balance",
          "withdrawable_balance",
          "total_money_won",
        ];

        if (centBasedMoneyColumns.includes(filter.column)) {
          const numericColumn = Number(columnValue);
          if (!Number.isNaN(numericColumn)) {
            const columnValueInDollars = numericColumn / 100;

            // Check if this field supports comparison operators
            if (moneyComparisonColumns.includes(filter.column)) {
              const numericFilter = parseFloat(rawFilterValue);
              if (Number.isNaN(numericFilter)) return false;

              // Use operator from filter state if available, otherwise fallback to parsing from value
              const operator = filter.operator || "=";

              if (operator !== "=") {
                switch (operator) {
                  case ">":
                    return columnValueInDollars > numericFilter;
                  case "<":
                    return columnValueInDollars < numericFilter;
                  case ">=":
                    return columnValueInDollars >= numericFilter;
                  case "<=":
                    return columnValueInDollars <= numericFilter;
                  case "!=":
                    return columnValueInDollars !== numericFilter;
                  default:
                    return columnValueInDollars === numericFilter;
                }
              }
            }

            // Convert cents to a fixed 2-decimal dollar string (e.g. 246 -> "2.46")
            columnValueForFiltering = columnValueInDollars.toFixed(2);

            const columnValueStr = String(
              columnValueForFiltering
            ).toLowerCase();

            // For money columns, use prefix match so typing "4" only matches values like "4.00", "40.00", "4.50", etc.
            return columnValueStr.startsWith(filterValue);
          }
        }

        // Special handling for date fields with comparison operators
        const dateFields = ["created_at", "updated_at", "date_of_birth"];
        if (dateFields.includes(filter.column)) {
          const columnDate = columnValue
            ? new Date(columnValue as string)
            : null;
          if (!columnDate || isNaN(columnDate.getTime())) return false;

          // Parse the filter date value
          const filterDate = new Date(rawFilterValue);
          if (isNaN(filterDate.getTime())) return false;

          // Use operator from filter state if available, otherwise fallback to "="
          const operator = filter.operator || "=";

          // For all date fields, compare only date part (ignore time)
          const colDateOnly = new Date(
            columnDate.getFullYear(),
            columnDate.getMonth(),
            columnDate.getDate()
          );
          const filterDateOnly = new Date(
            filterDate.getFullYear(),
            filterDate.getMonth(),
            filterDate.getDate()
          );

          switch (operator) {
            case ">":
              return colDateOnly > filterDateOnly;
            case "<":
              return colDateOnly < filterDateOnly;
            case ">=":
              return colDateOnly >= filterDateOnly;
            case "<=":
              return colDateOnly <= filterDateOnly;
            case "!=":
              return colDateOnly.getTime() !== filterDateOnly.getTime();
            default:
              return colDateOnly.getTime() === filterDateOnly.getTime();
          }
        }

        // Special handling for subscription_info: filter by plan name using helper
        if (filter.column === "subscription_info") {
          const planName = (() => {
            if (!columnValue) return "";
            try {
              const info =
                typeof columnValue === "string"
                  ? JSON.parse(columnValue)
                  : columnValue;

              if (!info?.product_id) return "";
              const plan = getSubscriptionPlanById(info.product_id);
              return (
                plan?.displayName?.toLowerCase() ||
                plan?.name?.toLowerCase() ||
                ""
              );
            } catch {
              return "";
            }
          })();

          if (!planName) return false;
          return planName.includes(filterValue);
        }

        const columnValueStr = String(columnValueForFiltering).toLowerCase();

        // Perform search (contains match) for non-money columns
        return columnValueStr.includes(filterValue);
      };

      // Group filters by column - filters on the same column use OR logic, different columns use AND logic
      const filtersByColumn = filters.reduce((acc, filter) => {
        if (!filter.value.trim()) return acc; // Skip empty filters
        if (!acc[filter.column]) {
          acc[filter.column] = [];
        }
        acc[filter.column].push(filter);
        return acc;
      }, {} as Record<string, FilterType[]>);

      filtered = filtered.filter((row) => {
        // For each column group, at least one filter must match (OR logic)
        // Across different columns, all column groups must match (AND logic)
        return Object.values(filtersByColumn).every((columnFilters) => {
          // At least one filter in this column group must match
          return columnFilters.some((filter) => doesFilterMatch(row, filter));
        });
      });
    }

    return filtered;
  }, [rows, activeTab, sortOrder, sortColumn, filters]);

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

  useEffect(() => {
    setPage(1);
    setFilters([]);
    setEmptyFilterColumn("");
    setEmptyFilterValue("");
  }, [activeTab]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);

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

  const updateUserType = async (userId: string, newUserType: string) => {
    try {
      setUpdatingUserType(userId);
      const res = await fetch(`/api/admin/users`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          userType: newUserType,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update user type");

      // Update the row in state
      setRows((prevRows) =>
        prevRows.map((row) =>
          row.id === userId ? { ...row, user_type: newUserType } : row
        )
      );
      setEditingUserType(null);
    } catch (e) {
      console.error("Error updating user type:", e);
      alert("Failed to update user type. Please try again.");
    } finally {
      setUpdatingUserType(null);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Read mode/compact flags from data attributes with immediate updates
  useEffect(() => {
    const checkFlags = () => {
      const container = document.querySelector("[data-mode][data-compact]");
      const modeElement = container || document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode && currentMode !== mode) {
          setMode(currentMode);
        }
      }
    };

    // Check immediately
    checkFlags();

    // Watch for changes in the data attributes with immediate callback
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "data-mode"
        ) {
          checkFlags();
        }
      });
    });

    const targetNode =
      document.querySelector("[data-mode][data-compact]") ||
      document.querySelector("[data-mode]") ||
      document.documentElement;

    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode", "data-theme"],
      });
    }

    // Also listen for storage events to catch theme changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "dashboard-mode" && e.newValue) {
        const newMode = e.newValue as "light" | "dark";
        if (newMode !== mode) {
          setMode(newMode);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [mode]);

  // Additional effect to catch theme changes more immediately
  useEffect(() => {
    // Listen for custom theme change events that might be dispatched by the theme system
    const handleThemeChange = (event: CustomEvent) => {
      if (event.detail && event.detail.mode) {
        const newMode = event.detail.mode as "light" | "dark";
        if (newMode !== mode) {
          setMode(newMode);
        }
      }
    };

    // Listen for the custom event
    window.addEventListener("theme-change", handleThemeChange as EventListener);

    // Also check for changes on a more frequent interval as a fallback
    const intervalId = setInterval(() => {
      const container = document.querySelector("[data-mode][data-compact]");
      const modeElement =
        container ||
        document.querySelector("[data-mode]") ||
        document.documentElement;
      if (modeElement) {
        const currentMode = (modeElement.getAttribute("data-mode") ||
          modeElement.getAttribute("data-theme")) as "light" | "dark" | null;
        if (currentMode && currentMode !== mode) {
          setMode(currentMode);
        }
      }
    }, 50); // Check every 50ms for faster response

    return () => {
      window.removeEventListener(
        "theme-change",
        handleThemeChange as EventListener
      );
      clearInterval(intervalId);
    };
  }, [mode]);

  const isDark = mode === "dark";

  return (
    <div className="space-y-6">
      <Card
        className={cn(
          "rounded-xl shadow",
          isDark ? "bg-[#170337]" : "bg-white"
        )}
      >
        <CardHeader className="py-3 px-6">
          <div className="flex items-center justify-between">
            <CardTitle
              className={cn("text-2xl", isDark ? "text-white" : "text-black")}
            >
              Users Management
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-input">
                <Checkbox
                  id="sticky-header"
                  checked={stickyHeader}
                  onCheckedChange={(checked) =>
                    setStickyHeader(checked as boolean)
                  }
                  className={cn(
                    isDark
                      ? "border-gray-400 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white"
                      : "border-gray-400 data-[state=checked]:bg-purple-600"
                  )}
                />
                <label
                  htmlFor="sticky-header"
                  className={cn(
                    "text-sm font-normal cursor-pointer select-none",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}
                >
                  Sticky Header
                </label>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  if (filters.length === 0) {
                    const availableColumns = allColumns[
                      activeTab as keyof typeof allColumns
                    ].filter((column) => column.id !== "profile");
                    setFilters([
                      {
                        id: `filter-${Date.now()}-${Math.random()}`,
                        column: availableColumns[0]?.id || "",
                        value: "",
                      },
                    ]);
                  }
                  setShowFilterModal(true);
                }}
                className="flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Filter
                {filters.filter((f) => f.value.trim()).length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-xs"
                  >
                    {filters.filter((f) => f.value.trim()).length}
                  </Badge>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowColumnSettings(true)}
                className="flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Customize Tiles
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-2 px-6">
          <EnhancedTabs value={activeTab} onValueChange={setActiveTab}>
            <EnhancedTabsList>
              <EnhancedTabsTrigger value="all">
                Users
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

      <Card
        className={cn(
          "rounded-xl shadow",
          isDark ? "bg-[#170337]" : "bg-white"
        )}
      >
        <CardContent className="px-6">
          <div
            className={cn(
              stickyHeader
                ? "max-h-[calc(100vh-200px)] [&>div]:max-h-[calc(100vh-200px)] [&>div]:overflow-y-auto [&>div]:overflow-x-auto"
                : "[&>div]:overflow-x-auto"
            )}
          >
            <Table>
              <TableHeader
                className={cn(
                  stickyHeader ? "sticky top-0 z-20" : "",
                  isDark ? "bg-[#391A6A]" : "bg-[#F9FAFB]"
                )}
              >
                <TableRow
                  className={cn(
                    "text-left border-b",
                    isDark
                      ? "bg-[#391A6A] text-white"
                      : "bg-[#F9FAFB] border-b border-slate-200 text-gray-500"
                  )}
                >
                  {isColumnVisible("id") && (
                    <SortableHeader columnId="id" label="ID" />
                  )}
                  {isColumnVisible("full_name") && (
                    <SortableHeader columnId="full_name" label="Full Name" />
                  )}
                  {isColumnVisible("profile") && (
                    <TableHead
                      className={cn(
                        "whitespace-nowrap border-r",
                        isDark ? "bg-[#391A6A]" : "bg-[#F9FAFB]"
                      )}
                    >
                      Profile
                    </TableHead>
                  )}
                  {isColumnVisible("email") && (
                    <SortableHeader columnId="email" label="Email" />
                  )}
                  {activeTab === "advertisers" && (
                    <>
                      {isColumnVisible("username") && (
                        <SortableHeader columnId="username" label="Username" />
                      )}
                      {isColumnVisible("company_name") && (
                        <SortableHeader
                          columnId="company_name"
                          label="Company Name"
                        />
                      )}
                      {isColumnVisible("website_url") && (
                        <SortableHeader
                          columnId="website_url"
                          label="Website URL"
                        />
                      )}
                      {isColumnVisible("total_money_spent") && (
                        <TableHead className="whitespace-nowrap border-r">
                          <div className="flex items-center gap-2">
                            <span>Total Money Spent</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("total_money_spent");
                                    setSortOrder("asc");
                                  }}
                                  className={cn(
                                    sortColumn === "total_money_spent" &&
                                      sortOrder === "asc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Ascending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("total_money_spent");
                                    setSortOrder("desc");
                                  }}
                                  className={cn(
                                    sortColumn === "total_money_spent" &&
                                      sortOrder === "desc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Descending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn(null);
                                    setSortOrder(null);
                                  }}
                                >
                                  Clear Sort
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableHead>
                      )}
                      {isColumnVisible("total_contests_run") && (
                        <TableHead className="whitespace-nowrap border-r">
                          <div className="flex items-center gap-2">
                            <span>Total Contests Run</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("total_contests_run");
                                    setSortOrder("asc");
                                  }}
                                  className={cn(
                                    sortColumn === "total_contests_run" &&
                                      sortOrder === "asc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Ascending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("total_contests_run");
                                    setSortOrder("desc");
                                  }}
                                  className={cn(
                                    sortColumn === "total_contests_run" &&
                                      sortOrder === "desc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Descending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn(null);
                                    setSortOrder(null);
                                  }}
                                >
                                  Clear Sort
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableHead>
                      )}
                      {isColumnVisible("available_deposit_balance") && (
                        <TableHead className="whitespace-nowrap border-r">
                          <div className="flex items-center gap-2">
                            <span>Available Deposit Balance</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("available_deposit_balance");
                                    setSortOrder("asc");
                                  }}
                                  className={cn(
                                    sortColumn ===
                                      "available_deposit_balance" &&
                                      sortOrder === "asc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Ascending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("available_deposit_balance");
                                    setSortOrder("desc");
                                  }}
                                  className={cn(
                                    sortColumn ===
                                      "available_deposit_balance" &&
                                      sortOrder === "desc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Descending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn(null);
                                    setSortOrder(null);
                                  }}
                                >
                                  Clear Sort
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableHead>
                      )}
                      {isColumnVisible("withdrawable_balance") && (
                        <TableHead className="whitespace-nowrap border-r">
                          <div className="flex items-center gap-2">
                            <span>Withdrawable Balance</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("withdrawable_balance");
                                    setSortOrder("asc");
                                  }}
                                  className={cn(
                                    sortColumn === "withdrawable_balance" &&
                                      sortOrder === "asc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Ascending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("withdrawable_balance");
                                    setSortOrder("desc");
                                  }}
                                  className={cn(
                                    sortColumn === "withdrawable_balance" &&
                                      sortOrder === "desc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Descending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn(null);
                                    setSortOrder(null);
                                  }}
                                >
                                  Clear Sort
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableHead>
                      )}
                      {isColumnVisible("subscription_info") && (
                        <SortableHeader
                          columnId="subscription_info"
                          label="Subscription Info"
                        />
                      )}
                      {isColumnVisible("created_at") && (
                        <SortableHeader
                          columnId="created_at"
                          label="Created At"
                        />
                      )}
                      {isColumnVisible("updated_at") && (
                        <SortableHeader
                          columnId="updated_at"
                          label="Updated At"
                        />
                      )}
                    </>
                  )}
                  {activeTab === "creators" && (
                    <>
                      {isColumnVisible("username") && (
                        <SortableHeader columnId="username" label="Username" />
                      )}
                      {isColumnVisible("youtube_account") && (
                        <SortableHeader
                          columnId="youtube_account"
                          label="YouTube Account"
                        />
                      )}
                      {isColumnVisible("instagram_account") && (
                        <SortableHeader
                          columnId="instagram_account"
                          label="Instagram Account"
                        />
                      )}
                      {isColumnVisible("contests_participated") && (
                        <TableHead className="whitespace-nowrap border-r">
                          <div className="flex items-center gap-2">
                            <span>Contests Participated</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("contests_participated");
                                    setSortOrder("asc");
                                  }}
                                  className={cn(
                                    sortColumn === "contests_participated" &&
                                      sortOrder === "asc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Ascending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("contests_participated");
                                    setSortOrder("desc");
                                  }}
                                  className={cn(
                                    sortColumn === "contests_participated" &&
                                      sortOrder === "desc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Descending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn(null);
                                    setSortOrder(null);
                                  }}
                                >
                                  Clear Sort
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableHead>
                      )}
                      {isColumnVisible("contests_won") && (
                        <TableHead className="whitespace-nowrap border-r">
                          <div className="flex items-center gap-2">
                            <span>Contests Won</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("contests_won");
                                    setSortOrder("asc");
                                  }}
                                  className={cn(
                                    sortColumn === "contests_won" &&
                                      sortOrder === "asc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Ascending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("contests_won");
                                    setSortOrder("desc");
                                  }}
                                  className={cn(
                                    sortColumn === "contests_won" &&
                                      sortOrder === "desc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Descending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn(null);
                                    setSortOrder(null);
                                  }}
                                >
                                  Clear Sort
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableHead>
                      )}
                      {isColumnVisible("total_views") && (
                        <TableHead className="whitespace-nowrap border-r">
                          <div className="flex items-center gap-2">
                            <span>Total Views</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("total_views");
                                    setSortOrder("asc");
                                  }}
                                  className={cn(
                                    sortColumn === "total_views" &&
                                      sortOrder === "asc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Ascending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("total_views");
                                    setSortOrder("desc");
                                  }}
                                  className={cn(
                                    sortColumn === "total_views" &&
                                      sortOrder === "desc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Descending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn(null);
                                    setSortOrder(null);
                                  }}
                                >
                                  Clear Sort
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableHead>
                      )}
                      {isColumnVisible("total_money_won") && (
                        <TableHead className="whitespace-nowrap border-r">
                          <div className="flex items-center gap-2">
                            <span>Total Money Won</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("total_money_won");
                                    setSortOrder("asc");
                                  }}
                                  className={cn(
                                    sortColumn === "total_money_won" &&
                                      sortOrder === "asc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Ascending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("total_money_won");
                                    setSortOrder("desc");
                                  }}
                                  className={cn(
                                    sortColumn === "total_money_won" &&
                                      sortOrder === "desc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Descending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn(null);
                                    setSortOrder(null);
                                  }}
                                >
                                  Clear Sort
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableHead>
                      )}
                      {isColumnVisible("withdrawable_balance") && (
                        <TableHead className="whitespace-nowrap border-r">
                          <div className="flex items-center gap-2">
                            <span>Withdrawable Balance</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("withdrawable_balance");
                                    setSortOrder("asc");
                                  }}
                                  className={cn(
                                    sortColumn === "withdrawable_balance" &&
                                      sortOrder === "asc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Ascending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("withdrawable_balance");
                                    setSortOrder("desc");
                                  }}
                                  className={cn(
                                    sortColumn === "withdrawable_balance" &&
                                      sortOrder === "desc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Descending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn(null);
                                    setSortOrder(null);
                                  }}
                                >
                                  Clear Sort
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableHead>
                      )}
                      {isColumnVisible("total_submissions_made") && (
                        <TableHead className="whitespace-nowrap border-r">
                          <div className="flex items-center gap-2">
                            <span>Total Submissions Made</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("total_submissions_made");
                                    setSortOrder("asc");
                                  }}
                                  className={cn(
                                    sortColumn === "total_submissions_made" &&
                                      sortOrder === "asc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Ascending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("total_submissions_made");
                                    setSortOrder("desc");
                                  }}
                                  className={cn(
                                    sortColumn === "total_submissions_made" &&
                                      sortOrder === "desc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Descending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn(null);
                                    setSortOrder(null);
                                  }}
                                >
                                  Clear Sort
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableHead>
                      )}
                      {isColumnVisible("total_submissions_won") && (
                        <TableHead className="whitespace-nowrap border-r">
                          <div className="flex items-center gap-2">
                            <span>Total Submissions Won</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("total_submissions_won");
                                    setSortOrder("asc");
                                  }}
                                  className={cn(
                                    sortColumn === "total_submissions_won" &&
                                      sortOrder === "asc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Ascending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("total_submissions_won");
                                    setSortOrder("desc");
                                  }}
                                  className={cn(
                                    sortColumn === "total_submissions_won" &&
                                      sortOrder === "desc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Descending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn(null);
                                    setSortOrder(null);
                                  }}
                                >
                                  Clear Sort
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableHead>
                      )}
                      {isColumnVisible("date_of_birth") && (
                        <SortableHeader
                          columnId="date_of_birth"
                          label="Date of Birth"
                        />
                      )}
                      {isColumnVisible("gender") && (
                        <SortableHeader columnId="gender" label="Gender" />
                      )}
                      {isColumnVisible("country") && (
                        <SortableHeader columnId="country" label="Country" />
                      )}
                      {isColumnVisible("state") && (
                        <SortableHeader columnId="state" label="State" />
                      )}
                      {isColumnVisible("city") && (
                        <SortableHeader columnId="city" label="City" />
                      )}
                      {isColumnVisible("address") && (
                        <SortableHeader
                          columnId="address"
                          label="Address"
                          className="min-w-[250px] max-w-md"
                        />
                      )}
                      {isColumnVisible("language") && (
                        <SortableHeader
                          columnId="language"
                          label="Language"
                          className="min-w-[150px] max-w-sm"
                        />
                      )}
                      {isColumnVisible("categories") && (
                        <SortableHeader
                          columnId="categories"
                          label="Categories"
                        />
                      )}
                      {isColumnVisible("subcategories") && (
                        <SortableHeader
                          columnId="subcategories"
                          label="Subcategories"
                        />
                      )}
                      {isColumnVisible("interests") && (
                        <SortableHeader
                          columnId="interests"
                          label="Interests"
                          className=""
                        />
                      )}
                      {isColumnVisible("created_at") && (
                        <SortableHeader
                          columnId="created_at"
                          label="Created At"
                        />
                      )}
                      {isColumnVisible("updated_at") && (
                        <SortableHeader
                          columnId="updated_at"
                          label="Updated At"
                        />
                      )}
                    </>
                  )}
                  {activeTab !== "advertisers" && activeTab !== "creators" && (
                    <>
                      {isColumnVisible("user_type") && (
                        <SortableHeader
                          columnId="user_type"
                          label="User Type"
                        />
                      )}
                      {isColumnVisible("username") && (
                        <SortableHeader columnId="username" label="Username" />
                      )}
                      {isColumnVisible("referral_code") && (
                        <SortableHeader
                          columnId="referral_code"
                          label="Referral Code"
                        />
                      )}
                      {isColumnVisible("referred_by") && (
                        <SortableHeader
                          columnId="referred_by"
                          label="Referred By"
                        />
                      )}
                      {isColumnVisible("coins") && (
                        <TableHead className="whitespace-nowrap border-r">
                          <div className="flex items-center gap-2">
                            <span>Coins</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("coins");
                                    setSortOrder("asc");
                                  }}
                                  className={cn(
                                    sortColumn === "coins" &&
                                      sortOrder === "asc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Ascending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("coins");
                                    setSortOrder("desc");
                                  }}
                                  className={cn(
                                    sortColumn === "coins" &&
                                      sortOrder === "desc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Descending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn(null);
                                    setSortOrder(null);
                                  }}
                                >
                                  Clear Sort
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableHead>
                      )}
                      {isColumnVisible("advertisers_referred") && (
                        <TableHead className="whitespace-nowrap border-r">
                          <div className="flex items-center gap-2">
                            <span>Advertisers Referred</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("advertisers_referred");
                                    setSortOrder("asc");
                                  }}
                                  className={cn(
                                    sortColumn === "advertisers_referred" &&
                                      sortOrder === "asc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Ascending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("advertisers_referred");
                                    setSortOrder("desc");
                                  }}
                                  className={cn(
                                    sortColumn === "advertisers_referred" &&
                                      sortOrder === "desc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Descending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn(null);
                                    setSortOrder(null);
                                  }}
                                >
                                  Clear Sort
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableHead>
                      )}
                      {isColumnVisible("creators_referred") && (
                        <TableHead className="whitespace-nowrap border-r">
                          <div className="flex items-center gap-2">
                            <span>Creators Referred</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("creators_referred");
                                    setSortOrder("asc");
                                  }}
                                  className={cn(
                                    sortColumn === "creators_referred" &&
                                      sortOrder === "asc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Ascending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("creators_referred");
                                    setSortOrder("desc");
                                  }}
                                  className={cn(
                                    sortColumn === "creators_referred" &&
                                      sortOrder === "desc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Descending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn(null);
                                    setSortOrder(null);
                                  }}
                                >
                                  Clear Sort
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableHead>
                      )}
                      {isColumnVisible("total_lifetime_coins") && (
                        <TableHead className="whitespace-nowrap border-r">
                          <div className="flex items-center gap-2">
                            <span>Total Lifetime Coins</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("total_lifetime_coins");
                                    setSortOrder("asc");
                                  }}
                                  className={cn(
                                    sortColumn === "total_lifetime_coins" &&
                                      sortOrder === "asc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Ascending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("total_lifetime_coins");
                                    setSortOrder("desc");
                                  }}
                                  className={cn(
                                    sortColumn === "total_lifetime_coins" &&
                                      sortOrder === "desc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Descending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn(null);
                                    setSortOrder(null);
                                  }}
                                >
                                  Clear Sort
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableHead>
                      )}
                      {isColumnVisible("affiliate_earnings") && (
                        <TableHead className="whitespace-nowrap border-r">
                          <div className="flex items-center gap-2">
                            <span>Affiliate Earnings</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("affiliate_earnings");
                                    setSortOrder("asc");
                                  }}
                                  className={cn(
                                    sortColumn === "affiliate_earnings" &&
                                      sortOrder === "asc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Ascending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("affiliate_earnings");
                                    setSortOrder("desc");
                                  }}
                                  className={cn(
                                    sortColumn === "affiliate_earnings" &&
                                      sortOrder === "desc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Descending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn(null);
                                    setSortOrder(null);
                                  }}
                                >
                                  Clear Sort
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableHead>
                      )}
                      {isColumnVisible("other_earnings") && (
                        <TableHead className="whitespace-nowrap border-r">
                          <div className="flex items-center gap-2">
                            <span>Other Earnings</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("other_earnings");
                                    setSortOrder("asc");
                                  }}
                                  className={cn(
                                    sortColumn === "other_earnings" &&
                                      sortOrder === "asc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Ascending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn("other_earnings");
                                    setSortOrder("desc");
                                  }}
                                  className={cn(
                                    sortColumn === "other_earnings" &&
                                      sortOrder === "desc" &&
                                      "bg-accent"
                                  )}
                                >
                                  Sort by Descending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSortColumn(null);
                                    setSortOrder(null);
                                  }}
                                >
                                  Clear Sort
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableHead>
                      )}
                      {isColumnVisible("created_at") && (
                        <SortableHeader
                          columnId="created_at"
                          label="Created At"
                        />
                      )}
                      {isColumnVisible("updated_at") && (
                        <SortableHeader
                          columnId="updated_at"
                          label="Updated At"
                        />
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
                                {r.username || "-"}
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
                              <TableCell className="whitespace-nowrap border-r">
                                {(() => {
                                  const subscriptionInfo =
                                    advertiserProfile?.subscription_info;
                                  if (!subscriptionInfo) {
                                    return (
                                      <span className="text-muted-foreground">
                                        -
                                      </span>
                                    );
                                  }

                                  try {
                                    const info =
                                      typeof subscriptionInfo === "string"
                                        ? JSON.parse(subscriptionInfo)
                                        : subscriptionInfo;

                                    const isActive =
                                      info?.status === "active" ||
                                      info?.status === "trialing";

                                    if (!isActive) {
                                      return (
                                        <span className="text-muted-foreground">
                                          -
                                        </span>
                                      );
                                    }

                                    // Get plan name from product_id
                                    const plan = info?.product_id
                                      ? getSubscriptionPlanById(info.product_id)
                                      : null;
                                    const planName =
                                      plan?.displayName ||
                                      plan?.name ||
                                      "Unknown Plan";

                                    // Get amount (price_amount is in cents)
                                    const amount = info?.price_amount;
                                    const formattedAmount = amount
                                      ? `$${(amount / 100).toFixed(2)}`
                                      : "-";

                                    return (
                                      <div className="flex items-center gap-2">
                                        <div className="flex flex-col">
                                          <span className="font-medium text-sm">
                                            {planName}
                                          </span>
                                          {amount !== undefined && (
                                            <span className="text-xs text-muted-foreground">
                                              {formattedAmount}
                                            </span>
                                          )}
                                        </div>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="ml-2"
                                          onClick={() => {
                                            setSelectedSubscriptionInfo(
                                              subscriptionInfo
                                            );
                                            setIsSubscriptionDialogOpen(true);
                                          }}
                                        >
                                          View Details
                                        </Button>
                                      </div>
                                    );
                                  } catch {
                                    return (
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">
                                          Connected
                                        </span>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setSelectedSubscriptionInfo(
                                              subscriptionInfo
                                            );
                                            setIsSubscriptionDialogOpen(true);
                                          }}
                                        >
                                          View Details
                                        </Button>
                                      </div>
                                    );
                                  }
                                })()}
                              </TableCell>
                            )}
                            {isColumnVisible("created_at") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {r.created_at
                                  ? new Date(r.created_at).toLocaleString()
                                  : "-"}
                              </TableCell>
                            )}
                            {isColumnVisible("updated_at") && (
                              <TableCell className="whitespace-nowrap">
                                {r.updated_at
                                  ? new Date(r.updated_at).toLocaleString()
                                  : "-"}
                              </TableCell>
                            )}
                          </>
                        ) : activeTab === "creators" ? (
                          <>
                            {isColumnVisible("username") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {r.username || "-"}
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

                                    // Construct YouTube channel URL
                                    let youtubeUrl = "";
                                    if (account?.channel_custom_url) {
                                      youtubeUrl = `https://youtube.com/${account.channel_custom_url}`;
                                    } else if (account?.channel_id) {
                                      youtubeUrl = `https://youtube.com/channel/${account.channel_id}`;
                                    }

                                    return (
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <div className="font-medium text-sm">
                                            {account?.channel_title ||
                                              "YouTube"}
                                          </div>
                                          {youtubeUrl && (
                                            <a
                                              href={youtubeUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-red-600 hover:text-red-700 transition-colors"
                                              title="Visit YouTube Channel"
                                            >
                                              <svg
                                                className="w-5 h-5"
                                                fill="currentColor"
                                                viewBox="0 0 24 24"
                                                xmlns="http://www.w3.org/2000/svg"
                                              >
                                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                                              </svg>
                                            </a>
                                          )}
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

                                    // Construct Instagram profile URL
                                    const instagramUrl = account?.username
                                      ? `https://instagram.com/${account.username}`
                                      : "";

                                    return (
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <div className="font-medium text-sm">
                                            {account?.name_of_account ||
                                              account?.username ||
                                              "Instagram"}
                                          </div>
                                          {instagramUrl && (
                                            <a
                                              href={instagramUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-pink-600 hover:text-pink-700 transition-colors"
                                              title="Visit Instagram Profile"
                                            >
                                              <svg
                                                className="w-5 h-5"
                                                fill="currentColor"
                                                viewBox="0 0 24 24"
                                                xmlns="http://www.w3.org/2000/svg"
                                              >
                                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                              </svg>
                                            </a>
                                          )}
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
                                    // Convert each item to string, handling objects properly
                                    subcategoriesArray = subcategories.map(
                                      (item: any) => {
                                        if (
                                          typeof item === "object" &&
                                          item !== null
                                        ) {
                                          // If it has category and subcategory, format nicely
                                          if (
                                            item.category &&
                                            item.subcategory
                                          ) {
                                            return `${item.category}: ${item.subcategory}`;
                                          }
                                          // Otherwise, stringify the object
                                          return JSON.stringify(item);
                                        }
                                        return String(item);
                                      }
                                    );
                                  } else if (
                                    typeof subcategories === "string"
                                  ) {
                                    // Try to parse if it's a JSON string, otherwise split by comma
                                    try {
                                      const parsed = JSON.parse(subcategories);
                                      if (Array.isArray(parsed)) {
                                        subcategoriesArray = parsed.map(
                                          (item: any) => {
                                            if (
                                              typeof item === "object" &&
                                              item !== null
                                            ) {
                                              if (
                                                item.category &&
                                                item.subcategory
                                              ) {
                                                return `${item.category}: ${item.subcategory}`;
                                              }
                                              return JSON.stringify(item);
                                            }
                                            return String(item);
                                          }
                                        );
                                      } else {
                                        subcategoriesArray = [subcategories];
                                      }
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
                            {isColumnVisible("created_at") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {r.created_at
                                  ? new Date(r.created_at).toLocaleString()
                                  : "-"}
                              </TableCell>
                            )}
                            {isColumnVisible("updated_at") && (
                              <TableCell className="whitespace-nowrap">
                                {r.updated_at
                                  ? new Date(r.updated_at).toLocaleString()
                                  : "-"}
                              </TableCell>
                            )}
                          </>
                        ) : (
                          <>
                            {isColumnVisible("user_type") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {editingUserType === r.id ? (
                                  <Select
                                    value={r.user_type}
                                    onValueChange={(value) => {
                                      if (value !== r.user_type) {
                                        updateUserType(r.id, value);
                                      } else {
                                        setEditingUserType(null);
                                      }
                                    }}
                                    onOpenChange={(open) => {
                                      if (!open && updatingUserType !== r.id) {
                                        setEditingUserType(null);
                                      }
                                    }}
                                    disabled={updatingUserType === r.id}
                                  >
                                    <SelectTrigger
                                      isDark={isDark}
                                      className="w-[140px]"
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent isDark={isDark}>
                                      <SelectItem
                                        value="creator"
                                        isDark={isDark}
                                      >
                                        Creator
                                      </SelectItem>
                                      <SelectItem
                                        value="advertiser"
                                        isDark={isDark}
                                      >
                                        Advertiser
                                      </SelectItem>
                                      <SelectItem value="admin" isDark={isDark}>
                                        Admin
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <div
                                    className="cursor-pointer"
                                    onClick={() => setEditingUserType(r.id)}
                                  >
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
                                  </div>
                                )}
                              </TableCell>
                            )}
                            {isColumnVisible("username") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {r.username || "-"}
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
                              <TableCell className="whitespace-nowrap border-r">
                                ${((r.other_earnings || 0) / 100).toFixed(2)}
                              </TableCell>
                            )}
                            {isColumnVisible("created_at") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {r.created_at
                                  ? new Date(r.created_at).toLocaleString()
                                  : "-"}
                              </TableCell>
                            )}
                            {isColumnVisible("updated_at") && (
                              <TableCell className="whitespace-nowrap">
                                {r.updated_at
                                  ? new Date(r.updated_at).toLocaleString()
                                  : "-"}
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
      <Dialog
        open={showColumnSettings}
        onOpenChange={setShowColumnSettings}
        isdark={isDark}
      >
        <DialogContent
          className={cn(
            "max-w-4xl max-h-[80vh] overflow-y-auto",
            isDark ? "text-white" : "text-gray-900"
          )}
        >
          <DialogHeader>
            <DialogTitle
              className={cn(isDark ? "text-white" : "text-gray-900")}
            >
              {activeTab === "all"
                ? "Users"
                : activeTab === "advertisers"
                ? "Advertisers"
                : "Creators"}{" "}
              Columns
            </DialogTitle>
            <DialogDescription
              className={cn(isDark ? "text-gray-300" : "text-gray-600")}
            >
              Select which columns to display in the{" "}
              {activeTab === "all"
                ? "Users"
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
                          ? isDark
                            ? "bg-[#391A6A] border-purple-500 text-white"
                            : "bg-purple-50 border-purple-200 text-gray-900"
                          : isDark
                          ? "border-gray-600 hover:bg-[#2A1249] text-gray-300"
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
                              : isDark
                              ? "border-gray-500"
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

      {/* Filter Dialog */}
      <Dialog
        open={showFilterModal}
        onOpenChange={setShowFilterModal}
        isdark={isDark}
      >
        <DialogContent
          className={cn(
            "max-w-4xl max-h-[80vh] overflow-y-auto",
            isDark ? "text-white" : "text-gray-900"
          )}
        >
          <DialogHeader>
            <DialogTitle
              className={cn(isDark ? "text-white" : "text-gray-900")}
            >
              Filter{" "}
              {activeTab === "all"
                ? "Users"
                : activeTab === "advertisers"
                ? "Advertisers"
                : "Creators"}
            </DialogTitle>
            <DialogDescription
              className={cn(isDark ? "text-gray-300" : "text-gray-600")}
            >
              Add filters to search and filter the table data. You can add
              multiple filters for different columns.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {filters.length === 0 ? (
              <div
                className={cn(
                  "flex items-center gap-3 p-4 rounded-lg border",
                  isDark
                    ? "bg-[#1a102b] border-gray-700"
                    : "bg-gray-50 border-gray-200"
                )}
              >
                <div className="flex-1">
                  <Select
                    value={
                      emptyFilterColumn ||
                      allColumns[activeTab as keyof typeof allColumns].filter(
                        (column) => column.id !== "profile"
                      )[0]?.id ||
                      ""
                    }
                    onValueChange={(value) => {
                      setEmptyFilterColumn(value);
                      if (emptyFilterValue) {
                        setFilters([
                          {
                            id: `filter-${Date.now()}-${Math.random()}`,
                            column: value,
                            value: emptyFilterValue,
                          },
                        ]);
                        setEmptyFilterValue("");
                      }
                    }}
                  >
                    <SelectTrigger isDark={isDark} className="w-full">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent isDark={isDark}>
                      {allColumns[activeTab as keyof typeof allColumns]
                        .filter((column) => column.id !== "profile")
                        .map((column) => (
                          <SelectItem
                            key={column.id}
                            value={column.id}
                            isDark={isDark}
                          >
                            {column.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  {(() => {
                    const selectedColumnId =
                      emptyFilterColumn ||
                      allColumns[activeTab as keyof typeof allColumns].filter(
                        (column) => column.id !== "profile"
                      )[0]?.id ||
                      "";
                    const isUserType = selectedColumnId === "user_type";
                    const isGender = selectedColumnId === "gender";

                    // Check if this field supports comparison operators
                    const earningsFields = [
                      "affiliate_earnings",
                      "other_earnings",
                    ];
                    const moneyFields = [
                      "total_money_spent",
                      "available_deposit_balance",
                      "withdrawable_balance",
                      "total_money_won",
                    ];
                    const integerFields = [
                      "coins",
                      "advertisers_referred",
                      "creators_referred",
                      "total_lifetime_coins",
                      "total_contests_run",
                      "contests_participated",
                      "contests_won",
                      "total_views",
                      "total_submissions_made",
                      "total_submissions_won",
                    ];
                    const dateFields = [
                      "created_at",
                      "updated_at",
                      "date_of_birth",
                    ];
                    const isEarningsField =
                      earningsFields.includes(selectedColumnId);
                    const isMoneyField = moneyFields.includes(selectedColumnId);
                    const isIntegerField =
                      integerFields.includes(selectedColumnId);
                    const isDateField = dateFields.includes(selectedColumnId);
                    const supportsOperators =
                      isEarningsField ||
                      isMoneyField ||
                      isIntegerField ||
                      isDateField;

                    const commonOnSelectValueChange = (value: string) => {
                      setEmptyFilterValue(value);
                      const selectedColumn =
                        emptyFilterColumn ||
                        allColumns[activeTab as keyof typeof allColumns].filter(
                          (column) => column.id !== "profile"
                        )[0]?.id ||
                        "";
                      if (selectedColumn && value) {
                        setFilters([
                          {
                            id: `filter-${Date.now()}-${Math.random()}`,
                            column: selectedColumn,
                            value,
                            operator: supportsOperators
                              ? emptyFilterOperator
                              : undefined,
                          },
                        ]);
                        setEmptyFilterValue("");
                        setEmptyFilterColumn("");
                        setEmptyFilterOperator("=");
                      }
                    };

                    if (isUserType) {
                      return (
                        <Select
                          value={emptyFilterValue}
                          onValueChange={commonOnSelectValueChange}
                        >
                          <SelectTrigger isDark={isDark} className="w-full">
                            <SelectValue placeholder="Select user type..." />
                          </SelectTrigger>
                          <SelectContent isDark={isDark}>
                            <SelectItem value="creator" isDark={isDark}>
                              Creator
                            </SelectItem>
                            <SelectItem value="advertiser" isDark={isDark}>
                              Advertiser
                            </SelectItem>
                            <SelectItem value="admin" isDark={isDark}>
                              Admin
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      );
                    }

                    if (isGender) {
                      return (
                        <Select
                          value={emptyFilterValue}
                          onValueChange={commonOnSelectValueChange}
                        >
                          <SelectTrigger isDark={isDark} className="w-full">
                            <SelectValue placeholder="Select gender..." />
                          </SelectTrigger>
                          <SelectContent isDark={isDark}>
                            <SelectItem value="Male" isDark={isDark}>
                              Male
                            </SelectItem>
                            <SelectItem value="Female" isDark={isDark}>
                              Female
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      );
                    }

                    // For earnings and integer fields, show operator dropdown + input
                    if (supportsOperators) {
                      return (
                        <div className="flex gap-2">
                          <Select
                            value={emptyFilterOperator}
                            onValueChange={setEmptyFilterOperator}
                          >
                            <SelectTrigger isDark={isDark} className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent isDark={isDark}>
                              <SelectItem value="=" isDark={isDark}>
                                =
                              </SelectItem>
                              <SelectItem value="!=" isDark={isDark}>
                                &ne;
                              </SelectItem>
                              <SelectItem value=">" isDark={isDark}>
                                &gt;
                              </SelectItem>
                              <SelectItem value="<" isDark={isDark}>
                                &lt;
                              </SelectItem>
                              <SelectItem value=">=" isDark={isDark}>
                                &gt;=
                              </SelectItem>
                              <SelectItem value="<=" isDark={isDark}>
                                &lt;=
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          {isEarningsField || isMoneyField ? (
                            <div className="flex flex-1">
                              <span
                                className={cn(
                                  "inline-flex items-center justify-center px-2 text-xs border border-r-0 rounded-l-md",
                                  isDark
                                    ? "bg-[#07031D] border-gray-700 text-white"
                                    : "bg-gray-50 text-gray-700 border-gray-300"
                                )}
                              >
                                $
                              </span>
                              <Input
                                type="text"
                                value={emptyFilterValue}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setEmptyFilterValue(value);
                                  const selectedColumn =
                                    emptyFilterColumn ||
                                    allColumns[
                                      activeTab as keyof typeof allColumns
                                    ].filter(
                                      (column) => column.id !== "profile"
                                    )[0]?.id ||
                                    "";
                                  if (selectedColumn && value) {
                                    setFilters([
                                      {
                                        id: `filter-${Date.now()}-${Math.random()}`,
                                        column: selectedColumn,
                                        value: value,
                                        operator: emptyFilterOperator,
                                      },
                                    ]);
                                    setEmptyFilterValue("");
                                    setEmptyFilterColumn("");
                                    setEmptyFilterOperator("=");
                                  }
                                }}
                                placeholder="Enter amount..."
                                className={cn(
                                  "rounded-l-none border-l-0 flex-1",
                                  isDark
                                    ? "bg-[#07031D] border-gray-700 text-white"
                                    : "bg-white border-gray-300"
                                )}
                              />
                            </div>
                          ) : isDateField ? (
                            <Input
                              type="date"
                              value={emptyFilterValue}
                              onChange={(e) => {
                                const value = e.target.value;
                                setEmptyFilterValue(value);
                                const selectedColumn =
                                  emptyFilterColumn ||
                                  allColumns[
                                    activeTab as keyof typeof allColumns
                                  ].filter(
                                    (column) => column.id !== "profile"
                                  )[0]?.id ||
                                  "";
                                if (selectedColumn && value) {
                                  setFilters([
                                    {
                                      id: `filter-${Date.now()}-${Math.random()}`,
                                      column: selectedColumn,
                                      value: value,
                                      operator: emptyFilterOperator,
                                    },
                                  ]);
                                  setEmptyFilterValue("");
                                  setEmptyFilterColumn("");
                                  setEmptyFilterOperator("=");
                                }
                              }}
                              placeholder="Select date..."
                              className={cn(
                                "flex-1",
                                isDark
                                  ? "bg-[#07031D] border-gray-700 text-white"
                                  : "bg-white border-gray-300"
                              )}
                            />
                          ) : (
                            <Input
                              type="text"
                              value={emptyFilterValue}
                              onChange={(e) => {
                                const value = e.target.value;
                                setEmptyFilterValue(value);
                                const selectedColumn =
                                  emptyFilterColumn ||
                                  allColumns[
                                    activeTab as keyof typeof allColumns
                                  ].filter(
                                    (column) => column.id !== "profile"
                                  )[0]?.id ||
                                  "";
                                if (selectedColumn && value) {
                                  setFilters([
                                    {
                                      id: `filter-${Date.now()}-${Math.random()}`,
                                      column: selectedColumn,
                                      value: value,
                                      operator: emptyFilterOperator,
                                    },
                                  ]);
                                  setEmptyFilterValue("");
                                  setEmptyFilterColumn("");
                                  setEmptyFilterOperator("=");
                                }
                              }}
                              placeholder="Enter value..."
                              className={cn(
                                "flex-1",
                                isDark
                                  ? "bg-[#07031D] border-gray-700 text-white"
                                  : "bg-white border-gray-300"
                              )}
                            />
                          )}
                        </div>
                      );
                    }

                    return (
                      <Input
                        type={isDateField ? "date" : "text"}
                        value={emptyFilterValue}
                        onChange={(e) => {
                          const value = e.target.value;
                          setEmptyFilterValue(value);
                          const selectedColumn =
                            emptyFilterColumn ||
                            allColumns[
                              activeTab as keyof typeof allColumns
                            ].filter((column) => column.id !== "profile")[0]
                              ?.id ||
                            "";
                          if (selectedColumn && value) {
                            setFilters([
                              {
                                id: `filter-${Date.now()}-${Math.random()}`,
                                column: selectedColumn,
                                value: value,
                              },
                            ]);
                            setEmptyFilterValue("");
                            setEmptyFilterColumn("");
                          }
                        }}
                        placeholder={
                          isDateField
                            ? "Select date..."
                            : "Enter filter value..."
                        }
                        className={cn(
                          isDark
                            ? "bg-[#07031D] border-gray-700 text-white"
                            : "bg-white"
                        )}
                      />
                    );
                  })()}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled
                  className="text-gray-400 cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              filters.map((filter) => (
                <div
                  key={filter.id}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-lg border",
                    isDark
                      ? "bg-[#1a102b] border-gray-700"
                      : "bg-gray-50 border-gray-200"
                  )}
                >
                  <div className="flex-1">
                    <Select
                      value={filter.column}
                      onValueChange={(value) => {
                        setFilters(
                          filters.map((f) =>
                            f.id === filter.id
                              ? {
                                  ...f,
                                  column: value,
                                  // Clear the previous text/value when changing the column,
                                  // so old filter text doesn't remain attached to the new field.
                                  value: "",
                                  operator: undefined,
                                }
                              : f
                          )
                        );
                      }}
                    >
                      <SelectTrigger isDark={isDark} className="w-full">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent isDark={isDark}>
                        {allColumns[activeTab as keyof typeof allColumns]
                          .filter((column) => column.id !== "profile")
                          .map((column) => (
                            <SelectItem
                              key={column.id}
                              value={column.id}
                              isDark={isDark}
                            >
                              {column.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    {filter.column === "user_type" ? (
                      <Select
                        value={filter.value}
                        onValueChange={(value) => {
                          setFilters(
                            filters.map((f) =>
                              f.id === filter.id ? { ...f, value } : f
                            )
                          );
                        }}
                      >
                        <SelectTrigger isDark={isDark} className="w-full">
                          <SelectValue placeholder="Select user type..." />
                        </SelectTrigger>
                        <SelectContent isDark={isDark}>
                          <SelectItem value="creator" isDark={isDark}>
                            Creator
                          </SelectItem>
                          <SelectItem value="advertiser" isDark={isDark}>
                            Advertiser
                          </SelectItem>
                          <SelectItem value="admin" isDark={isDark}>
                            Admin
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : filter.column === "subscription_info" ? (
                      <Select
                        value={filter.value}
                        onValueChange={(value) => {
                          setFilters(
                            filters.map((f) =>
                              f.id === filter.id ? { ...f, value } : f
                            )
                          );
                        }}
                      >
                        <SelectTrigger isDark={isDark} className="w-full">
                          <SelectValue placeholder="Select plan..." />
                        </SelectTrigger>
                        <SelectContent isDark={isDark}>
                          {availableSubscriptionPlans.map((plan) => (
                            <SelectItem
                              key={plan.id}
                              value={plan.name}
                              isDark={isDark}
                            >
                              {plan.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : filter.column === "gender" ? (
                      <Select
                        value={filter.value}
                        onValueChange={(value) => {
                          setFilters(
                            filters.map((f) =>
                              f.id === filter.id ? { ...f, value } : f
                            )
                          );
                        }}
                      >
                        <SelectTrigger isDark={isDark} className="w-full">
                          <SelectValue placeholder="Select gender..." />
                        </SelectTrigger>
                        <SelectContent isDark={isDark}>
                          <SelectItem value="Male" isDark={isDark}>
                            Male
                          </SelectItem>
                          <SelectItem value="Female" isDark={isDark}>
                            Female
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      (() => {
                        const earningsFields = [
                          "affiliate_earnings",
                          "other_earnings",
                        ];
                        const integerFields = [
                          "coins",
                          "advertisers_referred",
                          "creators_referred",
                          "total_lifetime_coins",
                          "total_contests_run",
                          "contests_participated",
                          "contests_won",
                          "total_views",
                          "total_submissions_made",
                          "total_submissions_won",
                        ];
                        const moneyFields = [
                          "total_money_spent",
                          "available_deposit_balance",
                          "withdrawable_balance",
                          "total_money_won",
                        ];
                        const dateFields = [
                          "created_at",
                          "updated_at",
                          "date_of_birth",
                        ];
                        const isEarningsField = earningsFields.includes(
                          filter.column
                        );
                        const isIntegerField = integerFields.includes(
                          filter.column
                        );
                        const isMoneyField = moneyFields.includes(
                          filter.column
                        );
                        const isDateField = dateFields.includes(filter.column);
                        const supportsOperators =
                          isEarningsField ||
                          isMoneyField ||
                          isIntegerField ||
                          isDateField;

                        if (isEarningsField || isMoneyField) {
                          return (
                            <div className="flex gap-2">
                              {supportsOperators && (
                                <Select
                                  value={filter.operator || "="}
                                  onValueChange={(value) => {
                                    setFilters(
                                      filters.map((f) =>
                                        f.id === filter.id
                                          ? { ...f, operator: value }
                                          : f
                                      )
                                    );
                                  }}
                                >
                                  <SelectTrigger
                                    isDark={isDark}
                                    className="w-24"
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent isDark={isDark}>
                                    <SelectItem value="=" isDark={isDark}>
                                      =
                                    </SelectItem>
                                    <SelectItem value="!=" isDark={isDark}>
                                      &ne;
                                    </SelectItem>
                                    <SelectItem value=">" isDark={isDark}>
                                      &gt;
                                    </SelectItem>
                                    <SelectItem value="<" isDark={isDark}>
                                      &lt;
                                    </SelectItem>
                                    <SelectItem value=">=" isDark={isDark}>
                                      &gt;=
                                    </SelectItem>
                                    <SelectItem value="<=" isDark={isDark}>
                                      &lt;=
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                              <div className="flex flex-1">
                                <span
                                  className={cn(
                                    "inline-flex items-center justify-center px-2 text-xs border border-r-0 rounded-l-md",
                                    isDark
                                      ? "bg-[#07031D] border-gray-700 text-white"
                                      : "bg-gray-50 text-gray-700 border-gray-300"
                                  )}
                                >
                                  $
                                </span>
                                <Input
                                  type="text"
                                  value={filter.value}
                                  onChange={(e) => {
                                    setFilters(
                                      filters.map((f) =>
                                        f.id === filter.id
                                          ? { ...f, value: e.target.value }
                                          : f
                                      )
                                    );
                                  }}
                                  placeholder="Enter amount..."
                                  className={cn(
                                    "rounded-l-none border-l-0 flex-1",
                                    isDark
                                      ? "bg-[#07031D] border-gray-700 text-white"
                                      : "bg-white border-gray-300"
                                  )}
                                />
                              </div>
                            </div>
                          );
                        }

                        if (isIntegerField) {
                          return (
                            <div className="flex gap-2">
                              <Select
                                value={filter.operator || "="}
                                onValueChange={(value) => {
                                  setFilters(
                                    filters.map((f) =>
                                      f.id === filter.id
                                        ? { ...f, operator: value }
                                        : f
                                    )
                                  );
                                }}
                              >
                                <SelectTrigger isDark={isDark} className="w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent isDark={isDark}>
                                  <SelectItem value="=" isDark={isDark}>
                                    =
                                  </SelectItem>
                                  <SelectItem value="!=" isDark={isDark}>
                                    &ne;
                                  </SelectItem>
                                  <SelectItem value=">" isDark={isDark}>
                                    &gt;
                                  </SelectItem>
                                  <SelectItem value="<" isDark={isDark}>
                                    &lt;
                                  </SelectItem>
                                  <SelectItem value=">=" isDark={isDark}>
                                    &gt;=
                                  </SelectItem>
                                  <SelectItem value="<=" isDark={isDark}>
                                    &lt;=
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                type="text"
                                value={filter.value}
                                onChange={(e) => {
                                  setFilters(
                                    filters.map((f) =>
                                      f.id === filter.id
                                        ? { ...f, value: e.target.value }
                                        : f
                                    )
                                  );
                                }}
                                placeholder="Enter value..."
                                className={cn(
                                  "flex-1",
                                  isDark
                                    ? "bg-[#07031D] border-gray-700 text-white"
                                    : "bg-white border-gray-300"
                                )}
                              />
                            </div>
                          );
                        }

                        if (isDateField) {
                          return (
                            <div className="flex gap-2">
                              <Select
                                value={filter.operator || "="}
                                onValueChange={(value) => {
                                  setFilters(
                                    filters.map((f) =>
                                      f.id === filter.id
                                        ? { ...f, operator: value }
                                        : f
                                    )
                                  );
                                }}
                              >
                                <SelectTrigger isDark={isDark} className="w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent isDark={isDark}>
                                  <SelectItem value="=" isDark={isDark}>
                                    =
                                  </SelectItem>
                                  <SelectItem value="!=" isDark={isDark}>
                                    &ne;
                                  </SelectItem>
                                  <SelectItem value=">" isDark={isDark}>
                                    &gt;
                                  </SelectItem>
                                  <SelectItem value="<" isDark={isDark}>
                                    &lt;
                                  </SelectItem>
                                  <SelectItem value=">=" isDark={isDark}>
                                    &gt;=
                                  </SelectItem>
                                  <SelectItem value="<=" isDark={isDark}>
                                    &lt;=
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                type="date"
                                value={filter.value}
                                onChange={(e) => {
                                  setFilters(
                                    filters.map((f) =>
                                      f.id === filter.id
                                        ? { ...f, value: e.target.value }
                                        : f
                                    )
                                  );
                                }}
                                placeholder="Select date..."
                                className={cn(
                                  "flex-1",
                                  isDark
                                    ? "bg-[#07031D] border-gray-700 text-white"
                                    : "bg-white border-gray-300"
                                )}
                              />
                            </div>
                          );
                        }

                        return (
                          <Input
                            type={
                              filter.column === "created_at" ||
                              filter.column === "updated_at" ||
                              filter.column === "date_of_birth"
                                ? "date"
                                : "text"
                            }
                            value={filter.value}
                            onChange={(e) => {
                              setFilters(
                                filters.map((f) =>
                                  f.id === filter.id
                                    ? { ...f, value: e.target.value }
                                    : f
                                )
                              );
                            }}
                            placeholder={
                              filter.column === "created_at" ||
                              filter.column === "updated_at" ||
                              filter.column === "date_of_birth"
                                ? "Select date..."
                                : "Enter filter value..."
                            }
                            className={cn(
                              isDark
                                ? "bg-[#07031D] border-gray-700 text-white"
                                : "bg-white"
                            )}
                          />
                        );
                      })()
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setFilters(filters.filter((f) => f.id !== filter.id));
                    }}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
            <Button
              variant="outline"
              onClick={() => {
                const availableColumns = allColumns[
                  activeTab as keyof typeof allColumns
                ].filter((column) => column.id !== "profile");
                setFilters([
                  ...filters,
                  {
                    id: `filter-${Date.now()}-${Math.random()}`,
                    column: availableColumns[0]?.id || "",
                    value: "",
                  },
                ]);
              }}
              className={cn(
                "w-full",
                isDark
                  ? "border-gray-700 text-white hover:bg-gray-800"
                  : "border-gray-300"
              )}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Filter
            </Button>
            {filters.length > 0 && (
              <div className="flex gap-2 justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters([]);
                  }}
                  className={cn(
                    isDark ? "border-gray-700 text-white hover:bg-gray-800" : ""
                  )}
                >
                  Clear All
                </Button>
                <Button
                  onClick={() => {
                    setShowFilterModal(false);
                  }}
                  className={cn(
                    "bg-purple-600 text-white hover:bg-purple-700",
                    isDark && "bg-purple-600 hover:bg-purple-700"
                  )}
                >
                  Apply Filters
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isSubscriptionDialogOpen}
        onOpenChange={setIsSubscriptionDialogOpen}
        isdark={isDark}
      >
        <DialogContent
          className={cn(
            "max-w-3xl max-h-[80vh] overflow-y-auto",
            isDark ? "text-white" : "text-gray-900"
          )}
        >
          <DialogHeader>
            <DialogTitle
              className={cn(
                "text-xl font-semibold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              Subscription Information
            </DialogTitle>
            <DialogDescription
              className={cn("mt-1", isDark ? "text-gray-300" : "text-gray-600")}
            >
              Overview of the advertiser&apos;s current subscription plan,
              billing, and status details.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-6">
            {selectedSubscriptionInfo ? (
              (() => {
                let info: any = selectedSubscriptionInfo;
                try {
                  if (typeof info === "string") {
                    info = JSON.parse(info);
                  }
                } catch {
                  // Keep raw info if JSON parsing fails
                }

                const plan =
                  info && info.product_id
                    ? getSubscriptionPlanById(info.product_id)
                    : null;
                const planName =
                  plan?.displayName ||
                  plan?.name ||
                  info?.plan_name ||
                  "Unknown";

                const amountCents =
                  typeof info?.price_amount === "number"
                    ? info.price_amount
                    : typeof info?.amount_cents === "number"
                    ? info.amount_cents
                    : undefined;
                const formattedAmount =
                  amountCents !== undefined
                    ? `$${(amountCents / 100).toFixed(2)}`
                    : "-";

                const status = info?.status || info?.subscription_status;
                const interval =
                  info?.interval ||
                  info?.billing_interval ||
                  (info?.price_interval || "").toLowerCase();

                const currentPeriodStart =
                  info?.current_period_start || info?.billing_period_start;
                const currentPeriodEnd =
                  info?.current_period_end || info?.billing_period_end;
                const cancelAtPeriodEnd = info?.cancel_at_period_end;

                const formatDate = (value: any) => {
                  if (!value) return "-";
                  try {
                    const d =
                      typeof value === "string" || typeof value === "number"
                        ? new Date(value)
                        : value;
                    if (Number.isNaN(d.getTime())) return String(value);
                    return d.toLocaleString();
                  } catch {
                    return String(value);
                  }
                };

                const statusColorClasses =
                  status === "active" || status === "trialing"
                    ? isDark
                      ? "bg-emerald-900/60 text-emerald-200 border-emerald-700"
                      : "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : status === "canceled" || status === "incomplete_expired"
                    ? isDark
                      ? "bg-rose-900/60 text-rose-200 border-rose-700"
                      : "bg-rose-50 text-rose-700 border-rose-300"
                    : status === "past_due" || status === "unpaid"
                    ? isDark
                      ? "bg-amber-900/60 text-amber-200 border-amber-700"
                      : "bg-amber-50 text-amber-700 border-amber-300"
                    : isDark
                    ? "bg-slate-800 text-slate-100 border-slate-700"
                    : "bg-slate-50 text-slate-700 border-slate-300";

                return (
                  <div className="space-y-6">
                    {/* Top summary card */}
                    <div
                      className={cn(
                        "rounded-xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4",
                        isDark
                          ? "bg-[#1a102b] border-purple-700/50"
                          : "bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-100"
                      )}
                    >
                      <div className="space-y-1.5">
                        <p
                          className={cn(
                            "text-xs uppercase tracking-wide",
                            isDark ? "text-gray-300" : "text-gray-600"
                          )}
                        >
                          Current Plan
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-semibold">
                            {planName}
                          </span>
                          {interval && (
                            <span className="text-xs rounded-full border px-2 py-0.5 uppercase tracking-wide">
                              {interval}
                            </span>
                          )}
                        </div>
                        <p
                          className={cn(
                            "text-sm",
                            isDark ? "text-gray-200" : "text-gray-900"
                          )}
                        >
                          {formattedAmount}{" "}
                          {interval ? `/ ${interval.toLowerCase()}` : ""}
                        </p>
                      </div>

                      <div className="flex flex-col items-start sm:items-end gap-2">
                        {status && (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
                              statusColorClasses
                            )}
                          >
                            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                            {String(status).replace(/_/g, " ")}
                          </span>
                        )}
                        {cancelAtPeriodEnd && (
                          <span className="text-xs text-amber-500">
                            Will cancel at end of current period
                          </span>
                        )}
                        {info?.last_synced && (
                          <span className="text-xs text-muted-foreground">
                            Last synced: {formatDate(info.last_synced)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Billing period & IDs */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div
                        className={cn(
                          "rounded-lg border p-4 space-y-2",
                          isDark
                            ? "bg-[#130b21] border-slate-700"
                            : "bg-white border-slate-200"
                        )}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Billing Period
                        </p>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                              Current period start
                            </span>
                            <span className="font-medium text-right">
                              {formatDate(currentPeriodStart)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                              Current period end
                            </span>
                            <span className="font-medium text-right">
                              {formatDate(currentPeriodEnd)}
                            </span>
                          </div>
                          {info?.trial_start || info?.trial_end ? (
                            <>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">
                                  Trial start
                                </span>
                                <span className="font-medium text-right">
                                  {formatDate(info.trial_start)}
                                </span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">
                                  Trial end
                                </span>
                                <span className="font-medium text-right">
                                  {formatDate(info.trial_end)}
                                </span>
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div
                        className={cn(
                          "rounded-lg border p-4 space-y-2",
                          isDark
                            ? "bg-[#130b21] border-slate-700"
                            : "bg-white border-slate-200"
                        )}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Stripe Identifiers
                        </p>
                        <div className="space-y-1.5 text-xs sm:text-sm">
                          {info?.subscription_id && (
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">
                                Subscription ID
                              </span>
                              <span className="font-mono text-[11px] sm:text-xs text-right break-all">
                                {info.subscription_id}
                              </span>
                            </div>
                          )}
                          {info?.price_id && (
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">
                                Price ID
                              </span>
                              <span className="font-mono text-[11px] sm:text-xs text-right break-all">
                                {info.price_id}
                              </span>
                            </div>
                          )}
                          {info?.product_id && (
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">
                                Product ID
                              </span>
                              <span className="font-mono text-[11px] sm:text-xs text-right break-all">
                                {info.product_id}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <p
                className={cn(
                  "text-sm",
                  isDark ? "text-gray-300" : "text-muted-foreground"
                )}
              >
                No subscription information is available for this advertiser.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isSubcategoriesDialogOpen}
        onOpenChange={setIsSubcategoriesDialogOpen}
        isdark={isDark}
      >
        <DialogContent
          className={cn(
            "max-w-3xl max-h-[80vh] overflow-y-auto",
            isDark ? "text-white" : "text-gray-900"
          )}
        >
          <DialogHeader>
            <DialogTitle
              className={cn(isDark ? "text-white" : "text-gray-900")}
            >
              Subcategories
            </DialogTitle>
            <DialogDescription
              className={cn(isDark ? "text-gray-300" : "text-gray-600")}
            >
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
                        // Could be a different object format, format it nicely
                        // Try to extract meaningful properties
                        const keys = Object.keys(item);
                        if (keys.length > 0) {
                          // If object has a name or title, use that
                          const displayValue =
                            item.name ||
                            item.title ||
                            item.label ||
                            (keys.length === 1
                              ? item[keys[0]]
                              : JSON.stringify(item));
                          flatSubcategories.push(String(displayValue));
                        } else {
                          flatSubcategories.push(JSON.stringify(item));
                        }
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
                        } else if (typeof item === "object" && item !== null) {
                          // Handle objects in parsed array
                          const keys = Object.keys(item);
                          if (keys.length > 0) {
                            const displayValue =
                              item.name ||
                              item.title ||
                              item.label ||
                              (keys.length === 1
                                ? item[keys[0]]
                                : JSON.stringify(item));
                            flatSubcategories.push(String(displayValue));
                          } else {
                            flatSubcategories.push(JSON.stringify(item));
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
                  <p
                    className={cn(
                      isDark ? "text-gray-300" : "text-muted-foreground"
                    )}
                  >
                    No subcategories available
                  </p>
                );
              }

              return (
                <div className="space-y-6">
                  {/* Summary */}
                  <div>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isDark ? "text-gray-200" : "text-gray-900"
                      )}
                    >
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
                            <h3
                              className={cn(
                                "text-base font-semibold capitalize",
                                isDark ? "text-white" : "text-foreground"
                              )}
                            >
                              {category}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {subcats.map((subcat, index) => (
                                <Badge
                                  key={index}
                                  variant="secondary"
                                  className={cn(
                                    "text-sm py-1.5 px-3 font-normal",
                                    isDark
                                      ? "bg-[#391A6A] text-gray-200 border-purple-500"
                                      : ""
                                  )}
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
                      <h3
                        className={cn(
                          "text-base font-semibold",
                          isDark ? "text-white" : "text-foreground"
                        )}
                      >
                        Other Subcategories
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {flatSubcategories.map((subcat, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className={cn(
                              "text-sm py-1.5 px-3 font-normal",
                              isDark
                                ? "bg-[#391A6A] text-gray-200 border-purple-500"
                                : ""
                            )}
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
        isdark={isDark}
      >
        <DialogContent
          className={cn(
            "max-w-3xl max-h-[80vh] overflow-y-auto",
            isDark ? "text-white" : "text-gray-900"
          )}
        >
          <DialogHeader>
            <DialogTitle
              className={cn(isDark ? "text-white" : "text-gray-900")}
            >
              All Interests
            </DialogTitle>
            <DialogDescription
              className={cn(isDark ? "text-gray-300" : "text-gray-600")}
            >
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
                  <p
                    className={cn(
                      isDark ? "text-gray-300" : "text-muted-foreground"
                    )}
                  >
                    No interests available
                  </p>
                );
              }

              return (
                <div className="space-y-6">
                  {/* Summary */}
                  <div>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isDark ? "text-gray-200" : "text-gray-900"
                      )}
                    >
                      Total: {totalCount} interests
                    </span>
                  </div>

                  {/* Interests as badges */}
                  <div className="flex flex-wrap gap-2">
                    {interestsArray.map((interest, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className={cn(
                          "text-sm py-1.5 px-3 font-normal",
                          isDark
                            ? "bg-[#391A6A] text-gray-200 border-purple-500"
                            : ""
                        )}
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
