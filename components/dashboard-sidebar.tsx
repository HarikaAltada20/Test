"use client";

import { usePathname } from "next/navigation";
import { useState, useRef } from "react";
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
} from "lucide-react";
import Link from "next/link";

interface DashboardSidebarProps {
  userRole?: "advertiser" | "creator" | "admin";
  collapsed?: boolean;
  onChatOpen: () => void;
}

export function DashboardSidebar({
  userRole = "advertiser",
  onChatOpen,
  collapsed = false,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const [showScrollbar, setShowScrollbar] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [showChat, setShowChat] = useState(false);
  // Handle mouse enter on sidebar - show scrollbar immediately
  const handleMouseEnter = () => {
    setShowScrollbar(true);
  };

  // Handle mouse leave from sidebar - hide scrollbar immediately
  const handleMouseLeave = () => {
    setShowScrollbar(false);
  };

  const advertiserLinks = [
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
  ];

  const creatorLinks = [
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
      className="flex h-full flex-col min-h-0 bg-white"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Navigation Links - Full Height */}
      <div
        ref={scrollContainerRef}
        className={cn(
          "flex-1 overflow-y-auto transition-all duration-300",
          showScrollbar ? "sidebar-scrollbar" : "sidebar-scrollbar-hidden"
        )}
      >
        <div className="px-4 pt-2">
          <Link
            href="/dashboard/getting-started"
            className={cn(
              "group relative flex items-center gap-3 rounded-xl transition-all duration-200",
              "border border-transparent text-black",
              collapsed ? "justify-center px-2 py-3" : "px-3 py-3"
            )}
            style={{
              backgroundColor:
                pathname === "/dashboard/getting-started"
                  ? "#7F39EC14"
                  : "transparent",
              borderColor:
                pathname === "/dashboard/getting-started"
                  ? "hsl(var(--primary) / 0.3)"
                  : "transparent",
              color:
                pathname === "/dashboard/getting-started"
                  ? "hsl(var(--primary-foreground))"
                  : "hsl(var(--foreground))",
              boxShadow:
                pathname === "/dashboard/getting-started"
                  ? "0 4px 6px -1px hsl(var(--primary) / 0.25)"
                  : "none",
            }}
            onMouseEnter={(e) => {
              if (pathname !== "/dashboard/getting-started") {
                e.currentTarget.style.borderColor = "hsl(var(--primary) / 0.3)";
                e.currentTarget.style.backgroundColor = "#7F39EC14";
                e.currentTarget.style.boxShadow =
                  "0 1px 2px 0 rgba(0, 0, 0, 0.05)";
              }
            }}
            onMouseLeave={(e) => {
              if (pathname !== "/dashboard/getting-started") {
                e.currentTarget.style.borderColor = "transparent";
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.boxShadow = "none";
              }
            }}
            title={collapsed ? "Getting Started" : undefined}
          >
            <div
              className={cn(
                "flex items-center justify-center rounded-lg transition-colors",
                collapsed ? "w-16 h-12" : "w-10 h-10"
              )}
              style={{
                backgroundColor:
                  pathname === "/dashboard/getting-started"
                    ? "hsl(var(--primary-foreground) / 0.2)"
                    : "hsl(var(--blue-500) / 0.2)",
                color:
                  pathname === "/dashboard/getting-started"
                    ? "#4A00BE"
                    : "hsl(var(--primary))",
              }}
            >
              <HelpCircle className={cn(collapsed ? "h-6 w-6" : "h-5 w-5")} />
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <div
                    className="font-semibold text-sm"
                    style={{
                      color:
                        pathname === "/dashboard/getting-started"
                          ? "#4A00BE"
                          : "hsl(var(--foreground))",
                    }}
                  >
                    Getting Started
                  </div>
                  <div
                    className="text-xs truncate transition-colors"
                    style={{
                      color:
                        pathname === "/dashboard/getting-started"
                          ? "#4A00BE"
                          : "hsl(var(--muted-foreground))",
                    }}
                  >
                    Learn about contests & campaigns
                  </div>
                </div>

                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-all duration-200",
                    pathname === "/dashboard/getting-started" &&
                      "translate-x-0.5"
                  )}
                  style={{
                    color:
                      pathname === "/dashboard/getting-started"
                        ? "#4A00BE"
                        : "hsl(var(--muted-foreground))",
                  }}
                />
              </>
            )}
          </Link>
        </div>
        <div className="px-4 pb-4 ">
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
                    backgroundColor: isActive ? "#7F39EC14" : "transparent",
                    borderColor: isActive
                      ? "hsl(var(--primary) / 0.3)"
                      : "transparent",
                    color: isActive ? "#4A00BE" : "hsl(var(--foreground))",
                    boxShadow: isActive
                      ? "0 4px 6px -1px hsl(var(--primary) / 0.25)"
                      : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor =
                        "hsl(var(--primary) / 0.3)";
                      e.currentTarget.style.backgroundColor = "#7F39EC14";
                      e.currentTarget.style.boxShadow =
                        "0 1px 2px 0 rgba(0, 0, 0, 0.05)";
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
                      // backgroundColor: isActive
                      //   ? "hsl(var(--primary-foreground) / 0.2)"
                      //   : "hsl(var(--primary) / 0.2)",
                      color: isActive ? "#4A00BE" : "hsl(var(--primary))",
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
                              ? "#4A00BE"
                              : "hsl(var(--foreground))",
                          }}
                        >
                          {link.name}
                        </div>
                        <div
                          className="text-xs truncate transition-colors"
                          style={{
                            color: isActive
                              ? "#4A00BE"
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
                            ? "#4A00BE"
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
          {/* Sidebar Content */}
          <div className="p-4 rounded-2xl border border-purple-500 mr-4 ml-4 bg-purple-100 shadow-lg shadow-purple-200">
            {!collapsed ? (
              <div className="flex flex-col gap-3">
                <p className="text-md text-purple-800 text-center font-medium">
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
                  <button className="w-full rounded-xl bg-black text-white py-2 hover:bg-gray-800 transition">
                    <a
                      href="https://calendly.com/guptavishesh2/30min"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Book a Call
                    </a>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={onChatOpen}
                  className="rounded-full bg-[#7F39EC] text-white w-10 h-10 flex items-center justify-center hover:bg-purple-700"
                >
                  <MessageCircle size={18} />
                </button>
                {/* Show Book a Call only for advertisers */}
                {userRole === "advertiser" && (
                  <div className="rounded-full bg-[#7F39EC] w-10 h-10 flex items-center justify-center">
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
        </div>
      </div>
    </div>
  );
}
