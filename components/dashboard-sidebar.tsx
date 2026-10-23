"use client";

import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageCircle,
  Trophy,
  Users,
  BarChart,
  Settings,
  LogOut,
  ChevronsUpDown,
  Video,
  DollarSign,
  CreditCard,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  BarChart3,
  FileText,
  Briefcase,
  Shield,
  User,
  Phone,
  HelpCircle,
  Award,
  PlusCircle,
  Newspaper,
  Star,
  Flame,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { ButtonLoadingSpinner } from "@/components/loading/LoadingSpinner";

function PlanUsageGauge({
  used,
  limit,
  isDark,
}: {
  used: number;
  limit: number;
  isDark: boolean;
}) {
  const safeLimit = Math.max(limit, 1);
  const ratio = Math.min(Math.max(used, 0) / safeLimit, 1);
  const radius = 64;
  const length = Math.PI * radius;
  const progress = length * ratio;
  const track = isDark ? "rgba(255,255,255,0.16)" : "#e6e6e8";
  const fill = isDark ? "#ffffff" : "#1a1a1a";

  return (
    <div className="relative mx-auto h-[78px] w-[168px]">
      <svg viewBox="0 0 160 88" className="h-full w-full" aria-hidden>
        <path
          d="M 16 76 A 64 64 0 0 1 144 76"
          fill="none"
          stroke={track}
          strokeWidth="10"
          strokeLinecap="round"
        />
        {progress > 0 && (
          <path
            d="M 16 76 A 64 64 0 0 1 144 76"
            fill="none"
            stroke={fill}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${progress} ${length}`}
          />
        )}
        <circle cx="16" cy="76" r="4.5" fill={fill} />
      </svg>
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 text-center text-[15px] font-semibold tracking-tight",
          isDark ? "text-white" : "text-[#1a1a1a]",
        )}
      >
        {used} / {limit} live
      </div>
    </div>
  );
}

interface DashboardSidebarProps {
  userRole?: "advertiser" | "creator" | "admin";
  collapsed?: boolean;
  onChatOpen: () => void;
  onReviewOpen: () => void;
  mode?: "light" | "dark";
  supportChatEnabled?: boolean;
  planName?: string;
  planLimit?: number;
  liveCampaignCount?: number;
  userName?: string;
  userEmail?: string;
  avatarUrl?: string;
  onSignOut?: () => void;
  isSigningOut?: boolean;
}

export function DashboardSidebar({
  userRole = "advertiser",
  onChatOpen,
  onReviewOpen,
  collapsed = false,
  mode,
  supportChatEnabled = true,
  planName = "Explorer",
  planLimit = 1,
  liveCampaignCount = 0,
  userName = "User",
  userEmail = "",
  avatarUrl = "",
  onSignOut,
  isSigningOut = false,
}: DashboardSidebarProps) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const [showScrollbar, setShowScrollbar] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [isOthersDropdownOpen, setIsOthersDropdownOpen] = useState(false);
  const [navigatingLink, setNavigatingLink] = useState<string | null>(null);

  const handleNavigation = (href: string) => {
    setNavigatingLink(href);
  };

  useEffect(() => {
    setNavigatingLink(null);
  }, [pathname]);
  const isDark = mode === "dark";

  // Auto-open Others dropdown if current path matches any dropdown item
  useEffect(() => {
    if (userRole === "admin") {
      const othersDropdownItems = [
        "/dashboard/admin/manual-entry",
        "/dashboard/admin/ratings",
        "/dashboard/admin/others",
      ];
      const shouldBeOpen = othersDropdownItems.some((href) =>
        pathname.startsWith(href),
      );
      setIsOthersDropdownOpen(shouldBeOpen);
    }
  }, [pathname, userRole]);

  // Check if screen is mobile size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Handle mouse enter on sidebar - show scrollbar immediately
  const handleMouseEnter = () => {
    if (!isMobile) {
      setShowScrollbar(true);
    }
  };

  // Handle mouse leave from sidebar - hide scrollbar immediately
  const handleMouseLeave = () => {
    if (!isMobile) {
      setShowScrollbar(false);
    }
  };

  const advertiserSections = [
    {
      label: "Workspace",
      items: [
        {
          name: "Overview",
          href: "/dashboard",
          icon: LayoutDashboard,
          description: "Overview & analytics",
        },
        {
          name: "Campaigns",
          href: "/dashboard/contests",
          icon: Trophy,
          description: "Create/Manage Campaigns",
        },
        {
          name: "Allowlists",
          href: "/dashboard/allowlists",
          icon: Users,
          description: "Creator lists for private campaigns",
        },
      ],
    },
    {
      label: "Business",
      items: [
        {
          name: "Analytics",
          href: "/dashboard/analytics",
          icon: BarChart,
          description: "Performance insights",
        },
        {
          name: "Finance",
          href: "/dashboard/billing",
          icon: CreditCard,
          description: "Balance, transactions & Subscriptions",
        },
      ],
    },
    {
      label: "",
      items: [
        {
          name: "Settings",
          href: "/dashboard/settings",
          icon: Settings,
          description: "Account preferences",
        },
        {
          name: "Help",
          href: "/dashboard/getting-started",
          icon: HelpCircle,
          description: "How it works",
        },
      ],
    },
  ];

  const adminLinks = [
    {
      name: "Admin Dashboard",
      href: "/dashboard/admin",
      icon: LayoutDashboard,
      description: "Admin overview",
    },

    {
      name: "Users",
      href: "/dashboard/admin/users",
      icon: Users,
      description: "Manage all users",
    },
    {
      name: "All Campaigns",
      href: "/dashboard/admin/contests",
      icon: Trophy,
      description: "Manage all contests",
    },
    {
      name: "Campaign Moderation",
      href: "/dashboard/admin/contest-moderation",
      icon: Shield,
      description: "Review & approve campaigns",
    },
    {
      name: "Analytics",
      href: "/dashboard/admin/analytics",
      icon: BarChart,
      description: "Platform performance",
    },
    {
      name: "Leaderboard",
      href: "/dashboard/admin/leaderboard",
      icon: Award,
      description: "Top creators",
    },
    {
      name: "Daily Challenge",
      href: "/dashboard/daily-challenge",
      icon: Flame,
      description: "Competition overview",
    },
    {
      name: "Withdrawal Requests",
      href: "/dashboard/admin/withdrawals",
      icon: DollarSign,
      description: "Manage payout withdrawals",
    },
    {
      name: "Payout Methods",
      href: "/dashboard/admin/payout-methods",
      icon: CreditCard,
      description: "User payout methods & Skydo",
    },
    {
      name: "Affiliate",
      href: "/dashboard/admin/affiliate",
      icon: BarChart3,
      description: "Commissions & credits",
    },
    {
      name: "Blogs",
      href: "/dashboard/admin/blogs",
      icon: Newspaper,
      description: "Create and manage blog posts",
    },
    {
      name: "Support",
      href: "/dashboard/admin/support",
      icon: HelpCircle,
      description: "Queries & contacts",
    },
  ];

  const othersDropdownItems = [
    {
      name: "Manual Entry",
      href: "/dashboard/admin/manual-entry",
      icon: PlusCircle,
      description: "Credit coins or cash to users",
    },
    {
      name: "Rating",
      href: "/dashboard/admin/ratings",
      icon: Star,
      description: "View user reviews and ratings",
    },
  ];

  const creatorLinks = [
    {
      name: "Getting Started",
      href: "/dashboard/getting-started",
      icon: HelpCircle,
      description: "How it works",
    },
    {
      name: "Campaigns",
      href: "/dashboard/opportunities",
      icon: Trophy,
      description: "Available contests",
    },
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      description: "Your overview",
    },
    {
      name: "My Submissions",
      href: "/dashboard/submissions",
      icon: Video,
      description: "Content submissions",
    },
    {
      name: "My Applications",
      href: "/dashboard/my-applications",
      icon: ClipboardList,
      description: "Campaigns you applied to",
    },

    {
      name: "Leaderboard",
      href: "/dashboard/leaderboard",
      icon: Award,
      description: "Top creators",
    },
    {
      name: "Daily Challenge",
      href: "/dashboard/daily-challenge",
      icon: Flame,
      description: "Daily competition engine",
    },
    {
      name: "Wallet",
      href: "/dashboard/earnings",
      icon: DollarSign,
      description: "Earnings & Transactions",
    },
    {
      name: "Settings",
      href: "/dashboard/settings",
      icon: Settings,
      description: "Account preferences",
    },
  ];

  const sections =
    userRole === "advertiser"
      ? advertiserSections
      : [
          {
            label: "",
            items: userRole === "admin" ? adminLinks : creatorLinks,
          },
        ];

  const links = sections.flatMap((section) => section.items);

  // Ensure scroll container is properly sized and can scroll
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      // Force browser to recalculate scroll height
      const checkScroll = () => {
        if (container.scrollHeight > container.clientHeight) {
          // Content overflows, ensure scrolling is enabled
          container.style.overflowY = "auto";
        }
      };

      // Check immediately and after a short delay
      checkScroll();
      const timeout = setTimeout(checkScroll, 100);

      // Also check on resize
      window.addEventListener("resize", checkScroll);

      return () => {
        clearTimeout(timeout);
        window.removeEventListener("resize", checkScroll);
      };
    }
  }, [links, userRole, collapsed]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountMenuOpen]);

  const initials =
    userName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U";
  const roleLabel =
    userRole === "advertiser"
      ? "Brand"
      : userRole === "creator"
        ? "Creator"
        : "Admin";

  const billingHref =
    userRole === "creator"
      ? "/dashboard/earnings"
      : "/dashboard/billing?tab=subscription";
  const helpHref =
    userRole === "admin"
      ? "/dashboard/admin/support"
      : "/dashboard/getting-started";

  return (
    <div
      className="dashboard-sidebar flex h-full w-full flex-col min-h-0"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Navigation Links - Full Height */}
      <div
        ref={scrollContainerRef}
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden transition-all duration-300",
          "scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 shadow-sm",
          isMobile || showScrollbar
            ? "sidebar-scrollbar"
            : "sidebar-scrollbar-hidden",
          "sm:hover:scrollbar-thumb-gray-400",
        )}
        style={{
          minHeight: 0,
          height: 0,
          flex: "1 1 0%",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
          boxSizing: "border-box",
        }}
      >
        {/* Removed Getting Started link for admin */}
        <div className={cn("pb-4", collapsed ? "px-2 pt-2" : "pl-5 pr-3 pt-3")}>
          <nav className={cn(collapsed && "space-y-1")}>
            {(() => {
              const itemClass = (active: boolean) =>
                cn(
                  "group flex w-full items-center rounded-lg text-sm font-medium transition-colors",
                  collapsed
                    ? "justify-center px-2 py-2.5"
                    : "gap-2.5 px-2.5 py-[7px]",
                  active
                    ? isDark
                      ? "bg-white/10 text-white"
                      : "bg-[#e6e6e8] text-[#1a1a1a]"
                    : isDark
                      ? "text-white/75 hover:bg-white/[0.06] hover:text-white"
                      : "text-[#3a3a40] hover:bg-white hover:text-[#1a1a1a]",
                );

              return (
                <>
                  {sections.map((section, sectionIndex) => (
                    <div
                      key={section.label || `section-${sectionIndex}`}
                      className={cn(sectionIndex > 0 && "mt-6")}
                    >
                      {section.label && !collapsed && (
                        <h3
                          className={cn(
                            "px-2.5 pb-1.5 pt-1 text-[13px] font-medium",
                            isDark ? "text-white/40" : "text-[#8b8b93]",
                          )}
                        >
                          {section.label}
                        </h3>
                      )}
                      <div className={cn(collapsed ? "space-y-1" : "space-y-1.5")}>
                        {section.items.map((link) => {
                          const isActive =
                            link.href === "/dashboard"
                              ? pathname === "/dashboard"
                              : pathname === link.href ||
                                pathname.startsWith(`${link.href}/`);
                          return (
                            <Link
                              key={link.href}
                              href={link.href}
                              onClick={() => handleNavigation(link.href)}
                              className={itemClass(isActive)}
                              title={collapsed ? link.name : link.description}
                            >
                              <link.icon
                                className={cn(
                                  "shrink-0",
                                  collapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
                                )}
                                strokeWidth={1.75}
                              />
                              {!collapsed && (
                                <>
                                  <span className="min-w-0 flex-1 truncate">
                                    {link.name}
                                  </span>
                                  {navigatingLink === link.href && (
                                    <ButtonLoadingSpinner />
                                  )}
                                </>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Others with Dropdown for Admin */}
                  {userRole === "admin" && (
                    <div className="space-y-0.5">
                      {(() => {
                        const isOthersActive =
                          isOthersDropdownOpen ||
                          pathname.startsWith(
                            "/dashboard/admin/manual-entry",
                          ) ||
                          pathname.startsWith("/dashboard/admin/ratings") ||
                          pathname.startsWith("/dashboard/admin/others");
                        return (
                          <>
                            <button
                              onClick={() =>
                                setIsOthersDropdownOpen(!isOthersDropdownOpen)
                              }
                              className={itemClass(isOthersActive)}
                              title={
                                collapsed ? "Others" : "Other admin functions"
                              }
                            >
                              <FileText
                                className={cn(
                                  "shrink-0",
                                  collapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
                                )}
                                strokeWidth={1.75}
                              />
                              {!collapsed && (
                                <>
                                  <span className="min-w-0 flex-1 truncate text-left">
                                    Others
                                  </span>
                                  {isOthersDropdownOpen ? (
                                    <ChevronUp className="h-4 w-4 shrink-0 opacity-60" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                                  )}
                                </>
                              )}
                            </button>

                            {isOthersDropdownOpen && !collapsed && (
                              <div className="space-y-0.5 pl-4">
                                {othersDropdownItems.map((item) => {
                                  const isItemActive = pathname === item.href;
                                  return (
                                    <Link
                                      key={item.href}
                                      href={item.href}
                                      onClick={() =>
                                        handleNavigation(item.href)
                                      }
                                      className={itemClass(isItemActive)}
                                      title={item.description}
                                    >
                                      <item.icon
                                        className="h-4 w-4 shrink-0"
                                        strokeWidth={1.75}
                                      />
                                      <span className="min-w-0 flex-1 truncate">
                                        {item.name}
                                      </span>
                                      {navigatingLink === item.href && (
                                        <ButtonLoadingSpinner />
                                      )}
                                    </Link>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </>
              );
            })()}
          </nav>
        </div>
        <div className={cn("mb-4 pb-8", collapsed ? "px-2" : "px-3")}>
          {userRole === "advertiser" && !collapsed && (
            <div
              className={cn(
                "rounded-2xl border px-4 pb-4 pt-3",
                isDark
                  ? "border-white/10 bg-white/5"
                  : "border-[#e7e7ea] bg-white shadow-sm",
              )}
            >
              <PlanUsageGauge
                used={liveCampaignCount}
                limit={planLimit}
                isDark={isDark}
              />
              <div className="mt-1 flex items-center justify-center gap-2 text-[13px]">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    isDark ? "bg-white" : "bg-[#1a1a1a]",
                  )}
                />
                <span className={isDark ? "text-white/80" : "text-[#3a3a40]"}>
                  On the {planName} plan
                </span>
              </div>
              <Link
                href="/dashboard/billing"
                className={cn(
                  "mt-4 flex items-center justify-between rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  isDark
                    ? "border-white/15 text-white hover:bg-white/5"
                    : "border-[#e4e4e7] text-[#1a1a1a] hover:bg-[#fafafa]",
                )}
              >
                See plans
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
          {/* We're here to help — commented out in favor of the plan card */}
          {false && userRole !== "admin" && (
            <div
              className={cn(
                "chat-card rounded-xl p-4",
                isDark
                  ? "border border-white/10 bg-white/5"
                  : "border border-[#e6e6e8] bg-white shadow-sm",
              )}
            >
              {!collapsed ? (
                <div className="flex flex-col gap-3">
                  <p
                    className={cn(
                      "text-md text-center font-medium",
                      isDark ? "text-white" : "text-[#1a1a1a]",
                    )}
                  >
                    We're here to help
                  </p>

                  <div className="flex py-2 justify-center">
                    <div className="rounded-full bg-purple-600 p-2">
                      <Phone size={23} className="text-white" />
                    </div>
                  </div>
                  <button
                    onClick={supportChatEnabled ? onChatOpen : undefined}
                    disabled={!supportChatEnabled}
                    title={
                      supportChatEnabled
                        ? "Chat with support"
                        : "Support chat is unavailable for your account"
                    }
                    className={cn(
                      "w-full rounded-xl py-2 transition text-white",
                      supportChatEnabled
                        ? "bg-purple-600 hover:bg-purple-700"
                        : "bg-gray-400 cursor-not-allowed opacity-70",
                    )}
                  >
                    {supportChatEnabled ? "Chat with Us" : "Chat unavailable"}
                  </button>

                  {/* Show Book a Call only for advertisers */}
                  {userRole === "advertiser" && (
                    <a
                      href="https://calendly.com/guptavishesh2/30min"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Book a free 30-min call with our founder"
                      className={cn(
                        "block w-full rounded-xl text-white py-2 text-center transition",
                        isDark
                          ? "bg-purple-700 hover:bg-purple-600"
                          : "bg-black hover:bg-gray-800",
                      )}
                    >
                      Book a Call with the Founder
                    </a>
                  )}

                  {/* Review Button - Show for all user roles except admin */}
                  {(userRole === "advertiser" || userRole === "creator") && (
                    <button
                      onClick={onReviewOpen}
                      className={cn(
                        "flex items-center justify-center gap-2 w-full rounded-xl py-2 text-center transition",
                        isDark
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                          : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white",
                      )}
                    >
                      {/* <Star className="h-4 w-4" /> */}
                      Leave a Review
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={supportChatEnabled ? onChatOpen : undefined}
                    disabled={!supportChatEnabled}
                    title={
                      supportChatEnabled
                        ? "Chat with support"
                        : "Support chat unavailable"
                    }
                    className={cn(
                      "rounded-full text-white w-10 h-10 flex items-center justify-center",
                      supportChatEnabled
                        ? isDark
                          ? "bg-purple-700 hover:bg-purple-600"
                          : "bg-[#7F39EC] hover:bg-purple-700"
                        : "bg-gray-400 cursor-not-allowed opacity-70",
                    )}
                  >
                    <MessageCircle size={18} />
                  </button>
                  {/* Show Book a Call only for advertisers */}
                  {userRole === "advertiser" && (
                    <div
                      className={cn(
                        "rounded-full w-10 h-10 flex items-center justify-center",
                        isDark ? "bg-purple-700" : "bg-[#7F39EC]",
                      )}
                    >
                      <a
                        href="https://calendly.com/guptavishesh2/30min"
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Book a Call with the Founder"
                      >
                        <Phone size={18} className="text-white" />
                      </a>
                    </div>
                  )}

                  {/* Review Button - Show for all user roles except admin */}
                  {(userRole === "advertiser" || userRole === "creator") && (
                    <button
                      onClick={onReviewOpen}
                      className={cn(
                        "rounded-full w-10 h-10 flex items-center justify-center",
                        isDark
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                          : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700",
                      )}
                    >
                      <Star size={18} className="text-white" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="h-4 shrink-0" />
      </div>

      <div
        ref={accountMenuRef}
        className={cn(
          "sticky bottom-0 z-30 shrink-0",
          isDark ? "bg-[#06021D]" : "bg-[#f6f6f7]",
          collapsed ? "px-2 pb-3" : "px-3 pb-3",
        )}
      >
        {accountMenuOpen && (
          <div
            className={cn(
              "absolute bottom-full z-40 mb-2 overflow-hidden rounded-xl border py-1 shadow-lg",
              collapsed ? "left-0 w-64" : "left-3 right-3",
              isDark
                ? "border-white/10 bg-[#12082a] text-white"
                : "border-[#e6e6e8] bg-white text-[#1a1a1a]",
            )}
          >
            <div className="px-3 py-2.5">
              <div className="truncate text-sm font-semibold">{userName}</div>
              {userEmail && (
                <div
                  className={cn(
                    "truncate text-xs",
                    isDark ? "text-white/55" : "text-[#8b8b93]",
                  )}
                >
                  {userEmail}
                </div>
              )}
            </div>
            <div
              className={cn(
                "mx-2 h-px",
                isDark ? "bg-white/10" : "bg-[#eeeef0]",
              )}
            />
            <Link
              href="/dashboard/profile"
              onClick={() => setAccountMenuOpen(false)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 text-sm",
                isDark ? "hover:bg-white/5" : "hover:bg-[#f6f6f7]",
              )}
            >
              <User className="h-4 w-4" strokeWidth={1.75} />
              Account
            </Link>
            <Link
              href="/dashboard/settings"
              onClick={() => setAccountMenuOpen(false)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 text-sm",
                isDark ? "hover:bg-white/5" : "hover:bg-[#f6f6f7]",
              )}
            >
              <Settings className="h-4 w-4" strokeWidth={1.75} />
              Settings
            </Link>
            {userRole !== "admin" && (
              <Link
                href={billingHref}
                onClick={() => setAccountMenuOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-sm",
                  isDark ? "hover:bg-white/5" : "hover:bg-[#f6f6f7]",
                )}
              >
                <CreditCard className="h-4 w-4" strokeWidth={1.75} />
                Plan and billing
              </Link>
            )}
            <Link
              href={helpHref}
              onClick={() => setAccountMenuOpen(false)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 text-sm",
                isDark ? "hover:bg-white/5" : "hover:bg-[#f6f6f7]",
              )}
            >
              <HelpCircle className="h-4 w-4" strokeWidth={1.75} />
              Help
            </Link>
            <div
              className={cn(
                "mx-2 my-1 h-px",
                isDark ? "bg-white/10" : "bg-[#eeeef0]",
              )}
            />
            <button
              type="button"
              onClick={() => {
                setAccountMenuOpen(false);
                onSignOut?.();
              }}
              disabled={isSigningOut}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm disabled:opacity-60",
                isDark ? "hover:bg-white/5" : "hover:bg-[#f6f6f7]",
              )}
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              {isSigningOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setAccountMenuOpen((open) => !open)}
          className={cn(
            "flex w-full items-center rounded-xl border text-left transition-colors",
            collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-3",
            isDark
              ? "border-white/10 bg-white/5 hover:bg-white/10"
              : "border-[#e6e6e8] bg-white shadow-sm hover:bg-[#fafafa]",
          )}
          aria-expanded={accountMenuOpen}
          aria-label="Account menu"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-11 w-11 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                isDark
                  ? "bg-white/15 text-white"
                  : "bg-[#ececef] text-[#3a3a40]",
              )}
            >
              {initials}
            </span>
          )}
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold leading-tight">
                  {userName}
                </span>
                {/* <span
                  className={cn(
                    "mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
                    isDark
                      ? "bg-violet-500/20 text-violet-200"
                      : "bg-violet-100 text-violet-800",
                  )}
                >
                  {roleLabel}
                </span> */}
                {userEmail && (
                  <span
                    className={cn(
                      "mt-1 block truncate text-sm",
                      isDark ? "text-white/55" : "text-[#8b8b93]",
                    )}
                  >
                    {userEmail}
                  </span>
                )}
              </span>
              <ChevronsUpDown
                className={cn(
                  "h-4 w-4 shrink-0",
                  isDark ? "text-white/50" : "text-[#8b8b93]",
                )}
              />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
