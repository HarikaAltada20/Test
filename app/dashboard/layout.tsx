import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";
import DashboardContent from "./ClientLayout";
import { User } from "@supabase/supabase-js";

/**
 * Dashboard layout reads the session from cookies only (no getUser network call).
 * Middleware already refreshed/validated the session for /dashboard/* — a second
 * getUser here raced the single-use refresh token and caused intermittent logouts.
 */
export default async function layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  let userWithRole: (User & { user_type?: string | null }) | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .single();

    userWithRole = {
      ...user,
      user_type: profile?.user_type,
    };
  }

  return <DashboardContent user={userWithRole}>{children}</DashboardContent>;
}
