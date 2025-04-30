"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger
} from "@/components/ui/sheet"
import { useAuth } from "@/contexts/auth-context"

export function MobileNav() {
  const [open, setOpen] = React.useState(false)
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  const handleLinkClick = () => {
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" className="md:hidden" size="icon">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="md:hidden">
        <SheetHeader>
          <SheetTitle className="sr-only">Mobile Navigation Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Links to navigate the site. Only visible on small screens.
          </SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col gap-4 mt-8">
          <Link href="/" onClick={handleLinkClick} className={pathname === "/" ? "font-bold" : ""}>
            Home
          </Link>
          <Link href="/about" onClick={handleLinkClick} className={pathname === "/about" ? "font-bold" : ""}>
            About
          </Link>
          <Link href="/brands" onClick={handleLinkClick} className={pathname === "/brands" ? "font-bold" : ""}>
            For Brands
          </Link>
          <Link href="/creators" onClick={handleLinkClick} className={pathname === "/creators" ? "font-bold" : ""}>
            For Creators
          </Link>

          {user ? (
            <>
              <Link
                href="/dashboard"
                onClick={handleLinkClick}
                className={pathname.startsWith("/dashboard") ? "font-bold" : ""}
              >
                Dashboard
              </Link>
              <Button
                variant="ghost"
                onClick={() => {
                  signOut()
                  handleLinkClick()
                }}
              >
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link href="/auth/signin" onClick={handleLinkClick}>
                <Button className="w-full">
                  Login
                </Button>
              </Link>

            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

