"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { LayoutDashboard, Trophy, Users, BarChart, Settings, LogOut, Video, DollarSign } from "lucide-react"

interface DashboardSidebarProps {
  userRole?: "advertiser" | "creator"
}

export function DashboardSidebar({ userRole = "advertiser" }: DashboardSidebarProps) {
  const pathname = usePathname()
  const { signOut } = useAuth()

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
      name: "Creators",
      href: "/dashboard/creators",
      icon: Users,
    },
    {
      name: "Analytics",
      href: "/dashboard/analytics",
      icon: BarChart,
    },
    {
      name: "Settings",
      href: "/dashboard/settings",
      icon: Settings,
    },
  ]

  const creatorLinks = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "My Content",
      href: "/dashboard/content",
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
  ]

  const links = userRole === "advertiser" ? advertiserLinks : creatorLinks

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-1 py-4">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent",
              pathname === link.href ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
          >
            <link.icon className="h-4 w-4" />
            {link.name}
          </Link>
        ))}
      </div>
      <div className="mt-auto">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-accent"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  )
}

