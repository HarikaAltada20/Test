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
} from "lucide-react";
import { SidebarNavigationLink } from "@/components/navigation/NavigationLink";
import { useClientAuth } from "@/hooks/use-client-auth";

interface DashboardSidebarProps {
  userRole?: "advertiser" | "creator";
}

export function DashboardSidebar({
  userRole = "advertiser",
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
    },
    {
      name: "Contests",
      href: "/dashboard/contests",
      icon: Trophy,
    },
    {
      name: "Analytics",
      href: "/dashboard/analytics",
      icon: BarChart,
    },
    {
      name: "Billing",
      href: "/dashboard/billing",
      icon: CreditCard,
    },
    {
      name: "Settings",
      href: "/dashboard/settings",
      icon: Settings,
    },
  ];

  const creatorLinks = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "My Submissions",
      href: "/dashboard/submissions",
      icon: Video,
    },
    {
      name: "Opportunities",
      href: "/dashboard/opportunities",
      icon: Trophy,
    },
    {
      name: "Earnings",
      href: "/dashboard/earnings",
      icon: DollarSign,
    },
    {
      name: "Settings",
      href: "/dashboard/settings",
      icon: Settings,
    },
  ];

  const links = userRole === "advertiser" ? advertiserLinks : creatorLinks;

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-1 py-4">
        {links.map((link) => (
          <SidebarNavigationLink
            key={link.href}
            href={link.href}
            icon={link.icon}
          >
            {link.name}
          </SidebarNavigationLink>
        ))}
      </div>
      <div className="mt-auto">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-accent"
          onClick={() => {
            try {
              handleSignOut();
              console.log("Sign out initiated");
            } catch (error) {
              console.error("Sign out error in sidebar:", error);
            }
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
