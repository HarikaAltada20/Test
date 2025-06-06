"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { Menu, User, Settings, LogOut, LayoutDashboard, UserCircle, Crown, Sparkles, Shield, ChevronDown, Zap, Star } from "lucide-react";
import { usePathname } from "next/navigation";
import logo from "@/public/images/gold_logo_horizontal.svg";
import Image from "next/image";
import type { UserResponse } from "@supabase/supabase-js";
import { useClientAuth } from "@/hooks/use-client-auth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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

  // Enhanced user info with fallbacks
  const displayName = profileFullName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User";
  const displayEmail = user?.email || "";
  const avatarSrc = profilePictureUrl || user?.user_metadata?.profile_picture_url || "";
  const avatarFallback = displayName.charAt(0).toUpperCase();

  // Hide nav on all /auth/* pages and /choose-username
  if (
    pathname.startsWith('/auth') ||
    pathname === "/choose-username"
  ) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Premium Background with Strategic Gradients */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(139,92,246,0.1),transparent)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(236,72,153,0.08),transparent)]"></div>

      {/* Premium Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px]"></div>

      {/* Refined Border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent"></div>

      <div className="relative">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-18 items-center justify-between">

            {/* Enhanced Logo Section */}
            <div className="flex items-center">
              <Link href="/" className="group flex items-center transition-all duration-300">
                <div className="relative">
                  {/* Subtle Glow Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 to-purple-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                  {/* Refined Logo Container */}
                  <div className="relative bg-gradient-to-br from-slate-900/60 to-slate-800/60 px-3 py-2 rounded-xl border border-violet-400/10 backdrop-blur-sm group-hover:border-violet-400/20 transition-all duration-300">
                    <Image
                      src={logo}
                      alt="Game Of Creators Logo"
                      width={110}
                      height={28}
                      className="relative z-10 transition-all duration-300"
                    />
                  </div>

                  {/* Minimal Accent */}
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-gradient-to-r from-violet-400 to-purple-500 rounded-full opacity-40 group-hover:opacity-80 transition-opacity duration-300"></div>
                </div>
              </Link>
            </div>

            {/* Center Navigation - Desktop */}
            <div className="hidden md:flex items-center space-x-2">
              <nav className="flex items-center space-x-1">
                <Link
                  href="/brands"
                  className={cn(
                    "group relative px-6 py-3 text-sm font-semibold transition-all duration-300 rounded-xl",
                    "text-slate-300 hover:text-white",
                    pathname === "/brands"
                      ? "text-white bg-gradient-to-r from-violet-600/20 to-purple-600/20 border border-violet-400/30 shadow-lg shadow-violet-500/20"
                      : "hover:bg-gradient-to-r hover:from-violet-600/10 hover:to-purple-600/10 hover:border-violet-400/20 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4" />
                    <span className="relative z-10">For Brands</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600/0 to-purple-600/0 group-hover:from-violet-600/5 group-hover:to-purple-600/5 rounded-xl transition-all duration-300"></div>
                </Link>

                <Link
                  href="/creators"
                  className={cn(
                    "group relative px-6 py-3 text-sm font-semibold transition-all duration-300 rounded-xl",
                    "text-slate-300 hover:text-white",
                    pathname === "/creators"
                      ? "text-white bg-gradient-to-r from-amber-600/20 to-orange-600/20 border border-amber-400/30 shadow-lg shadow-amber-500/20"
                      : "hover:bg-gradient-to-r hover:from-amber-600/10 hover:to-orange-600/10 hover:border-amber-400/20 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    <span className="relative z-10">For Creators</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-600/0 to-orange-600/0 group-hover:from-amber-600/5 group-hover:to-orange-600/5 rounded-xl transition-all duration-300"></div>
                </Link>
              </nav>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  {/* Enhanced User Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="group relative bg-slate-900/50 border border-violet-400/20 hover:border-violet-400/40 hover:bg-violet-600/10 backdrop-blur-sm transition-all duration-300 rounded-xl h-auto p-2"
                      >
                        <div className="flex items-center space-x-3">
                          {avatarSrc ? (
                            <div className="relative">
                              <Image
                                src={avatarSrc}
                                alt="Profile"
                                width={32}
                                height={32}
                                className="rounded-lg border border-violet-400/20"
                              />
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900"></div>
                            </div>
                          ) : (
                            <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white text-sm font-bold border border-violet-400/30">
                              {avatarFallback}
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900"></div>
                            </div>
                          )}
                          <div className="hidden sm:block text-left">
                            <div className="text-sm font-medium text-white">{displayName}</div>
                            <div className="text-xs text-slate-400 max-w-[120px] truncate">{displayEmail}</div>
                          </div>
                          <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-white transition-colors" />
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className="w-64 bg-slate-900/95 border border-violet-400/20 backdrop-blur-md shadow-2xl shadow-violet-500/20"
                      align="end"
                    >
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-2">
                          <div className="flex items-center space-x-2">
                            <Star className="h-4 w-4 text-slate-400" />
                            <p className="text-sm font-medium text-white">{displayName}</p>
                          </div>
                          <p className="text-xs text-slate-400">{displayEmail}</p>
                          <Badge className="bg-gradient-to-r from-slate-600 to-slate-700 text-white text-xs w-fit border border-slate-500/30">
                            Free Plan
                          </Badge>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-violet-400/20" />
                      <DropdownMenuItem
                        asChild
                        className="text-slate-300 hover:text-white hover:bg-violet-600/10 focus:bg-violet-600/10 focus:text-white cursor-pointer"
                      >
                        <Link href="/dashboard" className="flex items-center">
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        asChild
                        className="text-slate-300 hover:text-white hover:bg-violet-600/10 focus:bg-violet-600/10 focus:text-white cursor-pointer"
                      >
                        <Link href="/dashboard/settings" className="flex items-center">
                          <Settings className="mr-2 h-4 w-4" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-violet-400/20" />
                      <DropdownMenuItem
                        asChild
                        className="text-violet-300 hover:text-violet-200 hover:bg-violet-600/10 focus:bg-violet-600/10 focus:text-violet-200 cursor-pointer"
                      >
                        <Link href="/dashboard/upgrade" className="flex items-center">
                          <Crown className="mr-2 h-4 w-4" />
                          Upgrade Plan
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-violet-400/20" />
                      <DropdownMenuItem
                        asChild
                        className="text-red-300 hover:text-red-200 hover:bg-red-600/10 focus:bg-red-600/10 focus:text-red-200 cursor-pointer"
                      >
                        <Link href="/auth/signout" className="flex items-center">
                          <LogOut className="mr-2 h-4 w-4" />
                          Log out
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  {/* Enhanced Sign In Button */}
                  <Link href="/auth/signin" className="hidden sm:block">
                    <Button
                      variant="outline"
                      className="bg-slate-900/50 border-violet-400/20 text-slate-300 hover:text-white hover:bg-violet-600/10 hover:border-violet-400/40 backdrop-blur-sm transition-all duration-300"
                    >
                      Sign In
                    </Button>
                  </Link>

                  {/* Premium CTA Button */}
                  <Link href="/auth/signup">
                    <Button className="group relative bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 text-white font-semibold px-6 py-2 rounded-xl shadow-xl shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-300 hover:scale-105 border border-violet-400/20 overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
                      <Zap className="mr-2 h-4 w-4" />
                      <span className="relative z-10">Get Started</span>
                    </Button>
                  </Link>
                </>
              )}

              {/* Enhanced Mobile Menu */}
              <div className="md:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      className="bg-slate-900/50 border border-violet-400/20 hover:border-violet-400/40 hover:bg-violet-600/10 backdrop-blur-sm transition-all duration-300 p-2"
                    >
                      <Menu className="h-5 w-5 text-slate-300" />
                      <span className="sr-only">Toggle menu</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="right"
                    className="w-[320px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-l border-violet-400/20 backdrop-blur-md"
                  >
                    <SheetHeader className="mb-8 border-b border-violet-400/20 pb-6">
                      <SheetTitle className="text-xl font-bold text-white bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent text-left">
                        Game Menu
                      </SheetTitle>
                      <SheetDescription className="sr-only">
                        Main navigation menu for Game of Creators platform
                      </SheetDescription>
                    </SheetHeader>

                    {/* Mobile Logo */}
                    <Link href="/" className="flex items-center gap-3 mb-8 p-3 rounded-xl bg-gradient-to-r from-slate-900/50 to-slate-800/50 border border-violet-400/15">
                      <Image
                        src={logo}
                        alt="Game Of Creators Logo"
                        width={100}
                        height={24}
                      />
                    </Link>

                    {/* Mobile Navigation Links */}
                    <nav className="space-y-3 mb-8">
                      <Link
                        href="/brands"
                        className="group flex items-center gap-3 text-base font-semibold transition-all duration-300 text-slate-300 hover:text-white p-4 rounded-xl hover:bg-gradient-to-r hover:from-violet-600/10 hover:to-purple-600/10 border border-transparent hover:border-violet-400/20"
                      >
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-violet-600/20 to-purple-600/20 flex items-center justify-center group-hover:from-violet-600/30 group-hover:to-purple-600/30 transition-all duration-300">
                          <Crown className="h-5 w-5" />
                        </div>
                        For Brands
                      </Link>
                      <Link
                        href="/creators"
                        className="group flex items-center gap-3 text-base font-semibold transition-all duration-300 text-slate-300 hover:text-white p-4 rounded-xl hover:bg-gradient-to-r hover:from-amber-600/10 hover:to-orange-600/10 border border-transparent hover:border-amber-400/20"
                      >
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-600/20 to-orange-600/20 flex items-center justify-center group-hover:from-amber-600/30 group-hover:to-orange-600/30 transition-all duration-300">
                          <Sparkles className="h-5 w-5" />
                        </div>
                        For Creators
                      </Link>
                    </nav>

                    {/* Mobile User Section or Auth */}
                    {user ? (
                      <div className="space-y-3 border-t border-violet-400/20 pt-6">
                        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-slate-800/50 to-slate-700/50 rounded-xl border border-violet-400/20">
                          {avatarSrc ? (
                            <Image
                              src={avatarSrc}
                              alt="Profile"
                              width={40}
                              height={40}
                              className="rounded-xl border border-violet-400/20"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white font-bold">
                              {avatarFallback}
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-semibold text-white">{displayName}</div>
                            <div className="text-xs text-slate-400">{displayEmail}</div>
                          </div>
                        </div>
                        <Link
                          href="/dashboard"
                          className="flex items-center gap-3 text-slate-300 hover:text-white p-4 rounded-xl hover:bg-violet-600/10 transition-colors"
                        >
                          <LayoutDashboard className="h-5 w-5" />
                          Dashboard
                        </Link>
                        <Link
                          href="/dashboard/settings"
                          className="flex items-center gap-3 text-slate-300 hover:text-white p-4 rounded-xl hover:bg-violet-600/10 transition-colors"
                        >
                          <Settings className="h-5 w-5" />
                          Settings
                        </Link>
                        <Link
                          href="/auth/signout"
                          className="flex items-center gap-3 text-red-300 hover:text-red-200 p-4 rounded-xl hover:bg-red-600/10 transition-colors"
                        >
                          <LogOut className="h-5 w-5" />
                          Log out
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-4 border-t border-violet-400/20 pt-6">
                        <Link href="/auth/signin">
                          <Button variant="outline" className="w-full bg-slate-900/50 border-violet-400/20 text-slate-300 hover:text-white hover:bg-violet-600/10">
                            Sign In
                          </Button>
                        </Link>
                        <Link href="/auth/signup">
                          <Button className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold shadow-xl shadow-violet-500/25">
                            <Zap className="mr-2 h-4 w-4" />
                            Get Started
                          </Button>
                        </Link>
                      </div>
                    )}
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
