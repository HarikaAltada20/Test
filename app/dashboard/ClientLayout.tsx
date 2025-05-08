"use client";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import type { UserResponse } from "@supabase/supabase-js";
import { Suspense } from "react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function DashboardContent({
  children,
  user,
}: {
  children: React.ReactNode;
  user: UserResponse["data"]["user"];
}) {
  const userRole =
    (user?.user_metadata?.user_type as "advertiser" | "creator") || null;

  return (
    <div className="flex min-h-screen">
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
