"use client"

import { Suspense, useState, useEffect } from "react"
import { DashboardNav } from "@/components/dashboard-nav"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { useSupabase } from "@/contexts/supabase-context"
import { useAuth } from "@/contexts/auth-context"
import { LoadingPlaceholder } from "@/components/loading-placeholder"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { AuthGuard } from "@/components/auth-guard"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AuthGuard>
      <DashboardContent>{children}</DashboardContent>
    </AuthGuard>
  )
}

// Separate the dashboard content component for cleaner structure
function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth()
  const supabase = useSupabase()
  const [userData, setUserData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Add timeout state to handle long loading times
  const [loadingTimeout, setLoadingTimeout] = useState(false)

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let isMounted = true;

    const fetchUserData = async () => {
      if (!user) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        // Set a timeout to exit loading state if it persists too long
        timeoutId = setTimeout(() => {
          if (isMounted) {
            setLoadingTimeout(true);
            setIsLoading(false);
          }
        }, 5000); // 5 second timeout

        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        if (isMounted) {
          setUserData(data);
          setIsLoading(false);
          // Clear timeout as data loaded successfully
          if (timeoutId) clearTimeout(timeoutId);
        }
      } catch (err: any) {
        console.error("Error fetching user data:", err);
        if (isMounted) {
          setError(err.message);
          setIsLoading(false);
          // Clear timeout as we've handled the error
          if (timeoutId) clearTimeout(timeoutId);
        }
      }
    };

    fetchUserData();

    return () => {
      isMounted = false;
      // Clear timeout on component unmount
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user, supabase]);

  // Show error message if loading timed out
  if (loadingTimeout) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="flex flex-1 flex-col items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Dashboard is taking longer than usual to load. You can try refreshing the page.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Show loading state while fetching user data
  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r bg-background md:block">
          <div className="flex h-full flex-col">
            <div className="flex h-14 items-center border-b px-4">
              <span className="font-semibold">Game Of Creators</span>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <Skeleton className="h-8 w-full mb-4" />
              <Skeleton className="h-8 w-full mb-4" />
              <Skeleton className="h-8 w-full mb-4" />
              <Skeleton className="h-8 w-full mb-4" />
              <Skeleton className="h-8 w-full mb-4" />
            </div>
          </div>
        </aside>
        <div className="flex flex-1 flex-col">
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
            <div className="grid gap-4">
              <Skeleton className="h-64" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  const userRole = (userData?.user_type as "advertiser" | "creator") || null

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
  )
}

