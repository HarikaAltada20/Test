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
import { Settings, X, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  // Sort state per tab - each tab maintains its own sort state
  const [sortState, setSortState] = useState<
    Record<string, { column: string | null; order: "asc" | "desc" | null }>
  >({
    all: { column: null, order: null },
    advertisers: { column: null, order: null },
    creators: { column: null, order: null },
  });

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

          // Get values based on sort column
          switch (sortColumn) {
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

          // Get values based on sort column
          switch (sortColumn) {
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

          // Get values based on sort column
          switch (sortColumn) {
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
    }

    return filtered;
  }, [rows, activeTab, sortOrder, sortColumn]);

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

  // Reset to page 1 when tab changes (sort state is preserved)
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
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className={cn(isDark ? "text-white" : "text-black")}>
              Users Management
            </CardTitle>
            <div className="flex items-center gap-2">
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
        <CardContent className="space-y-4">
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
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow
                  className={cn(
                    "text-left border-b",
                    isDark
                      ? "bg-[#391A6A] text-white"
                      : "bg-[#F9FAFB] border-b border-slate-200 text-gray-500"
                  )}
                >
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
                      {isColumnVisible("username") && (
                        <TableHead className="whitespace-nowrap border-r">
                          Username
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
                        <TableHead className="whitespace-nowrap">
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
                            {isColumnVisible("username") && (
                              <TableCell className="whitespace-nowrap border-r">
                                {r.username || "N/A"}
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
