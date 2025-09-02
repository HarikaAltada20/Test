"use client";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import type { UserResponse } from "@supabase/supabase-js";
import { Suspense, useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Menu,
  X,
  Mail,
  Settings,
  User,
  LogOut,
  ChevronRight,
  Moon,
  Sun,
  Contrast,
  RotateCcw,
  Trophy,
  Maximize2,
  CreditCard,
  Maximize,
  Minimize,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ChatSuppport from "@/components/ChatSupport";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { useClientAuth } from "@/hooks/use-client-auth";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { subscriptionPlans } from "@/constants/subscriptionPlans";
import Link from "next/link";
import Image from "next/image";
import logo from "@/public/images/Primary Horizintal.svg";
import squareLogo from "@/public/images/Group (2).avif";

// Color Theme Configurations
const colorThemes = {
  purple: {
    name: "Game of Creators",
    primary: "139, 92, 246", // violet-500
    primaryLight: "167, 139, 250", // violet-400
    primaryDark: "109, 40, 217", // violet-600
    accent: "236, 72, 153", // pink-500
    scrollbar: "rgba(139, 92, 246, 0.4)",
    scrollbarHover: "rgba(139, 92, 246, 0.6)",
    sidebarScrollbar: "rgba(139, 92, 246, 0.5)",
    sidebarScrollbarHover: "rgba(139, 92, 246, 0.7)",
  },
  clean: {
    name: "Clean Professional",
    primary: "100, 116, 139", // slate-500
    primaryLight: "148, 163, 184", // slate-400
    primaryDark: "71, 85, 105", // slate-600
    accent: "59, 130, 246", // blue-500
    scrollbar: "rgba(100, 116, 139, 0.6)",
    scrollbarHover: "rgba(100, 116, 139, 0.8)",
    sidebarScrollbar: "rgba(100, 116, 139, 0.7)",
    sidebarScrollbarHover: "rgba(100, 116, 139, 0.9)",
  },
  blue: {
    name: "Blue Ocean",
    primary: "59, 130, 246", // blue-500
    primaryLight: "96, 165, 250", // blue-400
    primaryDark: "37, 99, 235", // blue-600
    accent: "14, 165, 233", // sky-500
    scrollbar: "rgba(59, 130, 246, 0.4)",
    scrollbarHover: "rgba(59, 130, 246, 0.6)",
    sidebarScrollbar: "rgba(59, 130, 246, 0.5)",
    sidebarScrollbarHover: "rgba(59, 130, 246, 0.7)",
  },
  green: {
    name: "Green Forest",
    primary: "34, 197, 94", // green-500
    primaryLight: "74, 222, 128", // green-400
    primaryDark: "22, 163, 74", // green-600
    accent: "16, 185, 129", // emerald-500
    scrollbar: "rgba(34, 197, 94, 0.4)",
    scrollbarHover: "rgba(34, 197, 94, 0.6)",
    sidebarScrollbar: "rgba(34, 197, 94, 0.5)",
    sidebarScrollbarHover: "rgba(34, 197, 94, 0.7)",
  },
  rose: {
    name: "Rose Sunset",
    primary: "244, 63, 94", // rose-500
    primaryLight: "251, 113, 133", // rose-400
    primaryDark: "225, 29, 72", // rose-600
    accent: "249, 115, 22", // orange-500
    scrollbar: "rgba(244, 63, 94, 0.4)",
    scrollbarHover: "rgba(244, 63, 94, 0.6)",
    sidebarScrollbar: "rgba(244, 63, 94, 0.5)",
    sidebarScrollbarHover: "rgba(244, 63, 94, 0.7)",
  },
} as const;

type ThemeKey = keyof typeof colorThemes;

// Preset Configurations (Mode + Theme Combinations)
const presetConfigurations = {
  "game-of-creators": {
    name: "🎮 Game of Creators",
    description: "Dark theme with purple accents",
    mode: "dark" as ModeKey,
    theme: "purple" as ThemeKey,
  },
  "clean-professional": {
    name: "🤍 Clean Professional",
    description: "Warm light theme with comfortable colors",
    mode: "light" as ModeKey,
    theme: "clean" as ThemeKey,
  },
  "dark-professional": {
    name: "🌙 Dark Professional",
    description: "Dark theme with minimal styling",
    mode: "dark" as ModeKey,
    theme: "clean" as ThemeKey,
  },
} as const;

type PresetKey = keyof typeof presetConfigurations;

// Dark/Light Mode Configurations
const modeConfigurations = {
  dark: {
    name: "Dark Mode",
    background: {
      primary: "15, 23, 42", // slate-900
      secondary: "30, 41, 59", // slate-800
      tertiary: "51, 65, 85", // slate-700
    },
    text: {
      primary: "248, 250, 252", // slate-50
      secondary: "203, 213, 225", // slate-300
      muted: "148, 163, 184", // slate-400
    },
    border: "71, 85, 105", // slate-600
  },
  light: {
    name: "Light Mode",
    background: {
      primary: "249, 250, 251", // gray-50 - softer than pure white
      secondary: "243, 244, 246", // gray-100 - subtle secondary bg
      tertiary: "229, 231, 235", // gray-200 - gentle tertiary bg
    },
    text: {
      primary: "17, 24, 39", // gray-900 - rich dark text
      secondary: "55, 65, 81", // gray-700 - readable secondary text
      muted: "107, 114, 128", // gray-500 - balanced muted text
    },
    border: "209, 213, 219", // gray-300 - visible but gentle borders
  },
} as const;

type ModeKey = keyof typeof modeConfigurations;

// Simple loading bar component that doesn't cause React conflicts
function SimpleLoadingBar() {
  return (
    <style jsx global>{`
      .nav-loading {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899);
        z-index: 9999;
        animation: loadingBar 1.5s ease-in-out;
        opacity: 0;
      }

      .nav-loading.active {
        opacity: 1;
      }

      @keyframes loadingBar {
        0% {
          width: 0%;
          left: 0%;
        }
        50% {
          width: 70%;
          left: 0%;
        }
        100% {
          width: 100%;
          left: 0%;
        }
      }
    `}</style>
  );
}

function DashboardContent({
  children,
  user,
}: {
  children: React.ReactNode;
  user: (UserResponse["data"]["user"] & { user_type?: string | null }) | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [profileData, setProfileData] = useState<{
    fullName: string;
    profilePictureUrl: string;
    isActive: boolean;
    subscriptionPlan: string | null;
  }>({
    fullName: "",
    profilePictureUrl: "",
    isActive: true,
    subscriptionPlan: null,
  });
  const [hasProcessedSuccess, setHasProcessedSuccess] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const userRole =
    (user?.user_type as "advertiser" | "creator" | "admin") || null;
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileSidebarOpen, setProfileSidebarOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>("clean");
  const [currentMode, setCurrentMode] = useState<ModeKey>("light");
  const [isOpen, setIsOpen] = useState(false);
  const [currentPreset, setCurrentPreset] =
    useState<PresetKey>("clean-professional");
  const [isColorfulMode, setIsColorfulMode] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(false);
  const { logout } = useClientAuth();
  const {
    isFullscreen,
    isSupported: isFullscreenSupported,
    isClient: isFullscreenClient,
    toggleFullscreen,
  } = useFullscreen();

  const handleSignOut = async () => {
    try {
      await logout();
      console.log("Sign out successful");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  // Handle checkout success - refresh subscription data with protection against infinite loops
  useEffect(() => {
    const success = searchParams.get("success");
    const sessionId = searchParams.get("session_id");

    if (success === "true" && sessionId && user && !hasProcessedSuccess) {
      console.log(
        "🎉 Payment successful in dashboard, refreshing subscription data..."
      );
      setHasProcessedSuccess(true);

      // Clear URL parameters to prevent refresh loops
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);

      // Refresh subscription data after a short delay to allow webhook processing
      const refreshSubscriptionData = async () => {
        try {
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const supabase = createClient();
          const { data: advertiserProfile } = await supabase
            .from("advertiser_profiles")
            .select("subscription_info")
            .eq("id", user.id)
            .single();

          if (advertiserProfile?.subscription_info?.product_id) {
            setProfileData((prev) => ({
              ...prev,
              subscriptionPlan: advertiserProfile.subscription_info.product_id,
            }));
            console.log(
              "✅ Subscription data refreshed:",
              advertiserProfile.subscription_info.product_id
            );
          }
        } catch (error) {
          console.error("Error refreshing subscription data:", error);
        }
      };

      refreshSubscriptionData();
    }
  }, [searchParams, user, hasProcessedSuccess]);

  // Fetch user profile data
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) return;

      const supabase = createClient();
      const { data: profile } = await supabase
        .from("users")
        .select("full_name, profile_picture_url, is_active, user_type")
        .eq("id", user.id)
        .single();

      if (profile) {
        let subscriptionPlan: string | null = null;

        // Fetch subscription plan for advertisers
        if (profile.user_type === "advertiser") {
          const { data: advertiserProfile } = await supabase
            .from("advertiser_profiles")
            .select("subscription_info")
            .eq("id", user.id)
            .single();

          subscriptionPlan =
            advertiserProfile?.subscription_info?.product_id || null;
        }

        setProfileData({
          fullName: profile.full_name,
          profilePictureUrl: profile.profile_picture_url,
          isActive: profile.is_active ?? true,
          subscriptionPlan: subscriptionPlan,
        });
      }
    };

    fetchProfileData();

    // Listen for profile update events
    const handleProfileUpdate = () => {
      console.log(
        "🔄 Profile update event received, refreshing sidebar data..."
      );
      fetchProfileData();
    };

    window.addEventListener("profile-updated", handleProfileUpdate);

    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdate);
    };
  }, [user]);

  // Theme persistence and initialization
  useEffect(() => {
    const savedPreset = localStorage.getItem("dashboard-preset") as PresetKey;
    if (savedPreset && presetConfigurations[savedPreset]) {
      setCurrentPreset(savedPreset);
      setCurrentMode(presetConfigurations[savedPreset].mode);
      setCurrentTheme(presetConfigurations[savedPreset].theme);
    } else {
      // Fallback to individual settings or defaults
      const savedTheme = localStorage.getItem("dashboard-theme") as ThemeKey;
      if (savedTheme && colorThemes[savedTheme]) {
        setCurrentTheme(savedTheme);
      } else {
        setCurrentTheme("clean"); // Default to clean theme
      }

      const savedMode = localStorage.getItem("dashboard-mode") as ModeKey;
      if (savedMode && modeConfigurations[savedMode]) {
        setCurrentMode(savedMode);
      } else {
        setCurrentMode("light"); // Default to light mode
      }

      // Set default preset if no individual settings
      if (!savedTheme && !savedMode) {
        setCurrentPreset("clean-professional");
      }
    }

    const savedColorfulMode = localStorage.getItem("dashboard-colorful-mode");
    if (savedColorfulMode !== null) {
      setIsColorfulMode(savedColorfulMode === "true");
    } else {
      // Set colorful mode to false by default if no preference is saved
      setIsColorfulMode(false);
      localStorage.setItem("dashboard-colorful-mode", "false");
    }

    // Load compact mode preference
    const savedCompactMode = localStorage.getItem("dashboard-compact-mode");
    if (savedCompactMode) {
      setIsCompactMode(savedCompactMode === "true");
    }
  }, []);

  // Preset switching function
  const switchPreset = (presetKey: PresetKey) => {
    const preset = presetConfigurations[presetKey];
    setCurrentPreset(presetKey);
    setCurrentMode(preset.mode);
    setCurrentTheme(preset.theme);
    localStorage.setItem("dashboard-preset", presetKey);
    localStorage.removeItem("dashboard-theme"); // Clear individual settings
    localStorage.removeItem("dashboard-mode");
  };

  // Theme switching function
  const switchTheme = (themeKey: ThemeKey) => {
    setCurrentTheme(themeKey);
    localStorage.setItem("dashboard-theme", themeKey);
    localStorage.removeItem("dashboard-preset"); // Clear preset when manually changing
  };

  // Mode switching function
  const switchMode = (modeKey: ModeKey) => {
    setCurrentMode(modeKey);
    localStorage.setItem("dashboard-mode", modeKey);
    localStorage.removeItem("dashboard-preset"); // Clear preset when manually changing
  };

  const toggleColorfulMode = (enabled: boolean) => {
    setIsColorfulMode(enabled);
    localStorage.setItem("dashboard-colorful-mode", String(enabled));
  };

  const toggleCompactMode = (enabled: boolean) => {
    setIsCompactMode(enabled);
    localStorage.setItem("dashboard-compact-mode", String(enabled));
  };

  // Reset to default function
  const resetToDefault = () => {
    switchPreset("clean-professional");
  };

  // Get current theme and mode configurations
  const theme = colorThemes[currentTheme];
  const mode = modeConfigurations[currentMode];

  // Helper function to convert RGB to HSL for CSS custom properties
  const getThemeHSL = (themeKey: ThemeKey) => {
    switch (themeKey) {
      case "purple":
        return "258.3 89.5% 66.3%"; // violet-500 in HSL
      case "clean":
        return "215.4 16.3% 46.9%"; // slate-500 in HSL
      case "blue":
        return "217.2 91.2% 59.8%"; // blue-500 in HSL
      case "green":
        return "142.1 76.2% 36.3%"; // green-500 in HSL
      case "rose":
        return "349.7 89.2% 60.2%"; // rose-500 in HSL
      default:
        return "258.3 89.5% 66.3%";
    }
  };

  // Function to get page title from pathname
  const getPageTitle = (path: string) => {
    if (path === "/dashboard") return "Overview";
    if (path.includes("/contests")) return "Contests";
    if (path.includes("/analytics")) return "Analytics";
    if (path.includes("/billing")) return "Billing";
    if (path.includes("/settings")) return "Settings";
    if (path.includes("/submissions")) return "Submissions";
    if (path.includes("/opportunities")) return "Opportunities";
    if (path.includes("/earnings")) return "Earnings";
    if (path.includes("/admin")) return "Admin";

    // Default fallback
    const segments = path.split("/").filter(Boolean);
    if (segments.length > 1) {
      return (
        segments[segments.length - 1].charAt(0).toUpperCase() +
        segments[segments.length - 1].slice(1)
      );
    }
    return "Overview";
  };

  const currentPageTitle = getPageTitle(pathname);

  // Get user display info
  const displayName =
    profileData.fullName ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";
  const displayEmail = user?.email || "";
  const avatarSrc =
    profileData.profilePictureUrl ||
    user?.user_metadata?.profile_picture_url ||
    "";
  const avatarFallback = displayName.charAt(0).toUpperCase();

  // Get subscription plan details
  const getCurrentPlan = () => {
    if (!profileData.subscriptionPlan || userRole !== "advertiser") {
      return subscriptionPlans[0]; // Default to EXPLORER plan
    }
    return (
      subscriptionPlans.find(
        (plan) => plan.id === profileData.subscriptionPlan
      ) || subscriptionPlans[0]
    );
  };

  const currentPlan = getCurrentPlan();

  return (
    <div
      className="bg-background"
      data-theme={currentMode}
      data-color-theme={currentTheme}
    >
      <SimpleLoadingBar />

      <style jsx global>{`
        :root {
          --background: ${currentMode === "light"
            ? "210 20% 98%"
            : "222.2 84% 4.9%"};
          --foreground: ${currentMode === "light"
            ? "220 13% 9%"
            : "210 40% 98%"};
          --card: ${currentMode === "light" ? "0 0% 96%" : "217.2 32.6% 17.5%"};
          --card-foreground: ${currentMode === "light"
            ? "220 13% 9%"
            : "210 40% 98%"};
          --popover: ${currentMode === "light"
            ? "0 0% 96%"
            : "217.2 32.6% 17.5%"};
          --popover-foreground: ${currentMode === "light"
            ? "220 13% 9%"
            : "210 40% 98%"};
          --primary: ${getThemeHSL(currentTheme)};
          --primary-foreground: ${currentMode === "light"
            ? "0 0% 100%"
            : "222.2 84% 4.9%"};
          --secondary: ${currentMode === "light"
            ? "220 14% 96%"
            : "217.2 32.6% 17.5%"};
          --secondary-foreground: ${currentMode === "light"
            ? "220 9% 46%"
            : "210 40% 98%"};
          --muted: ${currentMode === "light"
            ? "220 13% 91%"
            : "217.2 32.6% 17.5%"};
          --muted-foreground: ${currentMode === "light"
            ? "220 9% 46%"
            : "215 20.2% 75.1%"};
          --accent: ${currentMode === "light"
            ? "220 13% 91%"
            : "217.2 32.6% 17.5%"};
          --accent-foreground: ${currentMode === "light"
            ? "220 13% 9%"
            : "210 40% 98%"};
          --border: ${currentMode === "light"
            ? "220 13% 82%"
            : "217.2 32.6% 17.5%"};
          --input: ${currentMode === "light"
            ? "220 13% 82%"
            : "217.2 32.6% 17.5%"};
          --ring: ${getThemeHSL(currentTheme)};
        }

        /* Compact Mode Zoom Control */
        .dashboard-container {
          zoom: ${isCompactMode ? "0.85" : "1"};
          transition: zoom 0.3s ease-in-out;
        }

        /* Ensure smooth transitions for all elements when zoom changes */
        .dashboard-container * {
          transition: all 0.3s ease-in-out;
        }
      `}</style>

      {/* Global Theme-Based Scrollbar Styles */}
      <style jsx global>{`
        /* Theme-based scrollbar for all elements */
        * {
          scrollbar-width: thin;
          scrollbar-color: ${theme.scrollbar}
            rgba(${mode.background.secondary}, 0.1);
        }

        /* Webkit scrollbar styling */
        *::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        *::-webkit-scrollbar-track {
          background: rgba(
            ${mode.background.secondary},
            ${currentMode === "light" ? "0.5" : "0.1"}
          );
          border-radius: 10px;
        }

        *::-webkit-scrollbar-thumb {
          background: ${theme.scrollbar};
          border-radius: 10px;
          transition: all 0.2s ease;
        }

        *::-webkit-scrollbar-thumb:hover {
          background: ${theme.scrollbarHover};
        }

        *::-webkit-scrollbar-corner {
          background: transparent;
        }

        /* Sidebar specific scrollbar - always reserve space to prevent layout shift */
        .sidebar-scrollbar,
        .sidebar-scrollbar-hidden {
          scrollbar-width: thin; /* Firefox - thin scrollbar */
          scrollbar-gutter: stable; /* Always reserve space for scrollbar */
        }

        .sidebar-scrollbar {
          scrollbar-color: ${theme.sidebarScrollbar} transparent; /* Firefox - visible thumb */
        }

        .sidebar-scrollbar-hidden {
          scrollbar-color: transparent transparent; /* Firefox - hidden thumb */
        }

        /* WebKit scrollbar styles */
        .sidebar-scrollbar::-webkit-scrollbar,
        .sidebar-scrollbar-hidden::-webkit-scrollbar {
          width: 6px;
          background: transparent; /* Always transparent track */
        }

        .sidebar-scrollbar::-webkit-scrollbar-thumb {
          background: ${theme.sidebarScrollbar};
          border-radius: 3px;
        }

        .sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${theme.sidebarScrollbarHover};
        }

        .sidebar-scrollbar-hidden::-webkit-scrollbar-thumb {
          background: transparent; /* Hidden thumb */
        }

        .sidebar-scrollbar-hidden::-webkit-scrollbar-thumb:hover {
          background: transparent; /* Keep hidden on hover */
        }
      `}</style>

      {/* Main Layout Container */}
      <div className="flex min-h-screen dashboard-container">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            "hidden lg:flex flex-col backdrop-blur-sm border-r transition-all duration-300 ease-in-out fixed left-0 top-0 z-30",
            sidebarCollapsed ? "w-28" : "w-72"
          )}
          // style={{
          //   background:
          //     currentMode === "light"
          //       ? `linear-gradient(to bottom, rgba(${mode.background.secondary}, 1), rgba(${mode.background.tertiary}, 1), rgba(${mode.background.secondary}, 1))`
          //       : `linear-gradient(to bottom, rgba(${mode.background.primary}, 0.95), rgba(${mode.background.secondary}, 0.90), rgba(${mode.background.primary}, 0.95))`,
          //   borderRightColor: `rgba(${theme.primary}, ${
          //     currentMode === "light" ? "0.3" : "0.2"
          //   })`,
          //   boxShadow:
          //     currentMode === "light"
          //       ? `2px 0 8px 0 rgba(0, 0, 0, 0.1), inset -1px 0 0 0 rgba(${theme.primary}, 0.1)`
          //       : "none",
          // }}
        >
          {/* Sidebar Header - Premium Styling to Match Main Header */}
          <div
            className="relative bg-white flex h-20 items-center justify-center border-b"
            // style={{ borderBottomColor: `rgba(${theme.primary}, 0.3)` }}
          >
            {/* <div
              className="absolute inset-0"
              style={{
                background:
                  currentMode === "light"
                    ? `linear-gradient(to right, rgba(${mode.background.primary}, 1), rgba(${mode.background.secondary}, 1), rgba(${mode.background.primary}, 1))`
                    : `linear-gradient(to right, rgba(${mode.background.primary}, 1), rgba(${mode.background.secondary}, 1), rgba(${mode.background.primary}, 1))`,
              }}
            ></div>
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 30% 50%, rgba(${theme.primary
                  }, ${currentMode === "light" ? "0.05" : "0.1"}), transparent)`,
              }}
            ></div>
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 70% 50%, rgba(${theme.accent
                  }, ${currentMode === "light" ? "0.03" : "0.08"}), transparent)`,
              }}
            ></div> */}

            {/* Logo - Centered and Full Width */}
            <div className="relative flex items-center justify-center flex-1 z-10">
              {!sidebarCollapsed ? (
                <Link
                  href="/"
                  className="flex items-center group transition-all duration-300"
                >
                  <div
                  // className={cn(
                  //   "relative p-3 rounded-lg transition-all duration-300",
                  //   currentMode === "light"
                  //     ? "bg-gradient-to-br from-slate-100 to-white border border-slate-200 shadow-lg hover:shadow-xl"
                  //     : "hover:bg-white/5"
                  // )}
                  // style={{
                  //   ...(currentMode === "light" && {
                  //     boxShadow: `0 4px 6px -1px rgba(${theme.primary}, 0.1), 0 2px 4px -1px rgba(${theme.primary}, 0.06)`,
                  //   }),
                  // }}
                  >
                    <Image
                      src={logo}
                      alt="Game Of Creators Logo"
                      width={180}
                      height={100}
                      className={cn(
                        "h-[50px] w-auto transition-all duration-300",
                        currentMode === "light"
                          ? "filter brightness-90 contrast-110 saturate-110 group-hover:brightness-75"
                          : "filter brightness-110 group-hover:brightness-125"
                      )}
                    />
                  </div>
                </Link>
              ) : (
                <Link
                  href="/"
                  className="flex items-center justify-center group transition-all duration-300"
                >
                  <div
                    className={cn(
                      "relative p-2 rounded-lg transition-all duration-300",
                      currentMode === "light"
                        ? "bg-gradient-to-br from-slate-100 to-white border border-slate-200 shadow-lg hover:shadow-xl"
                        : "hover:bg-white/5"
                    )}
                    style={{
                      ...(currentMode === "light" && {
                        boxShadow: `0 4px 6px -1px rgba(${theme.primary}, 0.1), 0 2px 4px -1px rgba(${theme.primary}, 0.06)`,
                      }),
                    }}
                  >
                    <Image
                      src={squareLogo}
                      alt="Game Of Creators"
                      width={184}
                      height={100}
                      className={cn(
                        "h-[50px] w-auto transition-all duration-300",
                        currentMode === "light"
                          ? "filter brightness-90 contrast-110 saturate-110 group-hover:brightness-75"
                          : "filter brightness-110 group-hover:brightness-125"
                      )}
                    />
                  </div>
                </Link>
              )}
            </div>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-hidden">
            {userRole && (
              <DashboardSidebar
                userRole={userRole}
                onChatOpen={() => setIsChatOpen(true)}
                collapsed={sidebarCollapsed}
              />
            )}
          </div>
        </aside>

        {/* Sidebar Toggle Button - Always Centered at Sidebar/Header Border */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={cn(
            "hidden lg:flex fixed top-6 z-50 h-8 w-8 rounded-full backdrop-blur-sm transition-all duration-200",
            "border items-center justify-center"
          )}
          style={{
            left: sidebarCollapsed ? "86px" : "240px", // Center of actual sidebar border (adjusted for zoom)
            backgroundColor:
              currentMode === "light"
                ? `rgba(${mode.background.primary}, 0.9)`
                : `rgba(${mode.background.secondary}, 0.9)`,
            borderColor: `rgba(${theme.primary}, ${
              currentMode === "light" ? "0.2" : "0.15"
            })`,
            boxShadow:
              currentMode === "light"
                ? "0 1px 2px rgba(0, 0, 0, 0.05)"
                : `0 1px 2px rgba(${theme.primary}, 0.1)`,
            transition:
              "box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.4)`;
            e.currentTarget.style.backgroundColor =
              currentMode === "light"
                ? `rgba(${theme.primary}, 0.08)`
                : `rgba(${theme.primary}, 0.12)`;
            // Subtle glow effect without movement
            e.currentTarget.style.boxShadow =
              currentMode === "light"
                ? `0 0 8px rgba(${theme.primary}, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)`
                : `0 0 8px rgba(${theme.primary}, 0.4), 0 2px 4px rgba(${theme.primary}, 0.2)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = `rgba(${theme.primary}, ${
              currentMode === "light" ? "0.2" : "0.15"
            })`;
            e.currentTarget.style.backgroundColor =
              currentMode === "light"
                ? `rgba(${mode.background.primary}, 0.9)`
                : `rgba(${mode.background.secondary}, 0.9)`;
            e.currentTarget.style.boxShadow =
              currentMode === "light"
                ? "0 1px 2px rgba(0, 0, 0, 0.05)"
                : `0 1px 2px rgba(${theme.primary}, 0.1)`;
          }}
        >
          {sidebarCollapsed ? (
            // Right arrow for expand (show sidebar)
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 18L15 12L9 6"
                stroke={
                  currentMode === "light"
                    ? `rgba(${mode.text.primary}, 0.8)`
                    : `rgba(${theme.primaryLight}, 0.9)`
                }
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            // Left arrow for collapse (hide sidebar)
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18L9 12L15 6"
                stroke={
                  currentMode === "light"
                    ? `rgba(${mode.text.primary}, 0.8)`
                    : `rgba(${theme.primaryLight}, 0.9)`
                }
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <span className="sr-only">
            {sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          </span>
        </Button>

        {/* Main Content Area */}
        <div
          className={cn(
            "flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out",
            sidebarCollapsed ? "lg:ml-28" : "lg:ml-72"
          )}
        >
          {/* Premium Dashboard Header */}
          <header
            className="sticky top-0 z-40 w-full"
            style={{
              boxShadow:
                currentMode === "light"
                  ? "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
                  : "none",
            }}
          >
            {/* Premium Background with Strategic Gradients */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  currentMode === "light"
                    ? `linear-gradient(to right, rgba(${mode.background.primary}, 1), rgba(${mode.background.secondary}, 1), rgba(${mode.background.primary}, 1))`
                    : `linear-gradient(to right, rgba(${mode.background.primary}, 1), rgba(${mode.background.secondary}, 1), rgba(${mode.background.primary}, 1))`,
              }}
            ></div>
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 30% 50%, rgba(${
                  theme.primary
                }, ${currentMode === "light" ? "0.05" : "0.1"}), transparent)`,
              }}
            ></div>
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 70% 50%, rgba(${
                  theme.accent
                }, ${currentMode === "light" ? "0.03" : "0.08"}), transparent)`,
              }}
            ></div>

            {/* Premium Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px]"></div>

            {/* Refined Border */}
            <div
              className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent to-transparent"
              style={{
                backgroundColor:
                  currentMode === "light"
                    ? `rgba(${mode.border}, 1)`
                    : `rgba(${theme.primary}, 0.3)`,
              }}
            ></div>

            <div className="relative">
              <div className="flex h-20 items-center justify-between px-6">
                {/* Left Side: Sidebar Toggle + Mobile Menu + Breadcrumb */}
                <div className="flex items-center gap-4">
                  {/* Mobile Menu Trigger */}
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden h-8 w-8 backdrop-blur-sm transition-all duration-300"
                        style={{
                          backgroundColor:
                            currentMode === "light"
                              ? `rgba(${mode.background.tertiary}, 1)`
                              : `rgba(${mode.background.secondary}, 0.5)`,
                          borderColor: `rgba(${theme.primary}, ${
                            currentMode === "light" ? "0.3" : "0.2"
                          })`,
                          color: `rgba(${mode.text.muted}, 1)`,
                          boxShadow:
                            currentMode === "light"
                              ? "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
                              : "none",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.4)`;
                          e.currentTarget.style.backgroundColor = `rgba(${theme.primary}, 0.1)`;
                          e.currentTarget.style.color = `rgba(${mode.text.primary}, 1)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.2)`;
                          e.currentTarget.style.backgroundColor = `rgba(${mode.background.secondary}, 0.5)`;
                          e.currentTarget.style.color = `rgba(${mode.text.muted}, 1)`;
                        }}
                      >
                        <Menu className="h-4 w-4" />
                        <span className="sr-only">Toggle Sidebar</span>
                      </Button>
                    </SheetTrigger>
                    <SheetContent
                      side="left"
                      className="w-64 p-0 bg-gradient-to-b from-slate-950/95 via-slate-900/90 to-slate-950/95 backdrop-blur-sm border-r border-violet-500/20"
                    >
                      <SheetHeader className="flex h-20 items-center justify-between border-b border-violet-500/30 px-4">
                        {/* Premium Background Effects for Mobile Header */}
                        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950"></div>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(139,92,246,0.1),transparent)]"></div>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(236,72,153,0.08),transparent)]"></div>
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px]"></div>

                        <SheetTitle className="relative font-semibold text-white z-10">
                          Game Of Creators
                        </SheetTitle>
                        <SheetDescription className="sr-only">
                          Dashboard navigation menu
                        </SheetDescription>
                      </SheetHeader>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto sidebar-scrollbar h-full">
                          {userRole && (
                            <DashboardSidebar
                              userRole={userRole}
                              onChatOpen={() => setIsChatOpen(true)}
                              collapsed={false}
                            />
                          )}
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>

                  <Separator
                    orientation="vertical"
                    className={cn(
                      "h-6",
                      currentMode === "light"
                        ? "bg-slate-300"
                        : "bg-violet-400/20"
                    )}
                  />

                  {/* Enhanced Breadcrumb */}
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem className="hidden md:block">
                        <BreadcrumbLink
                          href="/dashboard"
                          className={cn(
                            "transition-colors duration-200",
                            currentMode === "light"
                              ? "text-slate-600 hover:text-slate-900"
                              : "text-slate-300 hover:text-white"
                          )}
                        >
                          Dashboard
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      {pathname !== "/dashboard" && (
                        <>
                          <BreadcrumbSeparator
                            className={cn(
                              "hidden md:block",
                              currentMode === "light"
                                ? "text-slate-400"
                                : "text-slate-500"
                            )}
                          />
                          <BreadcrumbItem>
                            <BreadcrumbPage
                              className={cn(
                                "font-medium",
                                currentMode === "light"
                                  ? "text-slate-900"
                                  : "text-white"
                              )}
                            >
                              {currentPageTitle}
                            </BreadcrumbPage>
                          </BreadcrumbItem>
                        </>
                      )}
                    </BreadcrumbList>
                  </Breadcrumb>
                </div>

                {/* Right Side: Actions */}
                <div className="flex items-center gap-3">
                  {/* Full Screen Toggle Button */}
                  {isFullscreenClient && isFullscreenSupported && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleFullscreen()}
                      className="h-8 w-8 backdrop-blur-sm transition-all duration-300"
                      style={{
                        backgroundColor:
                          currentMode === "light"
                            ? `rgba(${mode.background.tertiary}, 1)`
                            : `rgba(${mode.background.secondary}, 0.5)`,
                        borderColor: `rgba(${theme.primary}, ${
                          currentMode === "light" ? "0.3" : "0.2"
                        })`,
                        color: `rgba(${mode.text.muted}, 1)`,
                        boxShadow:
                          currentMode === "light"
                            ? "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
                            : "none",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.4)`;
                        e.currentTarget.style.backgroundColor = `rgba(${theme.primary}, 0.1)`;
                        e.currentTarget.style.color = `rgba(${mode.text.primary}, 1)`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.2)`;
                        e.currentTarget.style.backgroundColor = `rgba(${mode.background.secondary}, 0.5)`;
                        e.currentTarget.style.color = `rgba(${mode.text.muted}, 1)`;
                      }}
                    >
                      {isFullscreen ? (
                        <Minimize className="h-4 w-4" />
                      ) : (
                        <Maximize className="h-4 w-4" />
                      )}
                      <span className="sr-only">Toggle Fullscreen</span>
                    </Button>
                  )}

                  {/* Compact Mode Indicator - Shows current zoom level */}
                  <div
                    className="flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-medium transition-all duration-300 cursor-pointer hover:scale-105"
                    style={{
                      backgroundColor:
                        currentMode === "light"
                          ? `rgba(${mode.background.tertiary}, 0.8)`
                          : `rgba(${mode.background.secondary}, 0.3)`,
                      borderColor: `rgba(${theme.primary}, ${
                        currentMode === "light" ? "0.2" : "0.15"
                      })`,
                      color: `rgba(${mode.text.secondary}, 1)`,
                    }}
                    title={`Click to toggle: ${
                      isCompactMode
                        ? "Switch to Normal (100%)"
                        : "Switch to Compact (85%)"
                    }`}
                    onClick={() => toggleCompactMode(!isCompactMode)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.4)`;
                      e.currentTarget.style.backgroundColor = `rgba(${theme.primary}, 0.1)`;
                      e.currentTarget.style.color = `rgba(${mode.text.primary}, 1)`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = `rgba(${
                        theme.primary
                      }, ${currentMode === "light" ? "0.2" : "0.15"})`;
                      e.currentTarget.style.backgroundColor =
                        currentMode === "light"
                          ? `rgba(${mode.background.tertiary}, 0.8)`
                          : `rgba(${mode.background.secondary}, 0.3)`;
                      e.currentTarget.style.color = `rgba(${mode.text.secondary}, 1)`;
                    }}
                  >
                    <svg
                      className="h-3 w-3"
                      style={{ color: `rgba(${theme.primary}, 1)` }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                      />
                    </svg>
                    {isCompactMode ? "85%" : "100%"}
                  </div>

                  {/* Settings Panel Trigger - Premium Style */}
                  <Sheet
                    open={settingsPanelOpen}
                    onOpenChange={setSettingsPanelOpen}
                  >
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 backdrop-blur-sm transition-all duration-300"
                        style={{
                          backgroundColor:
                            currentMode === "light"
                              ? `rgba(${mode.background.tertiary}, 1)`
                              : `rgba(${mode.background.secondary}, 0.5)`,
                          borderColor: `rgba(${theme.primary}, ${
                            currentMode === "light" ? "0.3" : "0.2"
                          })`,
                          color: `rgba(${mode.text.muted}, 1)`,
                          boxShadow:
                            currentMode === "light"
                              ? "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
                              : "none",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.4)`;
                          e.currentTarget.style.backgroundColor = `rgba(${theme.primary}, 0.1)`;
                          e.currentTarget.style.color = `rgba(${mode.text.primary}, 1)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.2)`;
                          e.currentTarget.style.backgroundColor = `rgba(${mode.background.secondary}, 0.5)`;
                          e.currentTarget.style.color = `rgba(${mode.text.muted}, 1)`;
                        }}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span className="sr-only">Dashboard Customization</span>
                      </Button>
                    </SheetTrigger>

                    {/* Settings Panel Content */}
                    <SheetContent
                      side="right"
                      className="w-96 bg-white p-0 border-l"
                      // style={{
                      //   background: `linear-gradient(135deg, rgba(${mode.background.primary}, 1), rgba(${mode.background.secondary}, 1))`,
                      //   borderColor: `rgba(${theme.primary}, 0.2)`,
                      // }}
                    >
                      {/* Premium Background Effects */}
                      {/* <div
                        className="absolute inset-0"
                        style={{
                          background: `radial-gradient(circle at 70% 30%, rgba(${theme.primary}, 0.1), transparent)`,
                        }}
                      ></div>
                      <div
                        className="absolute inset-0"
                        style={{
                          background: `radial-gradient(circle at 30% 70%, rgba(${theme.accent}, 0.08), transparent)`,
                        }}
                      ></div>
                      <div
                        className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px]"
                        style={{
                          opacity: 0.3,
                        }}
                      ></div> */}

                      <div className="relative h-full flex flex-col">
                        {/* Header */}
                        <SheetHeader
                          className="p-6 border-b flex-shrink-0"
                          style={{
                            borderColor: `rgba(${theme.primary}, 0.15)`,
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="flex bg-[#D8C3FF] text-purple-600 rounded-full p-3 items-center mr-2"
                              // style={{
                              //   backgroundColor: `rgba(${theme.primary}, 0.2)`,
                              // }}
                            >
                              <Settings
                                className="h-6 w-6"
                                // style={{
                                //   color: `rgba(${theme.primary}, 1)`,
                                // }}
                              />
                            </div>
                            <div className="flex-1">
                              <SheetTitle
                                className="text-lg font-semibold"
                                style={{
                                  color: `rgba(${mode.text.primary}, 1)`,
                                }}
                              >
                                Dashboard Customization
                              </SheetTitle>
                              <p
                                className="text-sm"
                                style={{
                                  color: `rgba(${mode.text.secondary}, 1)`,
                                }}
                              >
                                Customize your dashboard experience
                              </p>
                            </div>
                          </div>
                          <SheetDescription className="sr-only">
                            Dashboard customization settings
                          </SheetDescription>
                        </SheetHeader>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto sidebar-scrollbar">
                          <div className="p-6 space-y-6">
                            {/* Quick Presets - COMMENTED OUT FOR SIMPLICITY */}
                            {/* <div className="space-y-4">
                              <h3
                                className="text-sm font-semibold uppercase tracking-wider"
                                style={{
                                  color: `rgba(${mode.text.muted}, 1)`
                                }}
                              >
                                Quick Presets
                              </h3>
                              <div className="grid grid-cols-1 gap-3">
                                {Object.entries(presetConfigurations).map(([key, preset]) => (
                                  <button
                                    key={key}
                                    onClick={() => switchPreset(key as PresetKey)}
                                    className={cn(
                                      "p-3 rounded-lg border text-left transition-all duration-200",
                                      currentPreset === key
                                        ? "border-primary bg-primary/10"
                                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                    )}
                                    style={{
                                      borderColor: currentPreset === key ? `rgba(${theme.primary}, 0.3)` : `rgba(${mode.border}, 0.3)`,
                                      backgroundColor: currentPreset === key ? `rgba(${theme.primary}, 0.1)` : 'transparent'
                                    }}
                                  >
                                    <div className="font-medium text-sm" style={{ color: `rgba(${mode.text.primary}, 1)` }}>
                                      {preset.name}
                                    </div>
                                    <div className="text-xs mt-1" style={{ color: `rgba(${mode.text.muted}, 1)` }}>
                                      {preset.description}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div> */}

                            {/* Color Themes - COMMENTED OUT FOR SIMPLICITY */}
                            {/* <div className="space-y-4">
                              <h3
                                className="text-sm font-semibold uppercase tracking-wider"
                                style={{
                                  color: `rgba(${mode.text.muted}, 1)`
                                }}
                              >
                                Color Themes
                              </h3>
                              <div className="grid grid-cols-2 gap-3">
                                {Object.entries(colorThemes).map(([key, themeConfig]) => (
                                  <button
                                    key={key}
                                    onClick={() => switchTheme(key as ThemeKey)}
                                    className={cn(
                                      "p-3 rounded-lg border text-left transition-all duration-200",
                                      currentTheme === key
                                        ? "border-primary bg-primary/10"
                                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                    )}
                                    style={{
                                      borderColor: currentTheme === key ? `rgba(${theme.primary}, 0.3)` : `rgba(${mode.border}, 0.3)`,
                                      backgroundColor: currentTheme === key ? `rgba(${theme.primary}, 0.1)` : 'transparent'
                                    }}
                                  >
                                    <div className="font-medium text-sm" style={{ color: `rgba(${mode.text.primary}, 1)` }}>
                                      {themeConfig.name}
                                    </div>
                                    <div className="text-xs mt-1" style={{ color: `rgba(${mode.text.muted}, 1)` }}>
                                      {themeConfig.description}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div> */}

                            {/* Colorful Mode Toggle */}
                            {/* <div
                              className="flex items-center justify-between p-4 rounded-xl border"
                              style={{
                                backgroundColor: `rgba(${mode.background.secondary}, 0.3)`,
                                borderColor: `rgba(${theme.primary}, 0.2)`,
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                                  style={{
                                    backgroundColor: `rgba(${theme.primary}, 0.2)`,
                                  }}
                                >
                                  <Contrast
                                    className="h-5 w-5"
                                    style={{
                                      color: `rgba(${theme.primaryLight}, 1)`,
                                    }}
                                  />
                                </div>
                                <div>
                                  <div
                                    className="font-medium text-sm"
                                    style={{
                                      color: `rgba(${mode.text.primary}, 1)`,
                                    }}
                                  >
                                    Colorful Mode
                                  </div>
                                  <div
                                    className="text-xs"
                                    style={{
                                      color: `rgba(${mode.text.muted}, 1)`,
                                    }}
                                  >
                                    Enable vibrant theme colors
                                  </div>
                                </div>
                              </div>
                              <Switch
                                checked={isColorfulMode}
                                onCheckedChange={toggleColorfulMode}
                              />
                            </div> */}

                            {/* Full Screen Toggle - KEPT FOR SIMPLICITY */}
                            {isFullscreenClient && isFullscreenSupported && (
                              <div
                                className="w-full bg-[#D9C0FF26] flex justify-between items-center border border-[#7F39EC] rounded-lg px-4 py-5  transition"
                                // style={{
                                //   backgroundColor: `rgba(${mode.background.secondary}, 0.3)`,
                                //   borderColor: `rgba(${theme.primary}, 0.2)`,
                                // }}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                   className="flex bg-[#D8C3FF] text-purple-600 rounded-full p-3 items-center mr-1"
                                    // style={{
                                    //   backgroundColor: `rgba(${theme.primary}, 0.2)`,
                                    // }}
                                  >
                                    {isFullscreen ? (
                                      <Minimize
                                        className="h-5 w-5"
                                        // style={{
                                        //   color: `rgba(${theme.primaryLight}, 1)`,
                                        // }}
                                      />
                                    ) : (
                                      <Maximize
                                        className="h-5 w-5"
                                        // style={{
                                        //   color: `rgba(${theme.primaryLight}, 1)`,
                                        // }}
                                      />
                                    )}
                                  </div>
                                  <div>
                                    <div
                                      className="font-medium text-md"
                                      style={{
                                        color: `rgba(${mode.text.primary}, 1)`,
                                      }}
                                    >
                                      {isFullscreen
                                        ? "Exit Full Screen"
                                        : "Full Screen Mode"}
                                    </div>
                                    <div
                                      className="text-sm"
                                      style={{
                                        color: `rgba(${mode.text.muted}, 1)`,
                                      }}
                                    >
                                      Toggle full screen view
                                    </div>
                                  </div>
                                </div>
                                <Switch
                                  checked={isFullscreen}
                                  onCheckedChange={toggleFullscreen}
                                />
                              </div>
                            )}

                            {/* Compact Mode Toggle - NEW FEATURE */}
                            <div
                               className="w-full bg-[#D9C0FF26] flex justify-between items-center border border-[#7F39EC] rounded-lg px-4 py-5  transition"
                              // style={{
                              //   backgroundColor: `rgba(${mode.background.secondary}, 0.3)`,
                              //   borderColor: `rgba(${theme.primary}, 0.2)`,
                              // }}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                 className="flex bg-[#D8C3FF] text-purple-600 rounded-full p-3 items-center mr-1"
                                  // style={{
                                  //   backgroundColor: `rgba(${theme.primary}, 0.2)`,
                                  // }}
                                >
                                  <svg
                                    className="h-5 w-5"
                                    // style={{
                                    //   color: `rgba(${theme.primaryLight}, 1)`,
                                    // }}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                                    />
                                  </svg>
                                </div>
                                <div>
                                  <div
                                    className="font-medium text-md"
                                    style={{
                                      color: `rgba(${mode.text.primary}, 1)`,
                                    }}
                                  >
                                    Compact Mode
                                  </div>
                                  <div
                                    className="text-xs mr-2"
                                    style={{
                                      color: `rgba(${mode.text.muted}, 1)`,
                                    }}
                                  >
                                    {isCompactMode
                                      ? '85% zoom - Perfect for 14" screens'
                                      : '100% zoom - Standard for 15"+ screens'}
                                  </div>
                                </div>
                              </div>
                              <Switch
                                checked={isCompactMode}
                                onCheckedChange={toggleCompactMode}
                              />
                            </div>

                            {/* Reset Button - COMMENTED OUT FOR SIMPLICITY */}
                            {/* <div className="pt-4">
                              <Button
                                onClick={resetToDefault}
                                variant="outline"
                                size="sm"
                                className="w-full justify-center gap-2"
                                style={{
                                  borderColor: `rgba(${theme.primary}, 0.3)`,
                                  color: `rgba(${theme.primary}, 1)`
                                }}
                              >
                                <RotateCcw className="h-4 w-4" />
                                Reset to Default
                              </Button>
                            </div> */}
                          </div>
                        </div>

                        {/* Footer - Action Buttons - COMMENTED OUT FOR SIMPLICITY */}
                        {/* <div
                          className="p-6 border-t flex-shrink-0"
                          style={{
                            borderColor: `rgba(${theme.primary}, ${currentMode === 'dark' ? '0.2' : '0.15'})`
                          }}
                        >
                          <Button
                            onClick={resetToDefault}
                            variant="ghost"
                            className="w-full border transition-all duration-300"
                            style={{
                              backgroundColor: `rgba(${mode.background.secondary}, 0.3)`,
                              borderColor: `rgba(${theme.primary}, 0.3)`,
                              color: `rgba(${mode.text.secondary}, 1)`
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.5)`;
                              e.currentTarget.style.backgroundColor = `rgba(${mode.background.tertiary}, 0.5)`;
                              e.currentTarget.style.color = `rgba(${mode.text.primary}, 1)`;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.3)`;
                              e.currentTarget.style.backgroundColor = `rgba(${mode.background.secondary}, 0.3)`;
                              e.currentTarget.style.color = `rgba(${mode.text.secondary}, 1)`;
                            }}
                          >
                            <RotateCcw
                              className="h-4 w-4 mr-2"
                              style={{
                                color: `rgba(${theme.primary}, 1)`
                              }}
                            />
                            Reset to Default
                          </Button>
                        </div> */}
                      </div>
                    </SheetContent>
                  </Sheet>

                  {/* User Profile Sidebar Trigger - Premium Style */}
                  <Sheet
                    open={profileSidebarOpen}
                    onOpenChange={setProfileSidebarOpen}
                  >
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-8 px-3 backdrop-blur-sm transition-all duration-300"
                        style={{
                          backgroundColor:
                            currentMode === "light"
                              ? `rgba(${mode.background.tertiary}, 1)`
                              : `rgba(${mode.background.secondary}, 0.5)`,
                          borderColor: `rgba(${theme.primary}, ${
                            currentMode === "light" ? "0.3" : "0.2"
                          })`,
                          color: `rgba(${mode.text.muted}, 1)`,
                          boxShadow:
                            currentMode === "light"
                              ? "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
                              : "none",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.4)`;
                          e.currentTarget.style.backgroundColor = `rgba(${theme.primary}, 0.1)`;
                          e.currentTarget.style.color = `rgba(${mode.text.primary}, 1)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.2)`;
                          e.currentTarget.style.backgroundColor = `rgba(${mode.background.secondary}, 0.5)`;
                          e.currentTarget.style.color = `rgba(${mode.text.muted}, 1)`;
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {avatarSrc ? (
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={avatarSrc} alt={displayName} />
                              <AvatarFallback className="bg-gradient-to-br from-violet-600 to-purple-600 text-white text-xs font-bold">
                                {avatarFallback}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                              {avatarFallback}
                            </div>
                          )}
                          <span
                            className="hidden sm:block text-sm font-medium truncate max-w-[120px]"
                            title={displayName}
                          >
                            {displayName}
                          </span>
                        </div>
                      </Button>
                    </SheetTrigger>

                    {/* Profile Sidebar Content */}
                    <SheetContent
                      side="right"
                      className="w-96bg-white p-0 border-l"
                      // style={{
                      //   background:
                      //     currentMode === "dark"
                      //       ? `linear-gradient(135deg, rgba(${mode.background.primary}, 0.95), rgba(${mode.background.secondary}, 0.9), rgba(${mode.background.primary}, 0.95))`
                      //       : `linear-gradient(135deg, rgba(${mode.background.primary}, 1), rgba(${mode.background.secondary}, 1))`,
                      //   borderColor: `rgba(${theme.primary}, ${currentMode === "dark" ? "0.3" : "0.2"
                      //     })`,
                      // }}
                    >
                      {/* Premium Background Effects */}
                      {/* <div
                        className="absolute inset-0"
                        style={{
                          background: `radial-gradient(circle at 70% 30%, rgba(${theme.primary}, 0.1), transparent)`,
                        }}
                      ></div>
                      <div
                        className="absolute inset-0"
                        style={{
                          background: `radial-gradient(circle at 30% 70%, rgba(${theme.accent}, 0.08), transparent)`,
                        }}
                      ></div>
                      <div
                        className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px]"
                        style={{
                          opacity: currentMode === "dark" ? 1 : 0.3,
                        }}
                      ></div> */}

                      <div className="relative h-full flex flex-col">
                        {/* Header */}
                        <SheetHeader
                          className="p-6 border-b flex-shrink-0"
                          style={{
                            borderColor: `rgba(${theme.primary}, ${
                              currentMode === "dark" ? "0.2" : "0.15"
                            })`,
                          }}
                        >
                          <div className="flex items-center gap-4">
                            {avatarSrc ? (
                              <Avatar
                                className="h-16 w-16"
                                style={{
                                  border: `2px solid rgba(${theme.primary}, 0.3)`,
                                }}
                              >
                                <AvatarImage
                                  src={avatarSrc}
                                  alt={displayName}
                                />
                                <AvatarFallback
                                  className="text-white text-xl font-bold"
                                  style={{
                                    background: `linear-gradient(135deg, rgba(${theme.primary}, 1), rgba(${theme.primaryDark}, 1))`,
                                  }}
                                >
                                  {avatarFallback}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <div
                                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold"
                                style={{
                                  background: `linear-gradient(135deg, rgba(${theme.primary}, 1), rgba(${theme.primaryDark}, 1))`,
                                  border: `2px solid rgba(${theme.primary}, 0.3)`,
                                }}
                              >
                                {avatarFallback}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <SheetTitle
                                className="text-lg font-semibold truncate max-w-full"
                                style={{
                                  color: `rgba(${mode.text.primary}, 1)`,
                                }}
                                title={displayName}
                              >
                                {displayName}
                              </SheetTitle>

                              <div className="">
                                <span
                                  className="inline-flex items-center  mt-[2px] text-sm font-medium"
                                  // style={{
                                  //   backgroundColor: `rgba(${theme.primary}, 0.2)`,
                                  //   color: `rgba(${theme.primary}, 1)`,
                                  //   borderColor: `rgba(${theme.primary}, 0.2)`,
                                  // }}
                                >
                                  {userRole === "advertiser"
                                    ? "Advertiser"
                                    : userRole === "creator"
                                    ? "Creator"
                                    : "Admin"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <SheetDescription className="sr-only">
                            User profile and navigation menu
                          </SheetDescription>
                        </SheetHeader>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto sidebar-scrollbar">
                          <div className="px-6 py-3 flex gap-4 items-center ">
                            <div className="bg-[#D8C3FF] text-purple-600 rounded-full p-3">
                            <Mail className="w-5 h-5"/>
                            </div>
                          <p
                            className="text-md truncate max-w-full"
                            style={{
                              color: `rgba(${mode.text.secondary}, 1)`,
                            }}
                            title={displayEmail}
                          >
                            {displayEmail}
                          </p>
                          </div>
                          {/* Content - Unique Information Instead of Duplicate Navigation */}
                          <div className="pl-4 py-6 space-y-6">
                            {/* Account Plan Section - Only for Advertisers */}
                            {userRole === "advertiser" && (
                              <div className="space-y-3">
                                <h3
                                  className="text-sm font-semibold uppercase tracking-wider"
                                  style={{
                                    color: `rgba(${mode.text.muted}, 1)`,
                                  }}
                                >
                                  Current Plan
                                </h3>
                         
                                <div
                               className="flex justify-between items-center border border-[#7F39EC] rounded-lg bg-[#D9C0FF26] px-4 py-3"
                                  // style={{
                                  //   background: `linear-gradient(135deg, rgba(${theme.primary}, 0.2), rgba(${theme.primaryDark}, 0.2))`,
                                  //   borderColor: `rgba(${theme.primary}, 0.3)`,
                                  // }}
                                >
                                  <div className="flex items-center justify-between">
                                  <div
                                     className="flex bg-[#D8C3FF] text-purple-600 rounded-full p-3 items-center mr-2"
                                      // style={{
                                      //   backgroundColor: `rgba(${theme.primary}, 0.3)`,
                                      // }}
                                    >
                                      
                                      <Trophy className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <div>
                                      <div
                                        className="font-semibold"
                                        style={{
                                          color: `rgba(${mode.text.primary}, 1)`,
                                        }}
                                      >
                                        {currentPlan.name} Plan
                                      </div>
                                      <div
                                        className="text-xs"
                                        style={{
                                          color: `rgba(${theme.primary}, 1)`,
                                        }}
                                      >
                                        {currentPlan.price === 0
                                          ? "Basic features included"
                                          : `$${(
                                              currentPlan.price / 100
                                            ).toFixed(2)}/month`}
                                      </div>
                                    </div>
                                   
                                  </div>
                                  {currentPlan.name !== "CHAMPION" && (
                                    <Link
                                      href="/dashboard/billing"
                                      onClick={() =>
                                        setProfileSidebarOpen(false)
                                      }
                                      className="bg-[#6C43D0] text-white text-xs px-3 py-2 rounded-xl transition"
                                      // style={{
                                      //   color: `rgba(${theme.primary}, 1)`,
                                      // }}
                                      // onMouseEnter={(e) => {
                                      //   e.currentTarget.style.color = `rgba(${mode.text.primary}, 1)`;
                                      // }}
                                      // onMouseLeave={(e) => {
                                      //   e.currentTarget.style.color = `rgba(${theme.primary}, 1)`;
                                      // }}
                                    >
                                      Upgrade Plan
                                      {/* <ChevronRight className="h-3 w-3" /> */}
                                    </Link>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Quick Actions */}
                            <div className="space-y-3">
                              <h3
                                className="text-sm font-semibold uppercase tracking-wider"
                                style={{
                                  color: `rgba(${mode.text.muted}, 1)`,
                                }}
                              >
                                Quick Actions
                              </h3>
                              <div className="space-y-4">
                                <Link
                                  href="/dashboard/profile"
                                  onClick={() => setProfileSidebarOpen(false)}
                                  className="flex justify-between items-center border border-[#7F39EC] rounded-lg bg-[#D9C0FF26] px-4 py-3"
                                  // style={{
                                  //   backgroundColor: `rgba(${mode.background.secondary}, 0.3)`,
                                  //   borderColor: `rgba(${theme.primary}, 0.2)`,
                                  //   color: `rgba(${mode.text.secondary}, 1)`,
                                  // }}
                                  // onMouseEnter={(e) => {
                                  //   e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.4)`;
                                  //   e.currentTarget.style.backgroundColor = `rgba(${theme.primary}, 0.1)`;
                                  //   e.currentTarget.style.color = `rgba(${mode.text.primary}, 1)`;
                                  // }}
                                  // onMouseLeave={(e) => {
                                  //   e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.2)`;
                                  //   e.currentTarget.style.backgroundColor = `rgba(${mode.background.secondary}, 0.3)`;
                                  //   e.currentTarget.style.color = `rgba(${mode.text.secondary}, 1)`;
                                  // }}
                                >
                                  <div
                                    // className="w-8 h-8 rounded-lg flex items-center justify-center group-hover:opacity-80 transition-colors"
                                    // style={{
                                    //   backgroundColor: `rgba(${theme.primary}, 0.2)`,
                                    // }}
                                     className="flex bg-[#D8C3FF] text-purple-600 rounded-full p-3 items-center mr-2"
                                  >
                                    <User
                                      className="h-5 w-5"
                                      // style={{
                                      //   color: `rgba(${theme.primary}, 1)`,
                                      // }}
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-medium text-md">
                                      Edit Profile
                                    </div>
                                  </div>
                                  <ChevronRight
                                    className="h-3 w-3 text-purple-600 transition-all group-hover:translate-x-0.5"
                                    // style={{
                                    //   color: `rgba(${mode.text.muted}, 1)`,
                                    // }}
                                  />
                                </Link>
                                <button
                                  onClick={() => {
                                    setProfileSidebarOpen(false);
                                    setSettingsPanelOpen(true);
                                  }}
                                     className="w-full flex justify-between items-center border border-[#7F39EC] rounded-lg bg-[#D9C0FF26] px-4 py-3"
                                  // style={{
                                  //   backgroundColor: `rgba(${mode.background.secondary}, 0.3)`,
                                  //   borderColor: `rgba(${theme.primary}, 0.2)`,
                                  //   color: `rgba(${mode.text.secondary}, 1)`,
                                  // }}
                                  // onMouseEnter={(e) => {
                                  //   e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.4)`;
                                  //   e.currentTarget.style.backgroundColor = `rgba(${theme.primary}, 0.1)`;
                                  //   e.currentTarget.style.color = `rgba(${mode.text.primary}, 1)`;
                                  // }}
                                  // onMouseLeave={(e) => {
                                  //   e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.2)`;
                                  //   e.currentTarget.style.backgroundColor = `rgba(${mode.background.secondary}, 0.3)`;
                                  //   e.currentTarget.style.color = `rgba(${mode.text.secondary}, 1)`;
                                  // }}
                                >
                                  <div
                                    className="flex bg-[#D8C3FF] text-purple-600 rounded-full p-3 items-center mr-2"
                                    // style={{
                                    //   backgroundColor: `rgba(${theme.primary}, 0.2)`,
                                    // }}
                                  >
                                    <Settings
                                      className="h-5 w-5"
                                      // style={{
                                      //   color: `rgba(${theme.primary}, 1)`,
                                      // }}
                                    />
                                  </div>
                                  <div className="flex-1 text-left">
                                    <div className="font-medium text-sm">
                                      Dashboard Customization
                                    </div>
                                  </div>
                                  <ChevronRight
                                    className="h-3 w-3 text-purple-600 transition-all group-hover:translate-x-0.5"
                                    // style={{
                                    //   color: `rgba(${mode.text.muted}, 1)`,
                                    // }}
                                  />
                                </button>
                              </div>
                            </div>

                            {/* Account Status */}
                            <div className="space-y-3">
                              <h3
                                className="text-sm font-semibold uppercase tracking-wider"
                                style={{
                                  color: `rgba(${mode.text.muted}, 1)`,
                                }}
                              >
                                Account Status
                              </h3>
                              <div
                                className="p-3 rounded-lg border"
                                style={{
                                  backgroundColor: `rgba(${mode.background.secondary}, 0.3)`,
                                  borderColor: profileData.isActive
                                    ? "rgba(34, 197, 94, 0.2)"
                                    : "rgba(244, 63, 94, 0.2)",
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{
                                      backgroundColor: profileData.isActive
                                        ? "rgba(11, 163, 67, 0.7)"
                                        : "rgb(244, 63, 94)",
                                    }}
                                  ></div>
                                  <span
                                    className="text-md font-medium"
                                    style={{
                                      color: profileData.isActive
                                        ? "rgba(11, 163, 67, 0.7)"
                                        : "rgb(251, 113, 133)",
                                    }}
                                  >
                                    {profileData.isActive
                                      ? "Active"
                                      : "Inactive"}
                                  </span>
                                </div>
                                <p
                                  className="text-sm mt-1"
                                  style={{
                                    color: profileData.isActive
                                      ? "rgba(11, 163, 67, 0.7)"
                                      : "rgba(244, 63, 94, 0.7)",
                                  }}
                                >
                                  {profileData.isActive
                                    ? "Your account is active and fully functional"
                                    : "Your account is currently inactive"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Footer - Sign Out */}
                        <div
                          className="p-6 border-t flex-shrink-0"
                          style={{
                            borderColor: `rgba(${theme.primary}, ${
                              currentMode === "dark" ? "0.2" : "0.15"
                            })`,
                          }}
                        >
                          <Button
                            onClick={handleSignOut}
                            variant="ghost"
                            className="w-full border-[#E50000] bg-[#A8000014] text-black justify-start gap-3 p-3 h-auto border transition-all duration-300"
                            // style={{
                            //   backgroundColor: "rgba(244, 63, 94, 0.2)",
                            //   borderColor: "rgba(244, 63, 94, 0.2)",
                            //   color: "rgb(251, 113, 133)",
                            // }}
                            // onMouseEnter={(e) => {
                            //   e.currentTarget.style.borderColor =
                            //     "rgba(244, 63, 94, 0.4)";
                            //   e.currentTarget.style.backgroundColor =
                            //     "rgba(244, 63, 94, 0.1)";
                            //   e.currentTarget.style.color =
                            //     "rgb(248, 113, 113)";
                            // }}
                            // onMouseLeave={(e) => {
                            //   e.currentTarget.style.borderColor =
                            //     "rgba(244, 63, 94, 0.2)";
                            //   e.currentTarget.style.backgroundColor =
                            //     "rgba(244, 63, 94, 0.2)";
                            //   e.currentTarget.style.color =
                            //     "rgb(251, 113, 133)";
                            // }}
                          >
                            <div
                              className="w-10 h-10 bg-[#FF323224] rounded-lg flex items-center justify-center"
                              // style={{
                              //   backgroundColor: "rgba(244, 63, 94, 0.2)",
                              // }}
                            >
                              <LogOut
                                className="h-5 w-5"
                                style={{
                                  color: "rgb(244, 63, 94)",
                                }}
                              />
                            </div>
                            <div className="flex-1 text-left">
                              <div className="text-md font-semibold">Sign Out</div>
                              <div
                                className="text-xs text-black"
                                // style={{
                                //   color: "rgba(244, 63, 94, 0.8)",
                                // }}
                              >
                                End your session
                              </div>
                            </div>
                          </Button>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 dashboard-main-content">
            <div className="p-6 md:p-8">
              <Suspense fallback={<LoadingPlaceholder />}>{children}</Suspense>

              {/* Chat Popup */}
              {isChatOpen && (
                <ChatSuppport
                  onClose={() => setIsChatOpen(false)}
                  email={displayEmail}
                  userType={userRole as any}
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default DashboardContent;
