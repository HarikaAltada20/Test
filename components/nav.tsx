"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ButtonLoadingSpinner } from "@/components/loading/LoadingSpinner";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Menu,
  User,
  Trophy,
  Settings,
  LogOut,
  LayoutDashboard,
  UserCircle,
  Crown,
  Sparkles,
  Shield,
  ChevronDown,
  Zap,
  Star,
  Home,
} from "lucide-react";
import logoDark from "@/public/images/Primary_Logo_white.png";
import logoLight from "@/public/images/Primary Logo white 1 (2).png";
import Image from "next/image";
import type { UserResponse } from "@supabase/supabase-js";
import { useClientAuth } from "@/hooks/use-client-auth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { subscriptionPlans, PRODUCT_IDS } from "@/constants/subscriptionPlans";
import { MARKETING_HOME_AS_GUEST } from "@/constants/marketingHome";
import { MarketingThemeToggle } from "@/components/marketing-theme-toggle";
import { useThemeMode } from "@/hooks/use-theme-mode";

interface NavProps {
  user: UserResponse["data"]["user"];
  profileFullName?: string | null;
  profilePictureUrl?: string | null;
  userType?: "advertiser" | "creator" | "admin" | null;
  subscriptionPlan?: string | null;
}

export function Nav({
  user,
  profileFullName,
  profilePictureUrl,
  userType,
  subscriptionPlan,
}: NavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useClientAuth();
  const { isLight } = useThemeMode();
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [creatorsLoading, setCreatorsLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [quickLinkLoading, setQuickLinkLoading] = useState(false);
  const [homeLoading, setHomeLoading] = useState(false);

  // Warm auth routes so Sign In / Get Started do not wait on first compile/RSC fetch.
  useEffect(() => {
    if (user) return;
    router.prefetch("/auth/signin");
    router.prefetch("/auth/signup");
  }, [router, user]);

  const handleSignOut = async () => {
    try {
      await logout();
      console.log("Sign out successful");
    } catch (error) {
      console.error("Sign out error in sidebar:", error);
    }
  };

  // Function to get plan name from plan ID
  const getPlanName = (planId: string | null | undefined): string => {
    if (!planId) return "Explorer Plan";

    const plan = subscriptionPlans.find((p) => p.id === planId);
    return plan ? plan.displayName || plan.name : "Explorer Plan";
  };

  // Enhanced user info with fallbacks
  const displayName =
    profileFullName ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";
  const displayEmail = user?.email || "";
  const avatarSrc =
    profilePictureUrl || user?.user_metadata?.profile_picture_url || "";
  const avatarFallback = displayName.charAt(0).toUpperCase();
  const quickLinkHref =
    userType === "advertiser"
      ? "/dashboard/contests"
      : userType === "creator"
        ? "/dashboard/opportunities"
        : "/dashboard/profile";
  const quickLinkLabel =
    userType === "advertiser"
      ? "Campaigns"
      : userType === "creator"
        ? "Campaigns"
        : "Profile";
  const marketingHomeHref = user ? MARKETING_HOME_AS_GUEST : "/";
  const QuickLinkIcon =
    userType === "advertiser"
      ? Trophy
      : userType === "creator"
        ? Trophy
        : User;
  const [open, setOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleNavigation = () => {
    setIsNavigating(true);
  };

  const handleDarkMarketingSignUp = () => {
    if (pathname === "/brands") {
      try {
        localStorage.setItem("signupRole", "advertiser");
      } catch {
        // ignore storage errors
      }
    }
    handleNavigation();
  };

  const handleSignInNavigation = () => {
    setIsSigningIn(true);
  };

  useEffect(() => {
    setOpen(false);
    setIsNavigating(false);
    setIsSigningIn(false);
    setBrandsLoading(false);
    setCreatorsLoading(false);
    setDashboardLoading(false);
    setSettingsLoading(false);
    setQuickLinkLoading(false);
    setHomeLoading(false);
  }, [pathname]);
  // Hide nav on all /auth/* pages, /choose-username, and /dashboard/* pages
  if (
    pathname.startsWith("/auth") ||
    pathname === "/choose-username" ||
    pathname.startsWith("/dashboard")
  ) {
    return null;
  }

  const isCreatorsPage = pathname === "/creators";
  const isBrandsPage = pathname === "/brands";
  const isHomePage = pathname === "/";
  const isDarkMarketingNav = isCreatorsPage || isBrandsPage || isHomePage;
  const isLightMarketingNav = isDarkMarketingNav && isLight;
  const marketingLogo = isLightMarketingNav ? logoLight : logoDark;

  const creatorsNavLinks = [
    { label: "Home", href: marketingHomeHref },
    { label: "How it works", href: "/creators#how-it-works" },
    { label: "Why GOC", href: "/creators#why-goc" },
    { label: "FAQ", href: "/creators#faq" },
    { label: "For Brands", href: "/brands" },
    { label: "Contact", href: "/contact" },
  ] as const;

  const brandsNavLinks = [
    { label: "Home", href: marketingHomeHref },
    { label: "How it works", href: "/brands#how-it-works" },
    { label: "For Creators", href: "/creators" },
    { label: "Contact", href: "/contact" },
  ] as const;

  const homeNavLinks = [
    { label: "For Brands", href: "/brands" },
    { label: "For Creators", href: "/creators" },
    { label: "Contact", href: "/contact" },
  ] as const;

  const marketingPageLinks = isCreatorsPage
    ? creatorsNavLinks
    : isBrandsPage
      ? brandsNavLinks
      : null;

  const goToMarketingPage = (href: "/brands" | "/creators") => {
    if (href === "/brands") setBrandsLoading(true);
    if (href === "/creators") setCreatorsLoading(true);
    // Client navigation keeps the selected theme (full reloads were resetting it).
    router.push(href);
  };

  const scrollToHashSection = (href: string) => {
    if (!href.includes("#")) {
      router.push(href);
      return;
    }
    const id = href.split("#")[1];
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setOpen(false);
      return;
    }
    router.push(href);
  };

  const handleMarketingLinkClick = (link: {
    label: string;
    href: string;
  }) => {
    if (link.label === "For Brands") {
      goToMarketingPage("/brands");
      return;
    }
    if (link.label === "For Creators") {
      goToMarketingPage("/creators");
      return;
    }
    if (link.href.includes("#")) {
      scrollToHashSection(link.href);
      return;
    }
    router.push(link.href);
  };

  return (
    <header className="sticky top-0 z-50 w-full">
      {isDarkMarketingNav ? (
        <div
          className={cn(
            "absolute inset-0 backdrop-blur-md transition-colors duration-300",
            isLightMarketingNav
              ? "bg-[#F1F1F1]"
              : "bg-black",
          )}
        />
      ) : (
        <>
          {/* Premium Background with Strategic Gradients */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(139,92,246,0.1),transparent)]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(236,72,153,0.08),transparent)]"></div>

          {/* Premium Grid Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px]"></div>

          {/* Refined Border */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent"></div>
        </>
      )}

      <div className="relative">
        <div
          className={cn(
            "mx-auto px-4 sm:px-6 lg:px-8",
            isDarkMarketingNav ? "max-w-[1180px]" : "container"
          )}
        >
          <div
            className={cn(
              "flex h-20 items-center justify-between",
              !isDarkMarketingNav && "md:justify-around"
            )}
          >
            {/* Enhanced Logo Section */}
            <div className="flex items-center shrink-0">
              <Link
                href={marketingHomeHref}
                className="group flex items-center transition-all duration-300"
              >
                <div className="relative">
                  {!isDarkMarketingNav && (
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 to-purple-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  )}

                  <div className="relative ">
                    <Image
                      src={isDarkMarketingNav ? marketingLogo : logoDark}
                      alt="Game Of Creators Logo"
                      width={200}
                      height={48}
                      className="relative z-10 h-14 w-auto transition-all duration-300"
                      priority
                    />
                  </div>

                  {!isDarkMarketingNav && (
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-gradient-to-r from-violet-400 to-purple-500 rounded-full opacity-40 group-hover:opacity-80 transition-opacity duration-300"></div>
                  )}
                </div>
              </Link>
            </div>

            {/* Center Navigation - Desktop */}
            <div className="hidden md:flex items-center space-x-2 flex-1 justify-center">
              {marketingPageLinks ? (
                <nav className="flex items-center gap-1 lg:gap-2">
                  {marketingPageLinks.map((link) => {
                    const isLinkLoading =
                      (link.label === "For Brands" && brandsLoading) ||
                      (link.label === "For Creators" && creatorsLoading);
                    return (
                      <button
                        key={link.label}
                        type="button"
                        onClick={() => handleMarketingLinkClick(link)}
                        disabled={isLinkLoading}
                        className={cn(
                          "inline-flex items-center gap-2 px-3 lg:px-4 py-2 text-sm lg:text-[15px] font-medium transition-colors duration-200 whitespace-nowrap",
                          isLightMarketingNav
                            ? "text-black/55 hover:text-black"
                            : "text-zinc-400 hover:text-white",
                          isLinkLoading && "opacity-70 cursor-not-allowed"
                        )}
                      >
                        {isLinkLoading ? <ButtonLoadingSpinner /> : null}
                        <span>{link.label}</span>
                      </button>
                    );
                  })}
                </nav>
              ) : isHomePage ? (
                <nav
                  className={cn(
                    "flex items-center gap-6 lg:gap-8 text-[15px] lg:text-[16px]",
                    isLightMarketingNav ? "text-black/50" : "text-white/50",
                  )}
                >
                  {homeNavLinks.map((link) => {
                    const isLinkLoading =
                      (link.label === "For Brands" && brandsLoading) ||
                      (link.label === "For Creators" && creatorsLoading);
                    return (
                      <button
                        key={link.label}
                        type="button"
                        onClick={() => handleMarketingLinkClick(link)}
                        disabled={isLinkLoading}
                        className={cn(
                          "inline-flex items-center gap-2 transition-colors whitespace-nowrap",
                          isLightMarketingNav
                            ? "hover:text-black"
                            : "hover:text-white",
                          isLinkLoading && "opacity-70 cursor-not-allowed"
                        )}
                      >
                        {isLinkLoading ? <ButtonLoadingSpinner /> : null}
                        <span>{link.label}</span>
                      </button>
                    );
                  })}
                </nav>
              ) : (
                <nav className="flex items-center md:ml-20 space-x-1">
                  <button
                    onClick={() => goToMarketingPage("/brands")}
                    disabled={brandsLoading}
                    className={cn(
                      "group relative px-6 py-3 text-lg font-semibold transition-all duration-300 rounded-xl flex items-center gap-2",
                      pathname === "/brands"
                        ? "text-purple-400"
                        : "text-slate-300 hover:text-purple-400",
                      brandsLoading && "opacity-70 cursor-not-allowed"
                    )}
                  >
                    {brandsLoading ? (
                      <ButtonLoadingSpinner />
                    ) : (
                      <Crown className="h-4 w-4 text-purple-400 shrink-0" />
                    )}
                    <span>For Brands</span>
                  </button>

                  <button
                    onClick={() => goToMarketingPage("/creators")}
                    disabled={creatorsLoading}
                    className={cn(
                      "group relative px-6 py-3 text-lg font-semibold transition-all duration-300 rounded-xl flex items-center gap-2",
                      pathname === "/creators"
                        ? "text-orange-400"
                        : "text-slate-300 hover:text-orange-400",
                      creatorsLoading && "opacity-70 cursor-not-allowed"
                    )}
                  >
                    {creatorsLoading ? (
                      <ButtonLoadingSpinner />
                    ) : (
                      <Sparkles className="h-4 w-4 text-orange-400 shrink-0" />
                    )}
                    <span>For Creators</span>
                  </button>
                </nav>
              )}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-3 sm:space-x-5">
              {isDarkMarketingNav ? (
                <MarketingThemeToggle
                  className="hidden sm:inline-flex"
                  lightChrome={isLightMarketingNav}
                />
              ) : null}
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
                            <div className="text-sm font-medium text-white">
                              {displayName}
                            </div>
                            <div className="text-xs text-slate-400 max-w-[120px] truncate">
                              {displayEmail}
                            </div>
                          </div>
                          <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-white transition-colors" />
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className="w-64 bg-slate-900/95 border border-violet-400/20 backdrop-blur-md shadow-2xl shadow-violet-500/20"
                      align="end"
                    >
                      <DropdownMenuLabel className="font-normal p-0">
                        <Link
                          href="/dashboard/profile"
                          className="flex flex-col space-y-2 p-3 hover:bg-violet-600/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <div className="flex items-center space-x-2">
                            <Star className="h-4 w-4 text-slate-400" />
                            <p className="text-sm font-medium text-white">
                              {displayName}
                            </p>
                          </div>
                          <p className="text-xs text-slate-400">
                            {displayEmail}
                          </p>
                          {userType === "advertiser" && (
                            <Badge className="bg-gradient-to-r from-slate-600 to-slate-700 text-white text-xs w-fit border border-slate-500/30">
                              {getPlanName(subscriptionPlan)}
                            </Badge>
                          )}
                        </Link>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-violet-400/20" />
                      <DropdownMenuItem
                        asChild
                        className="text-slate-300 hover:text-white hover:bg-violet-600/10 focus:bg-violet-600/10 focus:text-white cursor-pointer"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setQuickLinkLoading(true);
                            window.location.href = quickLinkHref;
                          }}
                          disabled={quickLinkLoading}
                          className="flex w-full items-center"
                        >
                          {quickLinkLoading ? (
                            <ButtonLoadingSpinner />
                          ) : (
                            <QuickLinkIcon className="mr-2 h-4 w-4" />
                          )}
                          {quickLinkLabel}
                        </button>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        asChild
                        className="text-slate-300 hover:text-white hover:bg-violet-600/10 focus:bg-violet-600/10 focus:text-white cursor-pointer"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDashboardLoading(true);
                            window.location.href = "/dashboard";
                          }}
                          disabled={dashboardLoading}
                          className="flex w-full items-center"
                        >
                          {dashboardLoading ? (
                            <ButtonLoadingSpinner />
                          ) : (
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                          )}
                          Dashboard
                        </button>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        asChild
                        className="text-slate-300 hover:text-white hover:bg-violet-600/10 focus:bg-violet-600/10 focus:text-white cursor-pointer"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setHomeLoading(true);
                            window.location.href = MARKETING_HOME_AS_GUEST;
                          }}
                          disabled={homeLoading}
                          className="flex w-full items-center"
                        >
                          {homeLoading ? (
                            <ButtonLoadingSpinner />
                          ) : (
                            <Home className="mr-2 h-4 w-4" />
                          )}
                          Home
                        </button>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        asChild
                        className="text-slate-300 hover:text-white hover:bg-violet-600/10 focus:bg-violet-600/10 focus:text-white cursor-pointer"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSettingsLoading(true);
                            window.location.href = "/dashboard/settings";
                          }}
                          disabled={settingsLoading}
                          className="flex w-full items-center"
                        >
                          {settingsLoading ? (
                            <ButtonLoadingSpinner />
                          ) : (
                            <Settings className="mr-2 h-4 w-4" />
                          )}
                          Settings
                        </button>
                      </DropdownMenuItem>
                      {userType === "advertiser" &&
                        subscriptionPlan !== PRODUCT_IDS.CHAMPION && (
                          <>
                            <DropdownMenuSeparator className="bg-violet-400/20" />
                            <DropdownMenuItem
                              asChild
                              className="text-violet-300 hover:text-violet-200 hover:bg-violet-600/10 focus:bg-violet-600/10 focus:text-violet-200 cursor-pointer"
                            >
                              <Link
                                href="/dashboard/billing?tab=subscription"
                                className="flex items-center"
                              >
                                <Crown className="mr-2 h-4 w-4" />
                                Upgrade Plan
                              </Link>
                            </DropdownMenuItem>
                          </>
                        )}
                      <DropdownMenuSeparator className="bg-violet-400/20" />
                      <DropdownMenuItem
                        className="text-red-300 hover:text-red-200 hover:bg-red-600/10 focus:bg-red-600/10 focus:text-red-200 cursor-pointer"
                        onClick={handleSignOut}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Log out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : isDarkMarketingNav ? (
                <Link href="/auth/signup" onClick={handleDarkMarketingSignUp}>
                  <Button
                    disabled={isNavigating || isSigningIn}
                    className={cn(
                      "hidden md:inline-flex items-center gap-1.5 px-5 py-2 text-[12px] font-medium rounded-xl transition-all duration-300 min-h-[40px]",
                      isLightMarketingNav
                        ? "bg-gradient-to-b from-[#8A68FF] to-[#754FF6] border border-[#7c3aed] text-white hover:bg-[#6d28d9] hover:border-[#6d28d9]"
                        : "bg-[linear-gradient(0deg,#000000_0%,#353535_138.24%)] border border-white/25 text-white hover:bg-white/10 hover:border-white/40",
                      (isNavigating || isSigningIn) &&
                        "opacity-70 cursor-not-allowed"
                    )}
                  >
                    {isNavigating ? <ButtonLoadingSpinner /> : null}
                    <span>Sign up →</span>
                  </Button>
                </Link>
              ) : (
                <>
                  {/* Enhanced Sign In Button */}
                  <Link
                    href="/auth/signin"
                    className="hidden sm:block"
                    onClick={handleSignInNavigation}
                  >
                    <Button
                      variant="outline"
                      aria-label="Sign in"
                      disabled={isSigningIn || isNavigating}
                      className={cn(
                        "hidden md:flex items-center gap-2 px-6 py-2.5 text-md rounded-full backdrop-blur-sm transition-all duration-300 min-h-[44px]",
                        "bg-slate-900/50 border border-[#BC83FA] text-[#BC83FA] hover:bg-[#BC83FA] hover:text-white",
                        (isSigningIn || isNavigating) &&
                          "opacity-70 cursor-not-allowed"
                      )}
                    >
                      {isSigningIn ? <ButtonLoadingSpinner /> : null}
                      <span>Sign In</span>
                    </Button>
                  </Link>

                  <Link href="/auth/signup" onClick={handleNavigation}>
                    <Button
                      disabled={isNavigating || isSigningIn}
                      className={cn(
                        "hidden md:flex items-center gap-2 px-6 py-2.5 text-md rounded-full transition-all duration-300 relative overflow-hidden min-h-[44px]",
                        "bg-[linear-gradient(90deg,#4C238D_0%,#7F39EC_50%,#4C238D_100%)] text-white hover:opacity-90",
                        (isNavigating || isSigningIn) &&
                          "opacity-70 cursor-not-allowed"
                      )}
                    >
                      <div className="scan-line"></div>
                      {isNavigating ? <ButtonLoadingSpinner /> : null}
                      <span className="relative z-10">Get Started</span>
                    </Button>
                  </Link>
                </>
              )}

              {/* Enhanced Mobile Menu */}
              <div className="md:hidden">
                <Sheet open={open} onOpenChange={setOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "backdrop-blur-sm transition-all duration-300 p-2",
                        isDarkMarketingNav
                          ? isLightMarketingNav
                            ? "bg-black/[0.04] border border-black/10 hover:bg-black/[0.07] hover:border-black/15"
                            : "bg-white/5 border border-white/15 hover:bg-white/10 hover:border-white/25"
                          : "bg-slate-900/50 border border-violet-400/20 hover:border-violet-400/40 hover:bg-violet-600/10"
                      )}
                    >
                      <Menu
                        className={cn(
                          "h-5 w-5",
                          isLightMarketingNav ? "text-black/70" : "text-slate-300",
                        )}
                      />
                      <span className="sr-only">Toggle menu</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="right"
                    className={cn(
                      "w-[320px] border-l backdrop-blur-md flex flex-col h-full",
                      isDarkMarketingNav
                        ? isLightMarketingNav
                          ? "bg-[#F1F1F1]"
                          : "bg-black"
                        : "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-violet-400/20"
                    )}
                  >
                    <SheetHeader
                      className={cn(
                        "pb-6 flex-shrink-0",
                        isDarkMarketingNav
                          ? isLightMarketingNav
                            ? "border-b border-black/10"
                            : "border-b border-white/10"
                          : "border-b border-violet-400/20"
                      )}
                    >
                      <SheetTitle
                        className={cn(
                          "text-xl font-bold text-left",
                          isDarkMarketingNav
                            ? isLightMarketingNav
                              ? "text-black"
                              : "text-white"
                            : "text-xl font-bold text-white bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent"
                        )}
                      >
                        {isDarkMarketingNav ? "Menu" : "Game Menu"}
                      </SheetTitle>
                      <SheetDescription className="sr-only">
                        Main navigation menu for Game of Creators platform
                      </SheetDescription>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto overflow-x-hidden mt-6 pr-2 -mr-2 nav-dark-scrollbar min-h-0">
                      <div className="px-4 pb-6">
                        {/* Mobile Logo */}
                        <Link
                          href={marketingHomeHref}
                          className={cn(
                            "flex items-center gap-3 mb-8 p-3 rounded-xl border",
                            isLightMarketingNav
                              ? "bg-black/[0.03] border-black/10"
                              : "bg-gradient-to-r from-slate-900/50 to-slate-800/50 border-violet-400/15",
                          )}
                        >
                          <Image
                            src={isDarkMarketingNav ? marketingLogo : logoDark}
                            alt="Game Of Creators Logo"
                            width={140}
                            height={38}
                            className="h-9 w-auto"
                          />
                        </Link>

                        {isDarkMarketingNav ? (
                          <div className="mb-6">
                            <MarketingThemeToggle
                              lightChrome={isLightMarketingNav}
                            />
                          </div>
                        ) : null}

                        {/* Mobile Navigation Links */}
                        <nav className="space-y-2 mb-8">
                          {marketingPageLinks ? (
                            marketingPageLinks.map((link) => {
                              const isLinkLoading =
                                (link.label === "For Brands" && brandsLoading) ||
                                (link.label === "For Creators" &&
                                  creatorsLoading);
                              return (
                                <button
                                  key={link.label}
                                  type="button"
                                  onClick={() => {
                                    handleMarketingLinkClick(link);
                                    if (!link.href.includes("#")) setOpen(false);
                                  }}
                                  disabled={isLinkLoading}
                                  className={cn(
                                    "inline-flex items-center gap-3 text-base font-semibold px-4 py-3 rounded-xl transition-all duration-200 w-full text-left",
                                    isLightMarketingNav
                                      ? "text-black/70 hover:text-black hover:bg-black/[0.04]"
                                      : "text-slate-200 hover:text-white hover:bg-white/5",
                                    isLinkLoading &&
                                      "opacity-70 cursor-not-allowed"
                                  )}
                                >
                                  {isLinkLoading ? (
                                    <ButtonLoadingSpinner />
                                  ) : null}
                                  <span>{link.label}</span>
                                </button>
                              );
                            })
                          ) : isHomePage ? (
                            homeNavLinks.map((link) => {
                              const isLinkLoading =
                                (link.label === "For Brands" && brandsLoading) ||
                                (link.label === "For Creators" &&
                                  creatorsLoading);
                              return (
                                <button
                                  key={link.label}
                                  type="button"
                                  onClick={() => {
                                    setOpen(false);
                                    handleMarketingLinkClick(link);
                                  }}
                                  disabled={isLinkLoading}
                                  className={cn(
                                    "inline-flex items-center gap-3 text-base font-semibold px-4 py-3 rounded-xl transition-all duration-200 w-full text-left",
                                    isLightMarketingNav
                                      ? "text-black/70 hover:text-black hover:bg-black/[0.04]"
                                      : "text-slate-200 hover:text-white hover:bg-white/5",
                                    isLinkLoading &&
                                      "opacity-70 cursor-not-allowed"
                                  )}
                                >
                                  {isLinkLoading ? (
                                    <ButtonLoadingSpinner />
                                  ) : null}
                                  <span>{link.label}</span>
                                </button>
                              );
                            })
                          ) : (
                            <>
                              <button
                                onClick={() => goToMarketingPage("/brands")}
                                disabled={brandsLoading}
                                className={cn(
                                  "flex items-center gap-3 text-base font-semibold px-4 py-3 rounded-xl transition-all duration-200 w-full",
                                  pathname === "/brands"
                                    ? "text-white bg-white/5 border-l-2 border-purple-500"
                                    : "text-slate-200 hover:text-white hover:bg-white/5",
                                  brandsLoading &&
                                    "opacity-70 cursor-not-allowed"
                                )}
                              >
                                {brandsLoading ? (
                                  <ButtonLoadingSpinner />
                                ) : (
                                  <Crown className="h-4 w-4 text-purple-400 shrink-0" />
                                )}
                                <span>For Brands</span>
                              </button>
                              <button
                                onClick={() => goToMarketingPage("/creators")}
                                disabled={creatorsLoading}
                                className={cn(
                                  "flex items-center gap-3 text-base font-semibold px-4 py-3 rounded-xl transition-all duration-200 w-full",
                                  pathname === "/creators"
                                    ? "text-white bg-white/5 border-l-2 border-orange-400"
                                    : "text-slate-200 hover:text-white hover:bg-white/5",
                                  creatorsLoading &&
                                    "opacity-70 cursor-not-allowed"
                                )}
                              >
                                {creatorsLoading ? (
                                  <ButtonLoadingSpinner />
                                ) : (
                                  <Sparkles className="h-4 w-4 text-orange-400 shrink-0" />
                                )}
                                <span>For Creators</span>
                              </button>
                            </>
                          )}
                        </nav>

                        {/* Mobile User Section or Auth */}
                        {user ? (
                          <div className="space-y-3 border-t border-violet-400/20 pt-6">
                            <Link
                              href="/dashboard/profile"
                              className="flex items-center gap-3 p-4 bg-gradient-to-r from-slate-800/50 to-slate-700/50 rounded-xl border border-violet-400/20 hover:from-slate-700/50 hover:to-slate-600/50 transition-all duration-300 cursor-pointer"
                            >
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
                                <div className="text-sm font-semibold text-white">
                                  {displayName}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {displayEmail}
                                </div>
                              </div>
                            </Link>
                            <Link
                              href={quickLinkHref}
                              className="flex items-center gap-3 text-slate-300 hover:text-white p-4 rounded-xl hover:bg-violet-600/10 transition-colors"
                            >
                              <QuickLinkIcon className="h-5 w-5" />
                              {quickLinkLabel}
                            </Link>
                            <Link
                              href="/dashboard"
                              className="flex items-center gap-3 text-slate-300 hover:text-white p-4 rounded-xl hover:bg-violet-600/10 transition-colors"
                            >
                              <LayoutDashboard className="h-5 w-5" />
                              Dashboard
                            </Link>
                            <Link
                              href={MARKETING_HOME_AS_GUEST}
                              className="flex items-center gap-3 text-slate-300 hover:text-white p-4 rounded-xl hover:bg-violet-600/10 transition-colors"
                            >
                              <Home className="h-5 w-5" />
                              Home
                            </Link>
                            <Link
                              href="/dashboard/settings"
                              className="flex items-center gap-3 text-slate-300 hover:text-white p-4 rounded-xl hover:bg-violet-600/10 transition-colors"
                            >
                              <Settings className="h-5 w-5" />
                              Settings
                            </Link>
                            <button
                              onClick={handleSignOut}
                              className="flex items-center gap-3 text-red-300 hover:text-red-200 p-4 rounded-xl hover:bg-red-600/10 transition-colors w-full text-left"
                            >
                              <LogOut className="h-5 w-5" />
                              Log out
                            </button>
                          </div>
                        ) : isDarkMarketingNav ? (
                          <div
                            className={cn(
                              "space-y-4 border-t pt-6",
                              isLightMarketingNav
                                ? "border-black/10"
                                : "border-white/10",
                            )}
                          >
                            <Link href="/auth/signup" onClick={handleDarkMarketingSignUp}>
                              <Button
                                disabled={isNavigating || isSigningIn}
                                className={cn(
                                  "w-full flex items-center justify-center gap-2 rounded-full",
                                  isLightMarketingNav
                                    ? "bg-gradient-to-b from-[#8A68FF] to-[#754FF6] border border-[#7c3aed] text-white hover:bg-[#6d28d9]"
                                    : "bg-transparent border border-white/25 text-white hover:bg-white/10",
                                  (isNavigating || isSigningIn) &&
                                    "opacity-70 cursor-not-allowed"
                                )}
                              >
                                {isNavigating ? <ButtonLoadingSpinner /> : null}
                                <span>Sign up →</span>
                              </Button>
                            </Link>
                          </div>
                        ) : (
                          <div className="space-y-4 border-t border-violet-400/20 pt-6">
                            <Link href="/auth/signin" onClick={handleSignInNavigation}>
                              <Button
                                variant="outline"
                                disabled={isSigningIn || isNavigating}
                                className={cn(
                                  "w-full flex items-center justify-center gap-2 bg-slate-900/50 border-violet-400/20 text-slate-300 hover:text-white hover:bg-violet-600/10",
                                  (isSigningIn || isNavigating) && "opacity-70 cursor-not-allowed"
                                )}
                              >
                                {isSigningIn ? <ButtonLoadingSpinner /> : null}
                                <span>Sign In</span>
                              </Button>
                            </Link>

                            <Link href="/auth/signup" onClick={handleNavigation}>
                              <Button
                                disabled={isNavigating || isSigningIn}
                                className={cn(
                                  "w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold shadow-xl shadow-violet-500/25",
                                  (isNavigating || isSigningIn) && "opacity-70 cursor-not-allowed"
                                )}
                              >
                                {isNavigating ? <ButtonLoadingSpinner /> : null}
                                <span>Get Started</span>
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
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
