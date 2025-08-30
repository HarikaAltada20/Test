import { createClient } from "@/utils/supabase/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import WithdrawalsClient from "./withdrawals-client";

export const revalidate = 0;

export default async function AdminWithdrawalsPage() {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) return null;

    const supabase = await createClient();

    const { data: withdrawalRequests = [] } = await supabase
        .from("withdrawal_requests")
        .select("*, users(full_name, email)")
        .order("created_at", { ascending: false });

    return <WithdrawalsClient initialRequests={withdrawalRequests as any[]} />;
}


