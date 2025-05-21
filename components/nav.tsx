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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu, Moon } from "lucide-react";
import { usePathname } from "next/navigation";
import logo from "@/public/images/gold_logo_horizontal.svg";
import Image from "next/image";
import type { UserResponse } from "@supabase/supabase-js";
import { useClientAuth } from "@/hooks/use-client-auth";

interface NavProps {
  user: UserResponse["data"]["user"];
  profileFullName?: string | null;
  profilePictureUrl?: string | null;
}

export function Nav({ user, profileFullName, profilePictureUrl }: NavProps) {

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
  // Don't show nav on auth pages
  if (
    pathname === "/auth/signin" ||
    pathname === "/auth/signup" ||
    pathname === "/auth/forgot-password" ||
    pathname === "/auth/reset-password" ||
    pathname === "/verify-otp" ||
    pathname === "/choose-username"
  ) {
    return null;
  }

  return (
    <header className="py-3 bg-[#0B0F11]">
      <div className="bg-[#333A4A] text-slate-100 p-3 rounded-full shadow-lg flex h-16 items-center relative max-w-[720px] mx-auto px-4 sm:px-6">
        {/* Logo */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center">
            <Image
              src={logo}
              alt="Game Of Creators Logo"
              width={120}
              height={40}
            />
            {/* <span className="ml-2.5 text-lg font-semibold text-slate-200 hidden sm:inline">
              GAME OF CREATORS
            </span> */}
          </Link>
        </div>

        {/* Center navigation */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
          <nav className="flex items-center gap-6">
            <Link
              href="/brands"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              For Brands
            </Link>
            <Link
              href="/creators"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              For Creators
            </Link>
          </nav>
        </div>

        {/* Right side actions */}
        <div className="ml-auto flex items-center space-x-2 sm:space-x-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-300 hover:text-slate-100 hover:bg-slate-700 rounded-full p-2 hidden sm:flex"
            aria-label="Toggle theme (placeholder)"
          >
            <Moon className="h-5 w-5" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                  <Avatar className="h-9 w-9 border-2 border-slate-600 hover:border-slate-400">
                    <AvatarImage
                      src={profilePictureUrl || user?.user_metadata?.profile_picture_url || undefined}
                      alt={profileFullName || user?.user_metadata?.full_name || "User"}
                    />
                    <AvatarFallback className="bg-slate-700 text-slate-300">
                      {(profileFullName?.[0] || user?.user_metadata?.full_name?.[0] || user?.email?.[0] || "U").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              {/* Consider styling DropdownMenuContent for dark theme if not inheriting properly */}
              <DropdownMenuContent className="w-56 bg-slate-800 border-slate-700 text-slate-200" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {(profileFullName || user?.user_metadata?.full_name) && (
                      <p className="font-medium text-slate-100">
                        {profileFullName || user?.user_metadata?.full_name}
                      </p>
                    )}
                    {user?.email && (
                      <p className="w-[200px] truncate text-sm text-slate-400">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem asChild className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700">
                  <Link href="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700">
                  <Link href="/dashboard/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700">
                  <Link href="/dashboard/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem
                  className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700"
                  onClick={handleSignOut}
                >
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 sm:px-5 rounded-md text-sm">
              <Link href="/auth/signin">Sign In</Link>
            </Button>
          )}

          {/* Mobile Menu Trigger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden text-slate-300 hover:text-slate-100 hover:bg-slate-700 p-2"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-slate-800 text-slate-100 border-l-slate-700 w-[280px] sm:w-[320px]">
              <SheetHeader className="mb-6 border-b border-slate-700 pb-4">
                <SheetTitle className="text-lg font-semibold text-slate-100 text-left">Menu</SheetTitle>
                <SheetDescription className="sr-only">
                  Main navigation links for the site and user dashboard access.
                </SheetDescription>
              </SheetHeader>

              <Link href="/" className="flex items-center gap-2 mb-6">
                <Image
                  src={logo}
                  alt="Game Of Creators Logo"
                  width={120}
                  height={28}
                />
                {/* <span className="font-semibold text-slate-200">GAME OF CREATORS</span> */}
              </Link>

              <nav className="flex flex-col gap-3">
                <Link
                  href="/brands"
                  className="text-base font-medium text-slate-300 hover:text-white transition-colors p-2 rounded-md hover:bg-slate-700"
                >
                  For Brands
                </Link>
                <Link
                  href="/creators"
                  className="text-base font-medium text-slate-300 hover:text-white transition-colors p-2 rounded-md hover:bg-slate-700"
                >
                  For Creators
                </Link>

                <Button
                  variant="ghost"
                  className="text-slate-300 hover:text-white hover:bg-slate-700 justify-start sm:hidden flex items-center gap-2 mt-3 p-2 rounded-md text-base font-medium"
                  aria-label="Toggle theme (placeholder)"
                >
                  <Moon className="h-5 w-5" />
                  <span>Toggle Theme</span>
                </Button>

                <hr className="border-slate-700 my-3" />

                {!user && (
                  <Link
                    href="/auth/signin"
                    className="text-base font-medium text-blue-400 hover:text-blue-300 transition-colors p-2 rounded-md hover:bg-slate-700"
                  >
                    Sign In
                  </Link>
                )}
                {user && (
                  <>
                    <Link href="/dashboard" className="text-base font-medium text-slate-300 hover:text-white transition-colors p-2 rounded-md hover:bg-slate-700">Dashboard</Link>
                    <Link href="/dashboard/profile" className="text-base font-medium text-slate-300 hover:text-white transition-colors p-2 rounded-md hover:bg-slate-700">Profile</Link>
                    <Link href="/dashboard/settings" className="text-base font-medium text-slate-300 hover:text-white transition-colors p-2 rounded-md hover:bg-slate-700">Settings</Link>
                    {/* Add other user-specific links here if needed, with similar styling */}
                    <Button
                      variant="ghost"
                      className="justify-start text-base font-medium text-slate-300 hover:text-white mt-2 p-2 rounded-md hover:bg-slate-700 w-full"
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
