"use client";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import type { UserResponse } from "@supabase/supabase-js";
import { Suspense } from "react";

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

  return (
    <div className="flex min-h-screen">
      <SimpleLoadingBar />
      <aside className="hidden w-64 border-r bg-background md:block">
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center border-b px-4">
            <span className="font-semibold">Game Of Creators</span>
          </div>
          {userRole && <DashboardSidebar userRole={userRole} />}
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
          <Suspense fallback={<LoadingPlaceholder />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}

export default DashboardContent;
