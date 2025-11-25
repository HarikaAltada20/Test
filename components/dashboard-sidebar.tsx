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
  Video,
  DollarSign,
  CreditCard,
  ChevronRight,
  BarChart3,
  FileText,
  Briefcase,
  Shield,
  User,
  Phone,
  HelpCircle,
  Award,
} from "lucide-react";
import Link from "next/link";

interface DashboardSidebarProps {
  userRole?: "advertiser" | "creator" | "admin";
  collapsed?: boolean;
  onChatOpen: () => void;
  mode?: "light" | "dark";
}

export function DashboardSidebar({
  userRole = "advertiser",
  onChatOpen,
  collapsed = false,
  mode,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const [showScrollbar, setShowScrollbar] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [showChat, setShowChat] = useState(false);
  const isDark = mode === "dark";

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

  const advertiserLinks = [
    {
      name: "Getting Started",
      href: "/dashboard/getting-started",
      icon: HelpCircle,
      description: "How it works",
    },
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      description: "Overview & analytics",
    },
    {
      name: "Contests",
      href: "/dashboard/contests",
      icon: Trophy,
      description: "Manage your contests",
    },
    {
      name: "Analytics",
      href: "/dashboard/analytics",
      icon: BarChart,
      description: "Performance insights",
    },
    {
      name: "Billing & Wallet",
      href: "/dashboard/billing",
      icon: CreditCard,
      description: "Balance, transactions & Subscriptions",
    },
    {
      name: "Settings",
      href: "/dashboard/settings",
      icon: Settings,
      description: "Account preferences",
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
      name: "All Contests",
      href: "/dashboard/admin/contests",
      icon: Trophy,
      description: "Manage all contests",
    },
    {
      name: "Contest Moderation",
      href: "/dashboard/admin/contest-moderation",
      icon: Shield,
      description: "Review & approve contests",
    },
    {
      name: "Leaderboard",
      href: "/dashboard/admin/leaderboard",
      icon: Award,
      description: "Top creators",
    },
    {
      name: "Withdrawal Requests",
      href: "/dashboard/admin/withdrawals",
      icon: DollarSign,
      description: "Manage payout withdrawals",
    },
    {
      name: "Affiliate",
      href: "/dashboard/admin/affiliate",
      icon: BarChart3,
      description: "Commissions & credits",
    },
    {
      name: "Support",
      href: "/dashboard/admin/support",
      icon: HelpCircle,
      description: "Queries & contacts",
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
      name: "Opportunities",
      href: "/dashboard/opportunities",
      icon: Trophy,
      description: "Available contests",
    },
    {
      name: "Leaderboard",
      href: "/dashboard/leaderboard",
      icon: Award,
      description: "Top creators",
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

  const links =
    userRole === "advertiser"
      ? advertiserLinks
      : userRole === "admin"
      ? adminLinks
      : creatorLinks;

  return (
    <div
      className="dashboard-sidebar flex h-full flex-col min-h-0 overflow-hidden max-h-screen"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Navigation Links - Full Height */}
      <div
        ref={scrollContainerRef}
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden transition-all duration-300 min-h-0",
          "scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100",
          isMobile || showScrollbar
            ? "sidebar-scrollbar"
            : "sidebar-scrollbar-hidden",
          "sm:hover:scrollbar-thumb-gray-400",
          "max-h-full"
        )}
      >
        {/* Removed Getting Started link for admin */}
        <div className="p-4">
          {!collapsed && (
            <h3
              className="px-3 py-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              Navigation
            </h3>
          )}
          <nav className={cn("space-y-2", collapsed && "space-y-3")}>
            {links.map((link) => {
              const isActive = pathname === link.href;
              const isDark = mode === "dark";
              const activeBg = isDark
                ? "rgba(127, 57, 236, 0.15)"
                : "#7F39EC14";
              const activeBorder = isDark
                ? "rgba(127, 57, 236, 0.45)"
                : "hsl(var(--primary) / 0.3)";
              const activeText = isDark ? "#ffffff" : "#4A00BE";
              const hoverShadow = "0 1px 2px 0 rgba(0, 0, 0, 0.05)";
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl transition-all duration-200",
                    "border border-transparent",
                    collapsed ? "justify-center px-2 py-3" : "px-3 py-3"
                  )}
                  style={{
                    backgroundColor: isActive ? activeBg : "transparent",
                    borderColor: isActive ? activeBorder : "transparent",
                    color: isActive ? activeText : "hsl(var(--foreground))",
                    // boxShadow: isActive
                    //   ? "0 4px 6px -1px hsl(var(--primary) / 0.25)"
                    //   : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = activeBorder;
                      e.currentTarget.style.backgroundColor = activeBg;
                      e.currentTarget.style.boxShadow = hoverShadow;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = "transparent";
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.boxShadow = "none";
                    }
                  }}
                  title={collapsed ? link.name : undefined}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-lg transition-colors",
                      collapsed ? "w-16 h-12" : "w-10 h-10"
                    )}
                    style={{
                      color: isActive
                        ? isDark
                          ? "#C9A7FF"
                          : "#4A00BE"
                        : "hsl(var(--primary))",
                    }}
                  >
                    <link.icon
                      className={cn(collapsed ? "h-6 w-6" : "h-5 w-5")}
                    />
                  </div>
                  {!collapsed && (
                    <>
                      <div className="flex-1 min-w-0">
                        <div
                          className="font-semibold text-sm"
                          style={{
                            color: isActive
                              ? isDark
                                ? "#ffffff"
                                : "#4A00BE"
                              : "hsl(var(--foreground))",
                          }}
                        >
                          {link.name}
                        </div>
                        <div
                          className="text-xs truncate transition-colors"
                          style={{
                            color: isActive
                              ? isDark
                                ? "rgba(255,255,255,0.8)"
                                : "#4A00BE"
                              : "hsl(var(--muted-foreground))",
                          }}
                        >
                          {link.description}
                        </div>
                      </div>
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 transition-all duration-200",
                          isActive && "translate-x-0.5"
                        )}
                        style={{
                          color: isActive
                            ? isDark
                              ? "#C9A7FF"
                              : "#4A00BE"
                            : "hsl(var(--muted-foreground))",
                        }}
                      />
                    </>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        <div>
          {/* Sidebar Content: hide chat widget for admin */}
          {userRole !== "admin" && (
            <div
              className={cn(
                "chat-card p-4 rounded-2xl mr-4 ml-4 shadow-lg",
                isDark
                  ? "border border-purple-500 bg-[rgba(127,57,236,0.10)] shadow-purple-900/30"
                  : "border border-purple-500 bg-purple-100 shadow-purple-200"
              )}
            >
              {!collapsed ? (
                <div className="flex flex-col gap-3">
                  <p
                    className={cn(
                      "text-md text-center font-medium",
                      isDark ? "text-white" : "text-purple-800"
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
                    onClick={onChatOpen}
                    className="w-full rounded-xl bg-purple-600 text-white py-2 transition hover:bg-purple-700"
                  >
                    Chat with Us
                  </button>

                  {/* Show Book a Call only for advertisers */}
                  {userRole === "advertiser" && (
                    <a
                      href="https://calendly.com/guptavishesh2/30min"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "block w-full rounded-xl text-white py-2 text-center transition",
                        isDark
                          ? "bg-purple-700 hover:bg-purple-600"
                          : "bg-black hover:bg-gray-800"
                      )}
                    >
                      Book a Call
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={onChatOpen}
                    className={cn(
                      "rounded-full text-white w-10 h-10 flex items-center justify-center",
                      isDark
                        ? "bg-purple-700 hover:bg-purple-600"
                        : "bg-[#7F39EC] hover:bg-purple-700"
                    )}
                  >
                    <MessageCircle size={18} />
                  </button>
                  {/* Show Book a Call only for advertisers */}
                  {userRole === "advertiser" && (
                    <div
                      className={cn(
                        "rounded-full w-10 h-10 flex items-center justify-center",
                        isDark ? "bg-purple-700" : "bg-[#7F39EC]"
                      )}
                    >
                      <a
                        href="https://calendly.com/guptavishesh2/30min"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Phone size={18} className="text-white" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
