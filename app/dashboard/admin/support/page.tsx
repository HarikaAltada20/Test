import { createClient } from "@/utils/supabase/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import SupportClient from "./support-client";

export const revalidate = 0;

export default async function AdminSupportPage() {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) return null;

    const supabase = await createClient();
    const [{ data: queries = [] }, { data: contacts = [] }] = await Promise.all([
        supabase.from("queries").select("*").order("created_at", { ascending: false }),
        supabase.from("contacts").select("*").order("created_at", { ascending: false }),
    ]);

    return <SupportClient initialQueries={queries as any[]} initialContacts={contacts as any[]} />;
}


