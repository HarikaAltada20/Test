import { verifyAdminAccess } from "@/utils/admin-auth";
import WithdrawalsClient from "./withdrawals-client";

export const revalidate = 0;

export default async function AdminWithdrawalsPage() {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) return null;

    return <WithdrawalsClient />;
}


