import type React from "react"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardSidebar } from "@/components/dashboard-sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServerClient()

  // Verify user authentication with server
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    console.log("User is not authenticated, redirecting to signin, :1")
    redirect("/auth/signin")
  }

  // Get user data from the database including username
  const { data: userData } = await supabase
    .from("users")
    .select("user_type, username")
    .eq("id", user.id)
    .single()

  // If user has no username, redirect to username setup
  if (!userData?.username) {
    redirect("/choose-username")
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
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
          <div className="flex-1">
            <h1 className="font-semibold">Dashboard</h1>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}

