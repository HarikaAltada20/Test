import { createClient } from "@/utils/supabase/server";
import { getUserSafe } from "@/utils/supabase/auth-server";
import DashboardContent from "./ClientLayout";
import { User } from "@supabase/supabase-js";

export default async function layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await getUserSafe(supabase);

  let userWithRole: (User & { user_type?: string | null }) | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .single();

    userWithRole = {
      ...user,
      user_type: profile?.user_type
    };
  }

  return <DashboardContent user={userWithRole}>{children}</DashboardContent>;
}
