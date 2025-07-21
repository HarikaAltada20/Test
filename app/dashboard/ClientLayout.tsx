"use client";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import type { UserResponse } from "@supabase/supabase-js";
import { Suspense, useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Menu, X, Settings, User, LogOut, ChevronRight, Moon, Sun, Contrast, RotateCcw, Maximize2, CreditCard, Maximize, Minimize } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { useClientAuth } from "@/hooks/use-client-auth";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { subscriptionPlans } from "@/constants/subscriptionPlans";
import Link from "next/link";
import Image from "next/image";
import logo from "@/public/images/gold_logo_horizontal.svg";
import squareLogo from "@/public/images/goc_square.png";

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
  )
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
    fullName: '',
    profilePictureUrl: '',
    isActive: true,
    subscriptionPlan: null,
  });
  const [hasProcessedSuccess, setHasProcessedSuccess] = useState(false);

  const userRole = user?.user_type as "advertiser" | "creator" | "admin" || null;
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileSidebarOpen, setProfileSidebarOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>('clean');
  const [currentMode, setCurrentMode] = useState<ModeKey>('light');
  const [currentPreset, setCurrentPreset] = useState<PresetKey>('clean-professional');
  const [isColorfulMode, setIsColorfulMode] = useState(false);
  const { logout } = useClientAuth();
  const { isFullscreen, isSupported: isFullscreenSupported, isClient: isFullscreenClient, toggleFullscreen } = useFullscreen();

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
    const success = searchParams.get('success');
    const sessionId = searchParams.get('session_id');

    if (success === 'true' && sessionId && user && !hasProcessedSuccess) {
      console.log('🎉 Payment successful in dashboard, refreshing subscription data...');
      setHasProcessedSuccess(true);

      // Clear URL parameters to prevent refresh loops
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);

      // Refresh subscription data after a short delay to allow webhook processing
      const refreshSubscriptionData = async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 2000));

          const supabase = createClient();
          const { data: advertiserProfile } = await supabase
            .from('advertiser_profiles')
            .select('subscription_info')
            .eq('id', user.id)
            .single();

          if (advertiserProfile?.subscription_info?.product_id) {
            setProfileData(prev => ({
              ...prev,
              subscriptionPlan: advertiserProfile.subscription_info.product_id
            }));
            console.log('✅ Subscription data refreshed:', advertiserProfile.subscription_info.product_id);
          }
        } catch (error) {
          console.error('Error refreshing subscription data:', error);
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
        .from('users')
        .select('full_name, profile_picture_url, is_active, user_type')
        .eq('id', user.id)
        .single();

      if (profile) {
        let subscriptionPlan: string | null = null;

        // Fetch subscription plan for advertisers
        if (profile.user_type === 'advertiser') {
          const { data: advertiserProfile } = await supabase
            .from('advertiser_profiles')
            .select('subscription_info')
            .eq('id', user.id)
            .single();

          subscriptionPlan = advertiserProfile?.subscription_info?.product_id || null;
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
  }, [user]);

  // Theme persistence and initialization
  useEffect(() => {
    const savedPreset = localStorage.getItem('dashboard-preset') as PresetKey;
    if (savedPreset && presetConfigurations[savedPreset]) {
      setCurrentPreset(savedPreset);
      setCurrentMode(presetConfigurations[savedPreset].mode);
      setCurrentTheme(presetConfigurations[savedPreset].theme);
    } else {
      // Fallback to individual settings or defaults
      const savedTheme = localStorage.getItem('dashboard-theme') as ThemeKey;
      if (savedTheme && colorThemes[savedTheme]) {
        setCurrentTheme(savedTheme);
      } else {
        setCurrentTheme('clean'); // Default to clean theme
      }

      const savedMode = localStorage.getItem('dashboard-mode') as ModeKey;
      if (savedMode && modeConfigurations[savedMode]) {
        setCurrentMode(savedMode);
      } else {
        setCurrentMode('light'); // Default to light mode
      }

      // Set default preset if no individual settings
      if (!savedTheme && !savedMode) {
        setCurrentPreset('clean-professional');
      }
    }

    const savedColorfulMode = localStorage.getItem('dashboard-colorful-mode');
    if (savedColorfulMode) {
      setIsColorfulMode(savedColorfulMode === 'true');
    }
  }, []);

  // Preset switching function
  const switchPreset = (presetKey: PresetKey) => {
    const preset = presetConfigurations[presetKey];
    setCurrentPreset(presetKey);
    setCurrentMode(preset.mode);
    setCurrentTheme(preset.theme);
    localStorage.setItem('dashboard-preset', presetKey);
    localStorage.removeItem('dashboard-theme'); // Clear individual settings
    localStorage.removeItem('dashboard-mode');
  };

  // Theme switching function
  const switchTheme = (themeKey: ThemeKey) => {
    setCurrentTheme(themeKey);
    localStorage.setItem('dashboard-theme', themeKey);
    localStorage.removeItem('dashboard-preset'); // Clear preset when manually changing
  };

  // Mode switching function
  const switchMode = (modeKey: ModeKey) => {
    setCurrentMode(modeKey);
    localStorage.setItem('dashboard-mode', modeKey);
    localStorage.removeItem('dashboard-preset'); // Clear preset when manually changing
  };

  const toggleColorfulMode = (enabled: boolean) => {
    setIsColorfulMode(enabled);
    localStorage.setItem('dashboard-colorful-mode', String(enabled));
  };

  // Reset to default function
  const resetToDefault = () => {
    switchPreset('clean-professional');
  };

  // Get current theme and mode configurations
  const theme = colorThemes[currentTheme];
  const mode = modeConfigurations[currentMode];

  // Helper function to convert RGB to HSL for CSS custom properties
  const getThemeHSL = (themeKey: ThemeKey) => {
    switch (themeKey) {
      case 'purple':
        return '258.3 89.5% 66.3%'; // violet-500 in HSL
      case 'clean':
        return '215.4 16.3% 46.9%'; // slate-500 in HSL
      case 'blue':
        return '217.2 91.2% 59.8%'; // blue-500 in HSL
      case 'green':
        return '142.1 76.2% 36.3%'; // green-500 in HSL
      case 'rose':
        return '349.7 89.2% 60.2%'; // rose-500 in HSL
      default:
        return '258.3 89.5% 66.3%';
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
    const segments = path.split('/').filter(Boolean);
    if (segments.length > 1) {
      return segments[segments.length - 1].charAt(0).toUpperCase() +
        segments[segments.length - 1].slice(1);
    }
    return "Overview";
  };

  const currentPageTitle = getPageTitle(pathname);

  // Get user display info
  const displayName = profileData.fullName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User";
  const displayEmail = user?.email || "";
  const avatarSrc = profileData.profilePictureUrl || user?.user_metadata?.profile_picture_url || "";
  const avatarFallback = displayName.charAt(0).toUpperCase();

  // Get subscription plan details
  const getCurrentPlan = () => {
    if (!profileData.subscriptionPlan || userRole !== "advertiser") {
      return subscriptionPlans[0]; // Default to EXPLORER plan
    }
    return subscriptionPlans.find(plan => plan.id === profileData.subscriptionPlan) || subscriptionPlans[0];
  };

  const currentPlan = getCurrentPlan();

  return (
    <div className="bg-background" data-theme={currentMode} data-color-theme={currentTheme}>
      <SimpleLoadingBar />

      {/* Dynamic CSS Custom Properties for Theme */}
      <style jsx global>{`
        :root {
          --background: ${currentMode === 'light' ? '210 20% 98%' : '222.2 84% 4.9%'};
          --foreground: ${currentMode === 'light' ? '220 13% 9%' : '210 40% 98%'};
          --card: ${currentMode === 'light' ? '0 0% 96%' : '217.2 32.6% 17.5%'};
          --card-foreground: ${currentMode === 'light' ? '220 13% 9%' : '210 40% 98%'};
          --popover: ${currentMode === 'light' ? '0 0% 96%' : '217.2 32.6% 17.5%'};
          --popover-foreground: ${currentMode === 'light' ? '220 13% 9%' : '210 40% 98%'};
          --primary: ${getThemeHSL(currentTheme)};
          --primary-foreground: ${currentMode === 'light' ? '0 0% 100%' : '222.2 84% 4.9%'};
          --secondary: ${currentMode === 'light' ? '220 14% 96%' : '217.2 32.6% 17.5%'};
          --secondary-foreground: ${currentMode === 'light' ? '220 9% 46%' : '210 40% 98%'};
          --muted: ${currentMode === 'light' ? '220 13% 91%' : '217.2 32.6% 17.5%'};
          --muted-foreground: ${currentMode === 'light' ? '220 9% 46%' : '215 20.2% 75.1%'};
          --accent: ${currentMode === 'light' ? '220 13% 91%' : '217.2 32.6% 17.5%'};
          --accent-foreground: ${currentMode === 'light' ? '220 13% 9%' : '210 40% 98%'};
          --border: ${currentMode === 'light' ? '220 13% 82%' : '217.2 32.6% 17.5%'};
          --input: ${currentMode === 'light' ? '220 13% 82%' : '217.2 32.6% 17.5%'};
          --ring: ${getThemeHSL(currentTheme)};
        }
      `}</style>

      {/* Global Theme-Based Scrollbar Styles */}
      <style jsx global>{`
        /* Theme-based scrollbar for all elements */
        * {
          scrollbar-width: thin;
          scrollbar-color: ${theme.scrollbar} rgba(${mode.background.secondary}, 0.1);
        }
        
        /* Global text improvements for better readability */
        h1, h2, h3, h4, h5, h6 {
          color: hsl(var(--foreground)) !important;
        }
        
        p, span, div, label {
          color: hsl(var(--foreground)) !important;
        }
        
        .text-muted-foreground {
          color: hsl(var(--muted-foreground)) !important;
        }
        
        /* Force all text to be visible */
        * {
          color: hsl(var(--foreground)) !important;
        }
        
        /* Override specific muted text */
        .text-muted-foreground,
        .text-slate-400,
        .text-slate-500,
        .text-slate-600,
        .text-gray-400,
        .text-gray-500,
        .text-gray-600 {
          color: hsl(var(--muted-foreground)) !important;
        }
        
        /* Form elements global styling */
        input, textarea, select {
          background-color: hsl(var(--background)) !important;
          border-color: hsl(var(--border)) !important;
          color: hsl(var(--foreground)) !important;
        }
        
        /* Card global styling */
        .card {
          background-color: hsl(var(--card)) !important;
          color: hsl(var(--card-foreground)) !important;
          border-color: hsl(var(--border)) !important;
        }
        
        /* Ensure all divs and containers use proper backgrounds */
        div[class*="bg-white"],
        div[class*="bg-gray"],
        div[class*="bg-slate"] {
          background-color: hsl(var(--card)) !important;
          color: hsl(var(--card-foreground)) !important;
        }
        
        /* Webkit scrollbar styling */
        *::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        *::-webkit-scrollbar-track {
          background: rgba(${mode.background.secondary}, ${currentMode === 'light' ? '0.5' : '0.1'});
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
        
        /* Global background and text colors */
        body {
          background-color: rgba(${mode.background.primary}, 1) !important;
          color: rgba(${mode.text.primary}, 1) !important;
        }
        
        /* Main content area styling */
        .dashboard-main-content {
          background-color: rgba(${mode.background.primary}, 1);
          color: rgba(${mode.text.primary}, 1);
        }
        
        /* Card and panel styling */
        .dashboard-card {
          background-color: rgba(${mode.background.secondary}, ${currentMode === 'light' ? '1' : '0.5'});
          border-color: rgba(${mode.border}, ${currentMode === 'light' ? '1' : '0.2'});
          color: rgba(${mode.text.primary}, 1);
          box-shadow: ${currentMode === 'light' ? '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' : 'none'};
        }
        
        /* Enhanced styling for both modes */
        
        /* Light mode specific improvements */
        ${currentMode === 'light' && !isColorfulMode ? `
          /* Enhanced card shadows and backgrounds for better depth */
          [data-theme="light"] .card,
          [data-theme="light"] [data-card],
          [data-theme="light"] div[class*="rounded-"],
          [data-theme="light"] div[class*="border"] {
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
            background: linear-gradient(135deg, rgba(${mode.background.secondary}, 1) 0%, rgba(${mode.background.primary}, 1) 100%) !important;
            border: 1px solid rgba(${mode.border}, 0.8) !important;
          }
          
          /* Enhanced button styling */
          [data-theme="light"] button,
          [data-theme="light"] .btn {
            box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1);
            background: linear-gradient(135deg, rgba(${mode.background.secondary}, 1) 0%, rgba(${mode.background.primary}, 1) 100%);
            border: 1px solid rgba(${mode.border}, 0.6);
            transition: all 0.2s ease;
          }
          
          [data-theme="light"] button:hover,
          [data-theme="light"] .btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.15);
          }
          
          /* Enhanced sidebar styling */
          [data-theme="light"] .sidebar-container {
            background: linear-gradient(180deg, rgba(${mode.background.primary}, 1) 0%, rgba(${mode.background.secondary}, 1) 100%);
            border-right: 1px solid rgba(${mode.border}, 0.8);
            box-shadow: 2px 0 8px rgba(0, 0, 0, 0.08);
          }
          
          /* Enhanced main content area */
          [data-theme="light"] .dashboard-main-content {
            background: linear-gradient(135deg, rgba(${mode.background.primary}, 1) 0%, rgba(${mode.background.secondary}, 0.3) 100%);
          }
          
          /* Improved navigation items */
          [data-theme="light"] .nav-item {
            transition: all 0.2s ease;
            border-radius: 8px;
            margin: 2px 0;
          }
          
          [data-theme="light"] .nav-item:hover {
            background: linear-gradient(135deg, rgba(${mode.background.tertiary}, 0.8) 0%, rgba(${mode.background.secondary}, 0.8) 100%);
            transform: translateX(2px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          
          /* Fix sidebar text in light mode */
          [data-theme="light"] .sidebar-content,
          [data-theme="light"] .sidebar-content *,
          [data-theme="light"] nav,
          [data-theme="light"] nav *,
          [data-theme="light"] aside,
          [data-theme="light"] aside * {
            color: rgba(${mode.text.primary}, 1) !important;
          }
          
          /* Fix navigation text specifically */
          [data-theme="light"] .navigation-item,
          [data-theme="light"] .nav-link,
          [data-theme="light"] .sidebar-link {
            color: rgba(${mode.text.primary}, 1) !important;
          }
          
          /* Fix muted text in light mode */
          [data-theme="light"] .text-muted-foreground,
          [data-theme="light"] .text-slate-300,
          [data-theme="light"] .text-slate-400,
          [data-theme="light"] .text-slate-500 {
            color: rgba(${mode.text.muted}, 1) !important;
          }
          
          /* Ensure all text is dark in light mode */
          [data-theme="light"] *,
          [data-theme="light"] h1,
          [data-theme="light"] h2,
          [data-theme="light"] h3,
          [data-theme="light"] h4,
          [data-theme="light"] h5,
          [data-theme="light"] h6,
          [data-theme="light"] p,
          [data-theme="light"] span,
          [data-theme="light"] div,
          [data-theme="light"] label,
          [data-theme="light"] td,
          [data-theme="light"] th,
          [data-theme="light"] li {
            color: rgba(${mode.text.primary}, 1) !important;
          }
          
          /* Form elements in light mode */
          [data-theme="light"] input,
          [data-theme="light"] textarea,
          [data-theme="light"] select {
            background-color: rgba(${mode.background.primary}, 1) !important;
            border-color: rgba(${mode.border}, 1) !important;
            color: rgba(${mode.text.primary}, 1) !important;
          }
          
          /* Fix card backgrounds in light mode */
          [data-theme="light"] .card,
          [data-theme="light"] .card-content,
          [data-theme="light"] .card-header {
            background-color: rgba(${mode.background.secondary}, 1) !important;
            color: rgba(${mode.text.primary}, 1) !important;
          }
          
          /* Fix table styling in light mode */
          [data-theme="light"] table,
          [data-theme="light"] thead,
          [data-theme="light"] tbody,
          [data-theme="light"] tr,
          [data-theme="light"] td,
          [data-theme="light"] th {
            background-color: rgba(${mode.background.primary}, 1) !important;
            color: rgba(${mode.text.primary}, 1) !important;
          }
          
          /* Fix prose content in light mode */
          [data-theme="light"] .prose,
          [data-theme="light"] .prose *,
          [data-theme="light"] .prose-sm,
          [data-theme="light"] .prose-sm * {
            color: rgba(${mode.text.primary}, 1) !important;
          }
        ` : ''}
        
        /* Dark mode specific improvements */
        ${currentMode === 'dark' ? `
          /* Force all text to be visible in dark mode */
          [data-theme="dark"] *,
          [data-theme="dark"] h1,
          [data-theme="dark"] h2,
          [data-theme="dark"] h3,
          [data-theme="dark"] h4,
          [data-theme="dark"] h5,
          [data-theme="dark"] h6,
          [data-theme="dark"] p,
          [data-theme="dark"] span,
          [data-theme="dark"] div,
          [data-theme="dark"] label,
          [data-theme="dark"] td,
          [data-theme="dark"] th,
          [data-theme="dark"] li {
            color: rgba(${mode.text.primary}, 1) !important;
          }
          
          /* Better text contrast in dark mode */
          [data-theme="dark"] .card,
          [data-theme="dark"] .card *,
          [data-theme="dark"] div[class*="bg-"],
          [data-theme="dark"] div[class*="bg-"] * {
            color: rgba(${mode.text.primary}, 1) !important;
            background-color: rgba(${mode.background.secondary}, 1) !important;
          }
          
          /* Form elements in dark mode */
          [data-theme="dark"] input,
          [data-theme="dark"] textarea,
          [data-theme="dark"] select,
          [data-theme="dark"] .input {
            background-color: rgba(${mode.background.secondary}, 1) !important;
            border-color: rgba(${mode.border}, 1) !important;
            color: rgba(${mode.text.primary}, 1) !important;
          }
          
          /* Better muted text in dark mode */
          [data-theme="dark"] .text-muted-foreground,
          [data-theme="dark"] .text-slate-400,
          [data-theme="dark"] .text-slate-500,
          [data-theme="dark"] .text-gray-400,
          [data-theme="dark"] .text-gray-500 {
            color: rgba(${mode.text.secondary}, 1) !important;
          }
          
          /* Contest page specific improvements */
          [data-theme="dark"] .contest-details,
          [data-theme="dark"] .contest-card,
          [data-theme="dark"] .contest-info {
            background-color: rgba(${mode.background.secondary}, 1) !important;
            color: rgba(${mode.text.primary}, 1) !important;
          }
          
          /* Table and list improvements */
          [data-theme="dark"] table,
          [data-theme="dark"] table *,
          [data-theme="dark"] .table,
          [data-theme="dark"] .table *,
          [data-theme="dark"] tbody,
          [data-theme="dark"] tbody *,
          [data-theme="dark"] tr,
          [data-theme="dark"] tr *,
          [data-theme="dark"] td,
          [data-theme="dark"] th {
            color: rgba(${mode.text.primary}, 1) !important;
            background-color: rgba(${mode.background.secondary}, 1) !important;
          }
          
          /* Button text improvements */
          [data-theme="dark"] .btn,
          [data-theme="dark"] button {
            color: rgba(${mode.text.primary}, 1) !important;
          }
          
          /* Fix white/light backgrounds in dark mode */
          [data-theme="dark"] div[class*="bg-white"],
          [data-theme="dark"] div[class*="bg-gray-50"],
          [data-theme="dark"] div[class*="bg-gray-100"],
          [data-theme="dark"] div[class*="bg-slate-50"],
          [data-theme="dark"] div[class*="bg-slate-100"] {
            background-color: rgba(${mode.background.secondary}, 1) !important;
            color: rgba(${mode.text.primary}, 1) !important;
          }
          
          /* Specific contest page fixes */
          [data-theme="dark"] .contest-brief,
          [data-theme="dark"] .contest-description,
          [data-theme="dark"] .contest-content {
            background-color: rgba(${mode.background.secondary}, 1) !important;
            color: rgba(${mode.text.primary}, 1) !important;
          }
          
          /* Fix gray backgrounds in dark mode */
          [data-theme="dark"] .bg-gray-50,
          [data-theme="dark"] .bg-gray-100,
          [data-theme="dark"] .bg-slate-50,
          [data-theme="dark"] .bg-slate-100,
          [data-theme="dark"] div[class*="bg-gray-"],
          [data-theme="dark"] div[class*="bg-slate-"] {
            background-color: rgba(${mode.background.secondary}, 1) !important;
            color: rgba(${mode.text.primary}, 1) !important;
          }
          
          /* Fix prose content in dark mode */
          [data-theme="dark"] .prose,
          [data-theme="dark"] .prose *,
          [data-theme="dark"] .prose-sm,
          [data-theme="dark"] .prose-sm * {
            color: rgba(${mode.text.primary}, 1) !important;
          }
          
          /* Fix table headers and rows */
          [data-theme="dark"] .table-header,
          [data-theme="dark"] .table-row,
          [data-theme="dark"] thead tr,
          [data-theme="dark"] tbody tr {
            background-color: rgba(${mode.background.secondary}, 1) !important;
          }
          
          /* Fix card gradients and backgrounds */
          [data-theme="dark"] div[class*="from-"],
          [data-theme="dark"] div[class*="to-"],
          [data-theme="dark"] div[class*="gradient"] {
            background: rgba(${mode.background.secondary}, 1) !important;
            color: rgba(${mode.text.primary}, 1) !important;
          }
        ` : ''}
        
        /* Text color classes */
        .text-primary-mode {
          color: rgba(${mode.text.primary}, 1) !important;
        }
        
        .text-secondary-mode {
          color: rgba(${mode.text.secondary}, 1) !important;
        }
        
        .text-muted-mode {
          color: rgba(${mode.text.muted}, 1) !important;
        }
        
        /* Background color classes */
        .bg-primary-mode {
          background-color: rgba(${mode.background.primary}, 1) !important;
        }
        
        .bg-secondary-mode {
          background-color: rgba(${mode.background.secondary}, 1) !important;
        }
        
        .bg-tertiary-mode {
          background-color: rgba(${mode.background.tertiary}, 1) !important;
        }
        
        /* Border color classes */
        .border-mode {
          border-color: rgba(${mode.border}, 0.2) !important;
        }
        
        .border-theme {
          border-color: rgba(${theme.primary}, 0.2) !important;
        }
        
        /* Additional fixes for common UI components */
        
        /* Badge and status components */
        .badge, .status, .chip {
          background-color: hsl(var(--secondary)) !important;
          color: hsl(var(--secondary-foreground)) !important;
        }
        
        /* Dropdown and select components */
        .dropdown-content,
        .select-content,
        .popover-content {
          background-color: hsl(var(--popover)) !important;
          color: hsl(var(--popover-foreground)) !important;
          border-color: hsl(var(--border)) !important;
        }
        
        /* Toast and notification components */
        .toast,
        .notification,
        .alert {
          background-color: hsl(var(--card)) !important;
          color: hsl(var(--card-foreground)) !important;
          border-color: hsl(var(--border)) !important;
        }
        
        /* Modal and dialog components */
        .modal,
        .dialog,
        .sheet {
          background-color: hsl(var(--background)) !important;
          color: hsl(var(--foreground)) !important;
        }
        
        /* Tabs and navigation components */
        .tabs,
        .nav-tabs,
        .tab-content {
          background-color: hsl(var(--background)) !important;
          color: hsl(var(--foreground)) !important;
        }
        
        /* Progress and loading components */
        .progress,
        .loading,
        .skeleton {
          background-color: hsl(var(--muted)) !important;
        }
        
        /* Fix for Radix UI components */
        [data-radix-popper-content-wrapper] {
          background-color: hsl(var(--popover)) !important;
          color: hsl(var(--popover-foreground)) !important;
        }
        
        /* Fix for any remaining white backgrounds */
        .bg-white {
          background-color: hsl(var(--background)) !important;
          color: hsl(var(--foreground)) !important;
        }
        
        /* Fix for contest-specific elements */
        .contest-thumbnail,
        .contest-details-panel,
        .contest-info-card {
          background-color: hsl(var(--card)) !important;
          color: hsl(var(--card-foreground)) !important;
        }
        
        /* Contest page specific fixes */
        .prose,
        .prose * {
          color: hsl(var(--foreground)) !important;
        }
        
        .prose-sm {
          color: hsl(var(--muted-foreground)) !important;
        }
        
        /* Table styling fixes */
        .table-container,
        table,
        thead,
        tbody,
        tr,
        td,
        th {
          background-color: hsl(var(--card)) !important;
          color: hsl(var(--card-foreground)) !important;
        }
        
        /* Card content fixes */
        .card-content,
        .card-header,
        .card-title {
          background-color: hsl(var(--card)) !important;
          color: hsl(var(--card-foreground)) !important;
        }
        
        /* Badge fixes */
        .badge {
          background-color: hsl(var(--primary)) !important;
          color: hsl(var(--primary-foreground)) !important;
        }
        
        /* Tab content fixes */
        .tabs-content,
        .tab-content {
          background-color: hsl(var(--background)) !important;
          color: hsl(var(--foreground)) !important;
        }
        
        /* Comprehensive text color fixes */
        .text-gray-900,
        .text-gray-800,
        .text-gray-700,
        .text-gray-600,
        .text-slate-900,
        .text-slate-800,
        .text-slate-700,
        .text-slate-600 {
          color: hsl(var(--foreground)) !important;
        }
        
        .text-gray-500,
        .text-gray-400,
        .text-slate-500,
        .text-slate-400,
        .text-slate-300 {
          color: hsl(var(--muted-foreground)) !important;
        }
        
        /* Background color fixes */
        .bg-gradient-to-r,
        .bg-gradient-to-br,
        .bg-gradient-to-l,
        .bg-gradient-to-t,
        .bg-gradient-to-b {
          background: hsl(var(--card)) !important;
          color: hsl(var(--card-foreground)) !important;
        }
        
        /* Specific component fixes */
        [role="tabpanel"],
        [role="tab"],
        [role="tablist"] {
          background-color: hsl(var(--background)) !important;
          color: hsl(var(--foreground)) !important;
        }
        
        /* Enhanced UX improvements */
        
        /* Better focus states */
        button:focus-visible,
        input:focus-visible,
        textarea:focus-visible,
        select:focus-visible {
          outline: 2px solid hsl(var(--primary)) !important;
          outline-offset: 2px !important;
        }
        
        /* Improved hover states */
        .card:hover {
          box-shadow: ${currentMode === 'light'
          ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          : '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
        } !important;
          transform: translateY(-1px) !important;
          transition: all 0.2s ease !important;
        }
        
        /* Better button styling */
        button {
          transition: all 0.2s ease !important;
        }
        
        button:hover {
          transform: translateY(-1px) !important;
          box-shadow: ${currentMode === 'light'
          ? '0 2px 4px -1px rgba(0, 0, 0, 0.1)'
          : '0 2px 4px -1px rgba(0, 0, 0, 0.3)'
        } !important;
        }
        
        /* Loading states */
        .loading {
          opacity: 0.7 !important;
          pointer-events: none !important;
        }
        
        /* Better spacing for content */
        .contest-content {
          line-height: 1.6 !important;
        }
        
        /* Improved readability */
        p, li, span {
          line-height: 1.5 !important;
        }
        
        h1, h2, h3, h4, h5, h6 {
          line-height: 1.3 !important;
          margin-bottom: 0.5em !important;
        }

      `}</style>

      {/* Main Layout Container */}
      <div className="flex min-h-screen dashboard-container">
        {/* Desktop Sidebar */}
        <aside className={cn(
          "hidden lg:flex flex-col backdrop-blur-sm border-r transition-all duration-300 ease-in-out fixed left-0 top-0 z-30",
          sidebarCollapsed ? "w-28" : "w-72"
        )} style={{
          background: currentMode === 'light'
            ? `linear-gradient(to bottom, rgba(${mode.background.secondary}, 1), rgba(${mode.background.tertiary}, 1), rgba(${mode.background.secondary}, 1))`
            : `linear-gradient(to bottom, rgba(${mode.background.primary}, 0.95), rgba(${mode.background.secondary}, 0.90), rgba(${mode.background.primary}, 0.95))`,
          borderRightColor: `rgba(${theme.primary}, ${currentMode === 'light' ? '0.3' : '0.2'})`,
          boxShadow: currentMode === 'light'
            ? `2px 0 8px 0 rgba(0, 0, 0, 0.1), inset -1px 0 0 0 rgba(${theme.primary}, 0.1)`
            : 'none'
        }}>
          {/* Sidebar Header - Premium Styling to Match Main Header */}
          <div className="relative flex h-20 items-center justify-center border-b" style={{ borderBottomColor: `rgba(${theme.primary}, 0.3)` }}>
            {/* Premium Background Effects - Same as Main Header */}
            <div className="absolute inset-0" style={{
              background: currentMode === 'light'
                ? `linear-gradient(to right, rgba(${mode.background.primary}, 1), rgba(${mode.background.secondary}, 1), rgba(${mode.background.primary}, 1))`
                : `linear-gradient(to right, rgba(${mode.background.primary}, 1), rgba(${mode.background.secondary}, 1), rgba(${mode.background.primary}, 1))`
            }}></div>
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 30% 50%, rgba(${theme.primary}, ${currentMode === 'light' ? '0.05' : '0.1'}), transparent)` }}></div>
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 70% 50%, rgba(${theme.accent}, ${currentMode === 'light' ? '0.03' : '0.08'}), transparent)` }}></div>

            {/* Premium Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px]"></div>

            {/* Logo - Centered and Full Width */}
            <div className="relative flex items-center justify-center flex-1 z-10">
              {!sidebarCollapsed ? (
                <Link href="/" className="flex items-center group transition-all duration-300">
                  <div
                    className={cn(
                      "relative p-3 rounded-lg transition-all duration-300",
                      currentMode === 'light'
                        ? "bg-gradient-to-br from-slate-100 to-white border border-slate-200 shadow-lg hover:shadow-xl"
                        : "hover:bg-white/5"
                    )}
                    style={{
                      ...(currentMode === 'light' && {
                        boxShadow: `0 4px 6px -1px rgba(${theme.primary}, 0.1), 0 2px 4px -1px rgba(${theme.primary}, 0.06)`
                      })
                    }}
                  >
                    <Image
                      src={logo}
                      alt="Game Of Creators Logo"
                      width={160}
                      height={40}
                      className={cn(
                        "h-10 w-auto transition-all duration-300",
                        currentMode === 'light'
                          ? "filter brightness-90 contrast-110 saturate-110 group-hover:brightness-75"
                          : "filter brightness-110 group-hover:brightness-125"
                      )}
                    />
                  </div>
                </Link>
              ) : (
                <Link href="/" className="flex items-center justify-center group transition-all duration-300">
                  <div
                    className={cn(
                      "relative p-2 rounded-lg transition-all duration-300",
                      currentMode === 'light'
                        ? "bg-gradient-to-br from-slate-100 to-white border border-slate-200 shadow-lg hover:shadow-xl"
                        : "hover:bg-white/5"
                    )}
                    style={{
                      ...(currentMode === 'light' && {
                        boxShadow: `0 4px 6px -1px rgba(${theme.primary}, 0.1), 0 2px 4px -1px rgba(${theme.primary}, 0.06)`
                      })
                    }}
                  >
                    <Image
                      src={squareLogo}
                      alt="Game Of Creators"
                      width={44}
                      height={44}
                      className={cn(
                        "h-11 w-11 transition-all duration-300",
                        currentMode === 'light'
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
            left: sidebarCollapsed ? '86px' : '240px', // Center of actual sidebar border (adjusted for zoom)
            backgroundColor: currentMode === 'light'
              ? `rgba(${mode.background.primary}, 0.9)`
              : `rgba(${mode.background.secondary}, 0.9)`,
            borderColor: `rgba(${theme.primary}, ${currentMode === 'light' ? '0.2' : '0.15'})`,
            boxShadow: currentMode === 'light'
              ? '0 1px 2px rgba(0, 0, 0, 0.05)'
              : `0 1px 2px rgba(${theme.primary}, 0.1)`,
            transition: 'box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.4)`;
            e.currentTarget.style.backgroundColor = currentMode === 'light'
              ? `rgba(${theme.primary}, 0.08)`
              : `rgba(${theme.primary}, 0.12)`;
            // Subtle glow effect without movement
            e.currentTarget.style.boxShadow = currentMode === 'light'
              ? `0 0 8px rgba(${theme.primary}, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)`
              : `0 0 8px rgba(${theme.primary}, 0.4), 0 2px 4px rgba(${theme.primary}, 0.2)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = `rgba(${theme.primary}, ${currentMode === 'light' ? '0.2' : '0.15'})`;
            e.currentTarget.style.backgroundColor = currentMode === 'light'
              ? `rgba(${mode.background.primary}, 0.9)`
              : `rgba(${mode.background.secondary}, 0.9)`;
            e.currentTarget.style.boxShadow = currentMode === 'light'
              ? '0 1px 2px rgba(0, 0, 0, 0.05)'
              : `0 1px 2px rgba(${theme.primary}, 0.1)`;
          }}
        >
          {sidebarCollapsed ? (
            // Right arrow for expand (show sidebar)
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M9 18L15 12L9 6"
                stroke={currentMode === 'light' ? `rgba(${mode.text.primary}, 0.8)` : `rgba(${theme.primaryLight}, 0.9)`}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            // Left arrow for collapse (hide sidebar)
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M15 18L9 12L15 6"
                stroke={currentMode === 'light' ? `rgba(${mode.text.primary}, 0.8)` : `rgba(${theme.primaryLight}, 0.9)`}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <span className="sr-only">{sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}</span>
        </Button>

        {/* Main Content Area */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "lg:ml-28" : "lg:ml-72"
        )}>
          {/* Premium Dashboard Header */}
          <header className="sticky top-0 z-40 w-full" style={{
            boxShadow: currentMode === 'light' ? '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' : 'none'
          }}>
            {/* Premium Background with Strategic Gradients */}
            <div className="absolute inset-0" style={{
              background: currentMode === 'light'
                ? `linear-gradient(to right, rgba(${mode.background.primary}, 1), rgba(${mode.background.secondary}, 1), rgba(${mode.background.primary}, 1))`
                : `linear-gradient(to right, rgba(${mode.background.primary}, 1), rgba(${mode.background.secondary}, 1), rgba(${mode.background.primary}, 1))`
            }}></div>
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 30% 50%, rgba(${theme.primary}, ${currentMode === 'light' ? '0.05' : '0.1'}), transparent)` }}></div>
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 70% 50%, rgba(${theme.accent}, ${currentMode === 'light' ? '0.03' : '0.08'}), transparent)` }}></div>

            {/* Premium Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px]"></div>

            {/* Refined Border */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent to-transparent" style={{
              backgroundColor: currentMode === 'light'
                ? `rgba(${mode.border}, 1)`
                : `rgba(${theme.primary}, 0.3)`
            }}></div>

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
                          backgroundColor: currentMode === 'light'
                            ? `rgba(${mode.background.tertiary}, 1)`
                            : `rgba(${mode.background.secondary}, 0.5)`,
                          borderColor: `rgba(${theme.primary}, ${currentMode === 'light' ? '0.3' : '0.2'})`,
                          color: `rgba(${mode.text.muted}, 1)`,
                          boxShadow: currentMode === 'light' ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none'
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

                        <SheetTitle className="relative font-semibold text-white z-10">Game Of Creators</SheetTitle>
                        <SheetDescription className="sr-only">
                          Dashboard navigation menu
                        </SheetDescription>
                      </SheetHeader>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto sidebar-scrollbar h-full">
                          {userRole && (
                            <DashboardSidebar
                              userRole={userRole}
                              collapsed={false}
                            />
                          )}
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>

                  <Separator orientation="vertical" className={cn(
                    "h-6",
                    currentMode === 'light' ? "bg-slate-300" : "bg-violet-400/20"
                  )} />

                  {/* Enhanced Breadcrumb */}
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem className="hidden md:block">
                        <BreadcrumbLink
                          href="/dashboard"
                          className={cn(
                            "transition-colors duration-200",
                            currentMode === 'light'
                              ? "text-slate-600 hover:text-slate-900"
                              : "text-slate-300 hover:text-white"
                          )}
                        >
                          Dashboard
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      {pathname !== "/dashboard" && (
                        <>
                          <BreadcrumbSeparator className={cn(
                            "hidden md:block",
                            currentMode === 'light' ? "text-slate-400" : "text-slate-500"
                          )} />
                          <BreadcrumbItem>
                            <BreadcrumbPage className={cn(
                              "font-medium",
                              currentMode === 'light' ? "text-slate-900" : "text-white"
                            )}>
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
                        backgroundColor: currentMode === 'light'
                          ? `rgba(${mode.background.tertiary}, 1)`
                          : `rgba(${mode.background.secondary}, 0.5)`,
                        borderColor: `rgba(${theme.primary}, ${currentMode === 'light' ? '0.3' : '0.2'})`,
                        color: `rgba(${mode.text.muted}, 1)`,
                        boxShadow: currentMode === 'light' ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none'
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

                  {/* Settings Panel Trigger - Premium Style */}
                  <Sheet open={settingsPanelOpen} onOpenChange={setSettingsPanelOpen}>
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 backdrop-blur-sm transition-all duration-300"
                        style={{
                          backgroundColor: currentMode === 'light'
                            ? `rgba(${mode.background.tertiary}, 1)`
                            : `rgba(${mode.background.secondary}, 0.5)`,
                          borderColor: `rgba(${theme.primary}, ${currentMode === 'light' ? '0.3' : '0.2'})`,
                          color: `rgba(${mode.text.muted}, 1)`,
                          boxShadow: currentMode === 'light' ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none'
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
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="sr-only">Dashboard Settings</span>
                      </Button>
                    </SheetTrigger>

                    {/* Settings Panel Content */}
                    <SheetContent
                      side="right"
                      className="w-96 p-0 border-l"
                      style={{
                        background: currentMode === 'dark'
                          ? `linear-gradient(135deg, rgba(${mode.background.primary}, 0.95), rgba(${mode.background.secondary}, 0.9), rgba(${mode.background.primary}, 0.95))`
                          : `linear-gradient(135deg, rgba(${mode.background.primary}, 1), rgba(${mode.background.secondary}, 1))`,
                        borderColor: `rgba(${theme.primary}, ${currentMode === 'dark' ? '0.3' : '0.2'})`,
                      }}
                    >
                      {/* Premium Background Effects */}
                      <div
                        className="absolute inset-0"
                        style={{
                          background: `radial-gradient(circle at 70% 30%, rgba(${theme.primary}, 0.1), transparent)`
                        }}
                      ></div>
                      <div
                        className="absolute inset-0"
                        style={{
                          background: `radial-gradient(circle at 30% 70%, rgba(${theme.accent}, 0.08), transparent)`
                        }}
                      ></div>
                      <div
                        className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px]"
                        style={{
                          opacity: currentMode === 'dark' ? 1 : 0.3
                        }}
                      ></div>

                      <div className="relative h-full flex flex-col">
                        {/* Header */}
                        <SheetHeader
                          className="p-6 border-b flex-shrink-0"
                          style={{
                            borderColor: `rgba(${theme.primary}, ${currentMode === 'dark' ? '0.2' : '0.15'})`
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center"
                              style={{
                                backgroundColor: `rgba(${theme.primary}, 0.2)`
                              }}
                            >
                              <Settings
                                className="h-6 w-6"
                                style={{
                                  color: `rgba(${theme.primary}, 1)`
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <SheetTitle
                                className="text-lg font-semibold"
                                style={{
                                  color: `rgba(${mode.text.primary}, 1)`
                                }}
                              >
                                Dashboard Settings
                              </SheetTitle>
                              <p
                                className="text-sm"
                                style={{
                                  color: `rgba(${mode.text.secondary}, 1)`
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
                            {/* Quick Presets */}
                            <div className="space-y-4">
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
                                      "p-4 rounded-xl border-2 transition-all duration-200 text-left",
                                      currentPreset === key
                                        ? "border-opacity-60"
                                        : "border-opacity-20 hover:border-opacity-40"
                                    )}
                                    style={{
                                      backgroundColor: `rgba(${mode.background.secondary}, 0.3)`,
                                      borderColor: currentPreset === key
                                        ? `rgba(${theme.primary}, 0.6)`
                                        : `rgba(${theme.primary}, 0.2)`,
                                    }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <div className="font-medium text-sm" style={{ color: `rgba(${mode.text.primary}, 1)` }}>
                                          {preset.name}
                                        </div>
                                        <div className="text-xs mt-1" style={{ color: `rgba(${mode.text.muted}, 1)` }}>
                                          {preset.description}
                                        </div>
                                      </div>
                                      {currentPreset === key && (
                                        <div
                                          className="w-2 h-2 rounded-full"
                                          style={{ backgroundColor: `rgba(${theme.primary}, 1)` }}
                                        />
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Appearance Settings */}
                            <div className="space-y-4">
                              <h3
                                className="text-sm font-semibold uppercase tracking-wider"
                                style={{
                                  color: `rgba(${mode.text.muted}, 1)`
                                }}
                              >
                                Appearance
                              </h3>

                              {/* Dark Mode Toggle */}
                              <div
                                className="flex items-center justify-between p-4 rounded-xl border"
                                style={{
                                  backgroundColor: `rgba(${mode.background.secondary}, 0.3)`,
                                  borderColor: `rgba(${theme.primary}, 0.2)`,
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: `rgba(${theme.primary}, 0.2)` }}
                                  >
                                    {currentMode === 'dark' ? (
                                      <Moon className="h-5 w-5" style={{ color: `rgba(${theme.primaryLight}, 1)` }} />
                                    ) : (
                                      <Sun className="h-5 w-5" style={{ color: `rgba(${theme.primaryLight}, 1)` }} />
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-medium text-sm" style={{ color: `rgba(${mode.text.primary}, 1)` }}>
                                      {currentMode === 'dark' ? 'Dark Mode' : 'Light Mode'}
                                    </div>
                                    <div className="text-xs" style={{ color: `rgba(${mode.text.muted}, 1)` }}>
                                      Toggle dark/light theme
                                    </div>
                                  </div>
                                </div>
                                <Switch
                                  checked={currentMode === 'dark'}
                                  onCheckedChange={(checked) => switchMode(checked ? 'dark' : 'light')}
                                />
                              </div>

                              {/* Colorful Mode Toggle - Only for Light Mode */}
                              {currentMode === 'light' && (
                                <div
                                  className="flex items-center justify-between p-4 rounded-xl border"
                                  style={{
                                    backgroundColor: `rgba(${mode.background.secondary}, 0.3)`,
                                    borderColor: `rgba(${theme.primary}, 0.2)`,
                                  }}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                                      style={{ backgroundColor: `rgba(${theme.primary}, 0.2)` }}
                                    >
                                      <Contrast className="h-5 w-5" style={{ color: `rgba(${theme.primaryLight}, 1)` }} />
                                    </div>
                                    <div>
                                      <div className="font-medium text-sm" style={{ color: `rgba(${mode.text.primary}, 1)` }}>
                                        Colorful Mode
                                      </div>
                                      <div className="text-xs" style={{ color: `rgba(${mode.text.muted}, 1)` }}>
                                        Enable vibrant theme colors
                                      </div>
                                    </div>
                                  </div>
                                  <Switch
                                    checked={isColorfulMode}
                                    onCheckedChange={toggleColorfulMode}
                                  />
                                </div>
                              )}

                              {/* Full Screen Toggle */}
                              {isFullscreenClient && isFullscreenSupported && (
                                <div
                                  className="flex items-center justify-between p-4 rounded-xl border"
                                  style={{
                                    backgroundColor: `rgba(${mode.background.secondary}, 0.3)`,
                                    borderColor: `rgba(${theme.primary}, 0.2)`,
                                  }}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                                      style={{ backgroundColor: `rgba(${theme.primary}, 0.2)` }}
                                    >
                                      {isFullscreen ? (
                                        <Minimize className="h-5 w-5" style={{ color: `rgba(${theme.primaryLight}, 1)` }} />
                                      ) : (
                                        <Maximize className="h-5 w-5" style={{ color: `rgba(${theme.primaryLight}, 1)` }} />
                                      )}
                                    </div>
                                    <div>
                                      <div className="font-medium text-sm" style={{ color: `rgba(${mode.text.primary}, 1)` }}>
                                        {isFullscreen ? 'Exit Full Screen' : 'Full Screen Mode'}
                                      </div>
                                      <div className="text-xs" style={{ color: `rgba(${mode.text.muted}, 1)` }}>
                                        Toggle full screen view
                                      </div>
                                    </div>
                                  </div>
                                  <Switch
                                    checked={isFullscreen}
                                    onCheckedChange={() => toggleFullscreen()}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Color Scheme */}
                            <div className="space-y-4">
                              <h3
                                className="text-sm font-semibold uppercase tracking-wider"
                                style={{
                                  color: `rgba(${mode.text.muted}, 1)`
                                }}
                              >
                                Color Themes
                              </h3>
                              <div className="grid grid-cols-2 gap-3">
                                {/* Purple/Game of Creators Theme */}
                                <button
                                  onClick={() => switchTheme('purple')}
                                  className="p-3 rounded-xl border-2 transition-all duration-200"
                                  style={{
                                    backgroundColor: currentTheme === 'purple'
                                      ? `rgba(${colorThemes.purple.primary}, 0.2)`
                                      : `rgba(${mode.background.secondary}, 0.3)`,
                                    borderColor: currentTheme === 'purple'
                                      ? `rgba(${colorThemes.purple.primary}, 0.4)`
                                      : `rgba(${colorThemes.purple.primary}, 0.2)`,
                                    color: currentTheme === 'purple'
                                      ? `rgba(${mode.text.primary}, 1)`
                                      : `rgba(${mode.text.secondary}, 1)`
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = `rgba(${colorThemes.purple.primary}, 0.6)`;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = currentTheme === 'purple'
                                      ? `rgba(${colorThemes.purple.primary}, 0.4)`
                                      : `rgba(${colorThemes.purple.primary}, 0.2)`;
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-4 h-4 rounded-full"
                                      style={{
                                        backgroundColor: `rgba(${colorThemes.purple.primary}, 1)`
                                      }}
                                    ></div>
                                    <span className="text-sm font-medium">Purple</span>
                                  </div>
                                </button>

                                {/* Clean Theme */}
                                <button
                                  onClick={() => switchTheme('clean')}
                                  className="p-3 rounded-xl border-2 transition-all duration-200"
                                  style={{
                                    backgroundColor: currentTheme === 'clean'
                                      ? `rgba(${colorThemes.clean.primary}, 0.2)`
                                      : `rgba(${mode.background.secondary}, 0.3)`,
                                    borderColor: currentTheme === 'clean'
                                      ? `rgba(${colorThemes.clean.primary}, 0.4)`
                                      : `rgba(${colorThemes.clean.primary}, 0.2)`,
                                    color: currentTheme === 'clean'
                                      ? `rgba(${mode.text.primary}, 1)`
                                      : `rgba(${mode.text.secondary}, 1)`
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = `rgba(${colorThemes.clean.primary}, 0.6)`;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = currentTheme === 'clean'
                                      ? `rgba(${colorThemes.clean.primary}, 0.4)`
                                      : `rgba(${colorThemes.clean.primary}, 0.2)`;
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-4 h-4 rounded-full"
                                      style={{
                                        backgroundColor: `rgba(${colorThemes.clean.primary}, 1)`
                                      }}
                                    ></div>
                                    <span className="text-sm font-medium">Clean</span>
                                  </div>
                                </button>

                                {/* Blue Ocean Theme */}
                                <button
                                  onClick={() => switchTheme('blue')}
                                  className="p-3 rounded-xl border-2 transition-all duration-200"
                                  style={{
                                    backgroundColor: currentTheme === 'blue'
                                      ? `rgba(${colorThemes.blue.primary}, 0.2)`
                                      : `rgba(${mode.background.secondary}, 0.3)`,
                                    borderColor: currentTheme === 'blue'
                                      ? `rgba(${colorThemes.blue.primary}, 0.4)`
                                      : `rgba(${colorThemes.blue.primary}, 0.2)`,
                                    color: currentTheme === 'blue'
                                      ? `rgba(${mode.text.primary}, 1)`
                                      : `rgba(${mode.text.secondary}, 1)`
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = `rgba(${colorThemes.blue.primary}, 0.6)`;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = currentTheme === 'blue'
                                      ? `rgba(${colorThemes.blue.primary}, 0.4)`
                                      : `rgba(${colorThemes.blue.primary}, 0.2)`;
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-4 h-4 rounded-full"
                                      style={{
                                        backgroundColor: `rgba(${colorThemes.blue.primary}, 1)`
                                      }}
                                    ></div>
                                    <span className="text-sm font-medium">Blue Ocean</span>
                                  </div>
                                </button>

                                {/* Green Forest Theme */}
                                <button
                                  onClick={() => switchTheme('green')}
                                  className="p-3 rounded-xl border-2 transition-all duration-200"
                                  style={{
                                    backgroundColor: currentTheme === 'green'
                                      ? `rgba(${colorThemes.green.primary}, 0.2)`
                                      : `rgba(${mode.background.secondary}, 0.3)`,
                                    borderColor: currentTheme === 'green'
                                      ? `rgba(${colorThemes.green.primary}, 0.4)`
                                      : `rgba(${colorThemes.green.primary}, 0.2)`,
                                    color: currentTheme === 'green'
                                      ? `rgba(${mode.text.primary}, 1)`
                                      : `rgba(${mode.text.secondary}, 1)`
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = `rgba(${colorThemes.green.primary}, 0.6)`;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = currentTheme === 'green'
                                      ? `rgba(${colorThemes.green.primary}, 0.4)`
                                      : `rgba(${colorThemes.green.primary}, 0.2)`;
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-4 h-4 rounded-full"
                                      style={{
                                        backgroundColor: `rgba(${colorThemes.green.primary}, 1)`
                                      }}
                                    ></div>
                                    <span className="text-sm font-medium">Green Forest</span>
                                  </div>
                                </button>

                                {/* Rose Sunset Theme */}
                                <button
                                  onClick={() => switchTheme('rose')}
                                  className="p-3 rounded-xl border-2 transition-all duration-200"
                                  style={{
                                    backgroundColor: currentTheme === 'rose'
                                      ? `rgba(${colorThemes.rose.primary}, 0.2)`
                                      : `rgba(${mode.background.secondary}, 0.3)`,
                                    borderColor: currentTheme === 'rose'
                                      ? `rgba(${colorThemes.rose.primary}, 0.4)`
                                      : `rgba(${colorThemes.rose.primary}, 0.2)`,
                                    color: currentTheme === 'rose'
                                      ? `rgba(${mode.text.primary}, 1)`
                                      : `rgba(${mode.text.secondary}, 1)`
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = `rgba(${colorThemes.rose.primary}, 0.6)`;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = currentTheme === 'rose'
                                      ? `rgba(${colorThemes.rose.primary}, 0.4)`
                                      : `rgba(${colorThemes.rose.primary}, 0.2)`;
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-4 h-4 rounded-full"
                                      style={{
                                        backgroundColor: `rgba(${colorThemes.rose.primary}, 1)`
                                      }}
                                    ></div>
                                    <span className="text-sm font-medium">Rose Sunset</span>
                                  </div>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Footer - Action Buttons */}
                        <div
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
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>

                  {/* User Profile Sidebar Trigger - Premium Style */}
                  <Sheet open={profileSidebarOpen} onOpenChange={setProfileSidebarOpen}>
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-8 px-3 backdrop-blur-sm transition-all duration-300"
                        style={{
                          backgroundColor: currentMode === 'light'
                            ? `rgba(${mode.background.tertiary}, 1)`
                            : `rgba(${mode.background.secondary}, 0.5)`,
                          borderColor: `rgba(${theme.primary}, ${currentMode === 'light' ? '0.3' : '0.2'})`,
                          color: `rgba(${mode.text.muted}, 1)`,
                          boxShadow: currentMode === 'light' ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none'
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
                          <span className="hidden sm:block text-sm font-medium">
                            {displayName}
                          </span>
                        </div>
                      </Button>
                    </SheetTrigger>

                    {/* Profile Sidebar Content */}
                    <SheetContent
                      side="right"
                      className="w-80 p-0 border-l"
                      style={{
                        background: currentMode === 'dark'
                          ? `linear-gradient(135deg, rgba(${mode.background.primary}, 0.95), rgba(${mode.background.secondary}, 0.9), rgba(${mode.background.primary}, 0.95))`
                          : `linear-gradient(135deg, rgba(${mode.background.primary}, 1), rgba(${mode.background.secondary}, 1))`,
                        borderColor: `rgba(${theme.primary}, ${currentMode === 'dark' ? '0.3' : '0.2'})`,
                      }}
                    >
                      {/* Premium Background Effects */}
                      <div
                        className="absolute inset-0"
                        style={{
                          background: `radial-gradient(circle at 70% 30%, rgba(${theme.primary}, 0.1), transparent)`
                        }}
                      ></div>
                      <div
                        className="absolute inset-0"
                        style={{
                          background: `radial-gradient(circle at 30% 70%, rgba(${theme.accent}, 0.08), transparent)`
                        }}
                      ></div>
                      <div
                        className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px]"
                        style={{
                          opacity: currentMode === 'dark' ? 1 : 0.3
                        }}
                      ></div>

                      <div className="relative h-full flex flex-col">
                        {/* Header */}
                        <SheetHeader
                          className="p-6 border-b flex-shrink-0"
                          style={{
                            borderColor: `rgba(${theme.primary}, ${currentMode === 'dark' ? '0.2' : '0.15'})`
                          }}
                        >
                          <div className="flex items-center gap-4">
                            {avatarSrc ? (
                              <Avatar
                                className="h-16 w-16"
                                style={{
                                  border: `2px solid rgba(${theme.primary}, 0.3)`
                                }}
                              >
                                <AvatarImage src={avatarSrc} alt={displayName} />
                                <AvatarFallback
                                  className="text-white text-xl font-bold"
                                  style={{
                                    background: `linear-gradient(135deg, rgba(${theme.primary}, 1), rgba(${theme.primaryDark}, 1))`
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
                                  border: `2px solid rgba(${theme.primary}, 0.3)`
                                }}
                              >
                                {avatarFallback}
                              </div>
                            )}
                            <div className="flex-1">
                              <SheetTitle
                                className="text-lg font-semibold"
                                style={{
                                  color: `rgba(${mode.text.primary}, 1)`
                                }}
                              >
                                {displayName}
                              </SheetTitle>
                              <p
                                className="text-sm"
                                style={{
                                  color: `rgba(${mode.text.secondary}, 1)`
                                }}
                              >
                                {displayEmail}
                              </p>
                              <div className="mt-2">
                                <span
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border"
                                  style={{
                                    backgroundColor: `rgba(${theme.primary}, 0.2)`,
                                    color: `rgba(${theme.primary}, 1)`,
                                    borderColor: `rgba(${theme.primary}, 0.2)`
                                  }}
                                >
                                  {userRole === "advertiser" ? "Advertiser" : userRole === "creator" ? "Creator" : "Admin"}
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
                          {/* Content - Unique Information Instead of Duplicate Navigation */}
                          <div className="p-6 space-y-6">
                            {/* Account Plan Section - Only for Advertisers */}
                            {userRole === "advertiser" && (
                              <div className="space-y-3">
                                <h3
                                  className="text-sm font-semibold uppercase tracking-wider"
                                  style={{
                                    color: `rgba(${mode.text.muted}, 1)`
                                  }}
                                >
                                  Current Plan
                                </h3>
                                <div
                                  className="p-4 rounded-xl border"
                                  style={{
                                    background: `linear-gradient(135deg, rgba(${theme.primary}, 0.2), rgba(${theme.primaryDark}, 0.2))`,
                                    borderColor: `rgba(${theme.primary}, 0.3)`
                                  }}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div
                                        className="font-semibold"
                                        style={{
                                          color: `rgba(${mode.text.primary}, 1)`
                                        }}
                                      >
                                        {currentPlan.name} Plan
                                      </div>
                                      <div
                                        className="text-xs"
                                        style={{
                                          color: `rgba(${theme.primary}, 1)`
                                        }}
                                      >
                                        {currentPlan.price === 0
                                          ? "Basic features included"
                                          : `$${(currentPlan.price / 100).toFixed(2)}/month`
                                        }
                                      </div>
                                    </div>
                                    <div
                                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                                      style={{
                                        backgroundColor: `rgba(${theme.primary}, 0.3)`
                                      }}
                                    >
                                      <svg
                                        className="h-5 w-5"
                                        style={{
                                          color: `rgba(${theme.primary}, 1)`
                                        }}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                      </svg>
                                    </div>
                                  </div>
                                  <Link
                                    href="/dashboard/billing"
                                    onClick={() => setProfileSidebarOpen(false)}
                                    className="inline-flex items-center gap-2 mt-3 text-xs transition-colors"
                                    style={{
                                      color: `rgba(${theme.primary}, 1)`
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.color = `rgba(${mode.text.primary}, 1)`;
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.color = `rgba(${theme.primary}, 1)`;
                                    }}
                                  >
                                    Upgrade Plan
                                    <ChevronRight className="h-3 w-3" />
                                  </Link>
                                </div>
                              </div>
                            )}

                            {/* Quick Actions */}
                            <div className="space-y-3">
                              <h3
                                className="text-sm font-semibold uppercase tracking-wider"
                                style={{
                                  color: `rgba(${mode.text.muted}, 1)`
                                }}
                              >
                                Quick Actions
                              </h3>
                              <div className="space-y-2">
                                <Link
                                  href="/dashboard/profile"
                                  onClick={() => setProfileSidebarOpen(false)}
                                  className="flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 group"
                                  style={{
                                    backgroundColor: `rgba(${mode.background.secondary}, 0.3)`,
                                    borderColor: `rgba(${theme.primary}, 0.2)`,
                                    color: `rgba(${mode.text.secondary}, 1)`
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.4)`;
                                    e.currentTarget.style.backgroundColor = `rgba(${theme.primary}, 0.1)`;
                                    e.currentTarget.style.color = `rgba(${mode.text.primary}, 1)`;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.2)`;
                                    e.currentTarget.style.backgroundColor = `rgba(${mode.background.secondary}, 0.3)`;
                                    e.currentTarget.style.color = `rgba(${mode.text.secondary}, 1)`;
                                  }}
                                >
                                  <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center group-hover:opacity-80 transition-colors"
                                    style={{
                                      backgroundColor: `rgba(${theme.primary}, 0.2)`
                                    }}
                                  >
                                    <User
                                      className="h-4 w-4"
                                      style={{
                                        color: `rgba(${theme.primary}, 1)`
                                      }}
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-medium text-sm">Edit Profile</div>
                                  </div>
                                  <ChevronRight
                                    className="h-3 w-3 transition-all group-hover:translate-x-0.5"
                                    style={{
                                      color: `rgba(${mode.text.muted}, 1)`
                                    }}
                                  />
                                </Link>
                                <button
                                  onClick={() => {
                                    setProfileSidebarOpen(false);
                                    setSettingsPanelOpen(true);
                                  }}
                                  className="flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 group w-full"
                                  style={{
                                    backgroundColor: `rgba(${mode.background.secondary}, 0.3)`,
                                    borderColor: `rgba(${theme.primary}, 0.2)`,
                                    color: `rgba(${mode.text.secondary}, 1)`
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.4)`;
                                    e.currentTarget.style.backgroundColor = `rgba(${theme.primary}, 0.1)`;
                                    e.currentTarget.style.color = `rgba(${mode.text.primary}, 1)`;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = `rgba(${theme.primary}, 0.2)`;
                                    e.currentTarget.style.backgroundColor = `rgba(${mode.background.secondary}, 0.3)`;
                                    e.currentTarget.style.color = `rgba(${mode.text.secondary}, 1)`;
                                  }}
                                >
                                  <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center group-hover:opacity-80 transition-colors"
                                    style={{
                                      backgroundColor: `rgba(${theme.primary}, 0.2)`
                                    }}
                                  >
                                    <Settings
                                      className="h-4 w-4"
                                      style={{
                                        color: `rgba(${theme.primary}, 1)`
                                      }}
                                    />
                                  </div>
                                  <div className="flex-1 text-left">
                                    <div className="font-medium text-sm">Dashboard Settings</div>
                                  </div>
                                  <ChevronRight
                                    className="h-3 w-3 transition-all group-hover:translate-x-0.5"
                                    style={{
                                      color: `rgba(${mode.text.muted}, 1)`
                                    }}
                                  />
                                </button>
                              </div>
                            </div>

                            {/* Account Status */}
                            <div className="space-y-3">
                              <h3
                                className="text-sm font-semibold uppercase tracking-wider"
                                style={{
                                  color: `rgba(${mode.text.muted}, 1)`
                                }}
                              >
                                Account Status
                              </h3>
                              <div
                                className="p-3 rounded-lg border"
                                style={{
                                  backgroundColor: `rgba(${mode.background.secondary}, 0.3)`,
                                  borderColor: profileData.isActive ? 'rgba(34, 197, 94, 0.2)' : 'rgba(244, 63, 94, 0.2)'
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{
                                      backgroundColor: profileData.isActive ? 'rgb(34, 197, 94)' : 'rgb(244, 63, 94)'
                                    }}
                                  ></div>
                                  <span
                                    className="text-sm font-medium"
                                    style={{
                                      color: profileData.isActive ? 'rgb(74, 222, 128)' : 'rgb(251, 113, 133)'
                                    }}
                                  >
                                    {profileData.isActive ? "Active" : "Inactive"}
                                  </span>
                                </div>
                                <p
                                  className="text-xs mt-1"
                                  style={{
                                    color: profileData.isActive ? 'rgba(34, 197, 94, 0.7)' : 'rgba(244, 63, 94, 0.7)'
                                  }}
                                >
                                  {profileData.isActive
                                    ? "Your account is active and fully functional"
                                    : "Your account is currently inactive"
                                  }
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Footer - Sign Out */}
                        <div
                          className="p-6 border-t flex-shrink-0"
                          style={{
                            borderColor: `rgba(${theme.primary}, ${currentMode === 'dark' ? '0.2' : '0.15'})`
                          }}
                        >
                          <Button
                            onClick={handleSignOut}
                            variant="ghost"
                            className="w-full justify-start gap-3 p-3 h-auto border transition-all duration-300"
                            style={{
                              backgroundColor: 'rgba(244, 63, 94, 0.2)',
                              borderColor: 'rgba(244, 63, 94, 0.2)',
                              color: 'rgb(251, 113, 133)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.4)';
                              e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.1)';
                              e.currentTarget.style.color = 'rgb(248, 113, 113)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.2)';
                              e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.2)';
                              e.currentTarget.style.color = 'rgb(251, 113, 133)';
                            }}
                          >
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center"
                              style={{
                                backgroundColor: 'rgba(244, 63, 94, 0.2)'
                              }}
                            >
                              <LogOut
                                className="h-5 w-5"
                                style={{
                                  color: 'rgb(244, 63, 94)'
                                }}
                              />
                            </div>
                            <div className="flex-1 text-left">
                              <div className="font-medium">Sign Out</div>
                              <div
                                className="text-xs"
                                style={{
                                  color: 'rgba(244, 63, 94, 0.8)'
                                }}
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
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default DashboardContent;
