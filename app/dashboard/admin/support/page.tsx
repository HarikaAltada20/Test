import { createClient } from "@/utils/supabase/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import SupportClient from "./support-client";

export const revalidate = 0;

export default async function AdminSupportPage() {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) return null;

  const supabase = await createClient();

  // Fetch queries
  const { data: queries, error: queriesError } = await supabase
    .from("queries")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch contacts
  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: false });

  if (queriesError) {
    console.error("Error fetching queries:", queriesError);
  }
  if (contactsError) {
    console.error("Error fetching contacts:", contactsError);
  }

  // Fetch user details for queries
  let queriesWithUsers = queries || [];
  if (queries && queries.length > 0) {
    const userIds = [...new Set(queries.map((q) => q.user_id).filter(Boolean))];
    if (userIds.length > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, email, username")
        .in("id", userIds);

      if (usersError) {
        console.error("Error fetching users:", usersError);
      } else if (usersData) {
        const usersMap = new Map(usersData.map((user) => [user.id, user]));
        queriesWithUsers = queries.map((query) => ({
          ...query,
          users: query.user_id ? usersMap.get(query.user_id) || null : null,
        }));
      }
    }
  }

  return (
    <SupportClient
      initialQueries={queriesWithUsers as any[]}
      initialContacts={(contacts || []) as any[]}
    />
  );
}
