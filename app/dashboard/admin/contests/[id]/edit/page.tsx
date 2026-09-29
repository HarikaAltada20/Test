import React from "react";
import EditContestClient from "../../../../contests/[id]/edit/client";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";
import { redirect } from "next/navigation";
import { verifyAdminAccess } from "@/utils/admin-auth";

export default async function AdminEditContestPage({
    params,
    searchParams
}: {
    params: Promise<{ id: string }>,
    searchParams: Promise<{ dates?: string }>
}) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;

    // Verify admin access
    const { isAdmin, error } = await verifyAdminAccess();

    if (!isAdmin) {
        console.log('Non-admin user attempted to access admin contest edit:', error);
        redirect("/dashboard");
    }

    const supabase = await createClient();
    const user = await getSessionUser(supabase);
    const datesOnly = resolvedSearchParams.dates === 'true';

    if (!user) {
        redirect("/login");
    }

    return <EditContestClient
        user={user}
        contestId={resolvedParams.id}
        datesOnly={datesOnly}
        isAdmin={true}
    />;
}

