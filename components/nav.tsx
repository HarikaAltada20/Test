"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AvatarImage, AvatarFallback, Avatar } from "@/components/ui/avatar";
// import { ModeToggle } from "@/components/mode-toggle"
import { Logo } from "./logo";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import logo from "@/public/images/GoViral_transparent_logo.png";
import Image from "next/image";
import type { UserResponse } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

export function Nav({ user }: { user: UserResponse["data"]["user"] }) {

  const pathname = usePathname();
  const supabase = createClient();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  // Don't show nav on auth pages
  if (
    pathname === "/auth/signin" ||
    pathname === "/auth/signup" ||
    pathname === "/auth/forgot-password" ||
    pathname === "/auth/reset-password" ||
    pathname === "/verify-otp"
  ) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <div className="flex h-16 items-center">
        <div className="flex items-center">
          <Link href="/" className="flex items-center">
            <Image
              src={logo}
              alt="Game Of Creators Logo"
              width={80}
              height={80}
            />
          </Link>
        </div>

        {/* Center navigation - positioned absolutely for true centering */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <nav className="hidden md:flex gap-6">
            <Link
              href="/creators"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Creators
            </Link>
            <Link
              href="/brands"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Brands
            </Link>
          </nav>
        </div>

        <div className="ml-auto flex items-center">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={user.user_metadata.profile_picture_url || undefined}
                      alt={user.user_metadata.full_name || "User"}
                    />
                    <AvatarFallback>
                      {user.user_metadata.full_name?.[0]?.toUpperCase() ||
                        user.email?.[0]?.toUpperCase() ||
                        "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {user.user_metadata.full_name && (
                      <p className="font-medium">
                        {user.user_metadata.full_name}
                      </p>
                    )}
                    {user.email && (
                      <p className="w-[200px] truncate text-sm text-muted-foreground">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/dashboard/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/dashboard/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={handleSignOut}
                >
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" asChild>
              <Link href="/auth/signin">Log in</Link>
            </Button>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="ml-2 md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <SheetDescription className="sr-only">
                  Main navigation links for the site and user dashboard access.
                </SheetDescription>
              </SheetHeader>
              <Link href="/" className="flex items-center gap-2 mb-4">
                <Logo />
              </Link>
              <nav className="mt-8 flex flex-col gap-4">
                <Link
                  href="/creators"
                  className="text-sm font-medium transition-colors hover:text-primary"
                >
                  Creators
                </Link>
                <Link
                  href="/brands"
                  className="text-sm font-medium transition-colors hover:text-primary"
                >
                  Brands
                </Link>
                {!user && (
                  <Link
                    href="/auth/signin"
                    className="text-sm font-medium transition-colors hover:text-primary"
                  >
                    Log in
                  </Link>
                )}
                {user && (
                  <>
                    <Link
                      href="/dashboard"
                      className="text-sm font-medium transition-colors hover:text-primary"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/dashboard/content"
                      className="text-sm font-medium transition-colors hover:text-primary"
                    >
                      My Content
                    </Link>
                    <Link
                      href="/dashboard/opportunities"
                      className="text-sm font-medium transition-colors hover:text-primary"
                    >
                      Opportunities
                    </Link>
                    <Link
                      href="/dashboard/earnings"
                      className="text-sm font-medium transition-colors hover:text-primary"
                    >
                      Earnings
                    </Link>
                    <Link
                      href="/dashboard/profile"
                      className="text-sm font-medium transition-colors hover:text-primary"
                    >
                      Profile
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      className="text-sm font-medium transition-colors hover:text-primary"
                    >
                      Settings
                    </Link>
                    <Button
                      variant="ghost"
                      className="justify-start px-0 text-sm font-medium"
                      onClick={handleSignOut}
                    >
                      Log out
                    </Button>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
