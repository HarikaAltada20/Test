"use client";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import type { UserResponse } from "@supabase/supabase-js";
import { Suspense, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

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
  const userRole = user?.user_type as "advertiser" | "creator" | "admin" || null;
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileData, setProfileData] = useState<{
    fullName: string | null;
    profilePictureUrl: string | null;
  }>({
    fullName: null,
    profilePictureUrl: null,
  });

  // Fetch user profile data
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) return;

      const supabase = createClient();
      const { data: profile } = await supabase
        .from('users')
        .select('full_name, profile_picture_url')
        .eq('id', user.id)
        .single();

      if (profile) {
        setProfileData({
          fullName: profile.full_name,
          profilePictureUrl: profile.profile_picture_url,
        });
      }
    };

    fetchProfileData();
  }, [user]);

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

  return (
    <div className="min-h-screen bg-background">
      <SimpleLoadingBar />

      {/* Main Layout Container */}
      <div className="flex h-screen overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className={cn(
          "hidden lg:flex flex-col bg-sidebar border-r border-border transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "w-16" : "w-64"
        )}>
          {/* Sidebar Header */}
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            {!sidebarCollapsed && (
              <span className="font-semibold text-foreground">Game Of Creators</span>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="h-8 w-8 hover:bg-sidebar-accent"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto">
            {userRole && (
              <DashboardSidebar
                userRole={userRole}
                collapsed={sidebarCollapsed}
                user={user}
                profileFullName={profileData.fullName}
                profilePictureUrl={profileData.profilePictureUrl}
              />
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <header className="flex h-16 items-center gap-4 border-b border-border bg-background px-6">
            {/* Mobile Menu Trigger */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden h-8 w-8"
                >
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">Toggle Sidebar</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-64 p-0 bg-sidebar border-r border-border"
              >
                <SheetHeader className="flex h-16 items-center justify-between border-b border-border px-4">
                  <SheetTitle className="font-semibold text-foreground">Game Of Creators</SheetTitle>
                  <SheetDescription className="sr-only">
                    Dashboard navigation menu
                  </SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto">
                  {userRole && (
                    <DashboardSidebar
                      userRole={userRole}
                      collapsed={false}
                      user={user}
                      profileFullName={profileData.fullName}
                      profilePictureUrl={profileData.profilePictureUrl}
                    />
                  )}
                </div>
              </SheetContent>
            </Sheet>

            <Separator orientation="vertical" className="h-6" />

            {/* Breadcrumb */}
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/dashboard">
                    Dashboard
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {pathname !== "/dashboard" && (
                  <>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{currentPageTitle}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto">
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
