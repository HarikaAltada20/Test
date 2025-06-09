"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Trophy,
  Users,
  BarChart,
  Settings,
  LogOut,
  Video,
  DollarSign,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import { useClientAuth } from "@/hooks/use-client-auth";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { UserResponse } from "@supabase/supabase-js";

interface DashboardSidebarProps {
  userRole?: "advertiser" | "creator" | "admin";
  collapsed?: boolean;
  user?: (UserResponse["data"]["user"] & { user_type?: string | null }) | null;
  profileFullName?: string | null;
  profilePictureUrl?: string | null;
}

export function DashboardSidebar({
  userRole = "advertiser",
  collapsed = false,
  user,
  profileFullName,
  profilePictureUrl,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { logout } = useClientAuth();

  const handleSignOut = async () => {
    try {
      await logout();
      console.log("Sign out successful");
    } catch (error) {
      console.error("Sign out error in sidebar:", error);
    }
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
      name: "Billing",
      href: "/dashboard/billing",
      icon: CreditCard,
      description: "Payments & invoices",
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
      name: "Earnings",
      href: "/dashboard/earnings",
      icon: DollarSign,
      description: "Revenue & payouts",
    },
    {
      name: "Settings",
      href: "/dashboard/settings",
      icon: Settings,
      description: "Account preferences",
    },
  ];

  const links = userRole === "advertiser" ? advertiserLinks : userRole === 'admin' ? adminLinks : creatorLinks;

  // Get role display name and color
  const getRoleInfo = (role: string) => {
    switch (role) {
      case "advertiser":
        return { label: "Advertiser", color: "bg-blue-500", textColor: "text-blue-100" };
      case "creator":
        return { label: "Creator", color: "bg-purple-500", textColor: "text-purple-100" };
      case "admin":
        return { label: "Admin", color: "bg-red-500", textColor: "text-red-100" };
      default:
        return { label: "User", color: "bg-gray-500", textColor: "text-gray-100" };
    }
  };

  const roleInfo = getRoleInfo(userRole);

  // Get user display info
  const displayName = profileFullName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User";
  const displayEmail = user?.email || "";
  const avatarSrc = profilePictureUrl || user?.user_metadata?.profile_picture_url || "";
  const avatarFallback = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex h-full flex-col">
      {/* User Profile Section */}
      {!collapsed && (
        <div className="p-4 border-b border-sidebar-border">
          <Link href="/dashboard/profile" className="block">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-pink-950/20 border border-rose-100 dark:border-rose-800/30 hover:from-rose-100 hover:to-pink-100 dark:hover:from-rose-950/30 dark:hover:to-pink-950/30 hover:border-rose-200 dark:hover:border-rose-700/50 transition-all duration-200 cursor-pointer">
              <Avatar className="h-12 w-12 ring-2 ring-rose-200 dark:ring-rose-800">
                <AvatarImage src={avatarSrc} alt={displayName} />
                <AvatarFallback className="bg-gradient-to-br from-rose-500 to-purple-500 text-white font-semibold">
                  {avatarFallback}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-sidebar-foreground truncate">{displayName}</p>
                <p className="text-xs text-sidebar-foreground/70 truncate">{displayEmail}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                    roleInfo.color, roleInfo.textColor)}>
                    {roleInfo.label}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Collapsed User Avatar */}
      {collapsed && (
        <div className="p-2 border-b border-sidebar-border">
          <Link href="/dashboard/profile" className="block">
            <Avatar className="h-8 w-8 mx-auto ring-2 ring-rose-200 dark:ring-rose-800 hover:ring-rose-300 dark:hover:ring-rose-700 transition-all duration-200 cursor-pointer">
              <AvatarImage src={avatarSrc} alt={displayName} />
              <AvatarFallback className="bg-gradient-to-br from-rose-500 to-purple-500 text-white font-semibold text-xs">
                {avatarFallback}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      )}

      {/* Navigation Links */}
      <div className="flex-1 p-2">
        {!collapsed && (
          <h3 className="px-2 py-2 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
            Navigation
          </h3>
        )}
        <nav className="space-y-1">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200",
                  "border border-transparent hover:border-sidebar-accent/20",
                  "hover:bg-sidebar-accent/60 hover:shadow-sm hover:translate-x-1",
                  isActive && "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/25",
                  collapsed ? "justify-center" : ""
                )}
                title={collapsed ? link.name : undefined}
              >
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-sidebar-accent/40 text-sidebar-foreground group-hover:bg-sidebar-accent/60"
                )}>
                  <link.icon className="h-4 w-4" />
                </div>
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        "font-medium text-sm",
                        isActive ? "text-white" : "text-sidebar-foreground"
                      )}>
                        {link.name}
                      </div>
                      <div className={cn(
                        "text-xs truncate transition-colors",
                        isActive
                          ? "text-white/80"
                          : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground/80"
                      )}>
                        {link.description}
                      </div>
                    </div>
                    <ChevronRight className={cn(
                      "h-3 w-3 transition-all duration-200",
                      isActive
                        ? "text-white/80 translate-x-0.5"
                        : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60 group-hover:translate-x-0.5"
                    )} />
                  </>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <Button
          className={cn(
            "group w-full justify-start gap-3 rounded-xl px-3 py-3 transition-all duration-200",
            "hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-200 dark:hover:border-red-800",
            "border border-transparent hover:shadow-sm",
            "text-sidebar-foreground hover:text-red-600 dark:hover:text-red-400",
            collapsed ? "justify-center px-2" : ""
          )}
          variant="ghost"
          onClick={() => {
            try {
              handleSignOut();
              console.log("Sign out initiated");
            } catch (error) {
              console.error("Sign out error in sidebar:", error);
            }
          }}
          title={collapsed ? "Sign out" : undefined}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 group-hover:bg-red-200 dark:group-hover:bg-red-950/60 transition-colors">
            <LogOut className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex-1 text-left">
              <div className="font-medium text-sm">Sign out</div>
              <div className="text-xs text-sidebar-foreground/60 group-hover:text-red-500/80 dark:group-hover:text-red-400/80">
                See you later!
              </div>
            </div>
          )}
        </Button>
      </div>
    </div>
  );
}
