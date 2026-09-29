import { createClient } from "@/utils/supabase/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import SupportClient from "./support-client";

export const revalidate = 0;

export default async function AdminSupportPage() {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) return null;

  const supabase = await createClient();

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: false });

  if (contactsError) {
    console.error("Error fetching contacts:", contactsError);
  }

  return <SupportClient initialContacts={(contacts || []) as any[]} />;
}
