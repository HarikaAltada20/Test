"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function MainNav() {
  const pathname = usePathname()

  return (
    <div className="flex items-center space-x-4 lg:space-x-6">
      {/* <Link
        href="/about"
        className={cn(
          "text-sm font-medium transition-colors hover:text-primary",
          pathname === "/about" ? "text-primary" : "text-muted-foreground",
        )}
      >
        About
      </Link> */}
      <Link
        href="/brands"
        className={cn(
          "text-sm font-medium transition-colors hover:text-primary",
          pathname === "/brands" ? "text-primary" : "text-muted-foreground",
        )}
      >
        For Brands
      </Link>
      <Link
        href="/creators"
        className={cn(
          "text-sm font-medium transition-colors hover:text-primary",
          pathname === "/creators" ? "text-primary" : "text-muted-foreground",
        )}
      >
        For Creators
      </Link>
    </div>
  )
}

