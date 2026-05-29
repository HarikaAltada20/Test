import { createClient } from "@/utils/supabase/server";

export type AuthUserRow = {
  id: string;
  email: string;
  user_type: string;
  support_chat_enabled: boolean;
};

export async function getAuthenticatedSupportUser(): Promise<{
  user: AuthUserRow | null;
  error: string | null;
  status: number;
}> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return { user: null, error: "Authentication required", status: 401 };
  }

  const { data: row, error: rowError } = await supabase
    .from("users")
    .select("id, email, user_type, support_chat_enabled")
    .eq("id", authUser.id)
    .single();

  if (rowError || !row) {
    return { user: null, error: "User not found", status: 404 };
  }

  return {
    user: {
      id: row.id,
      email: row.email,
      user_type: row.user_type,
      support_chat_enabled: row.support_chat_enabled !== false,
    },
    error: null,
    status: 200,
  };
}
