import { createClient } from "@/utils/supabase/server";
import DashboardContent from "./ClientLayout";

export default async function layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  return <DashboardContent user={user?.user}>{children}</DashboardContent>;
}
