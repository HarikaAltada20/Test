import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/utils/supabase/admin";

export type UserDisplayInfo = {
  full_name: string | null;
  email: string;
};

type PublicUserRow = {
  id: string;
  full_name: string | null;
  email: string;
};

const CHUNK = 100;
const MAX_RETRIES = 2;

function isRetryableFetchError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  return (
    message.includes("fetch failed") ||
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT") ||
    message.includes("network")
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryPublicUsers(
  db: SupabaseClient,
  userIds: string[],
): Promise<PublicUserRow[]> {
  const rows: PublicUserRow[] = [];

  for (let i = 0; i < userIds.length; i += CHUNK) {
    const chunk = userIds.slice(i, i + CHUNK);
    if (chunk.length === 0) continue;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const { data, error } = await db
        .from("users")
        .select("id, full_name, email")
        .in("id", chunk);

      if (!error) {
        rows.push(...(data ?? []));
        break;
      }

      if (attempt < MAX_RETRIES && isRetryableFetchError(error)) {
        await sleep(250 * (attempt + 1));
        continue;
      }

      console.error(
        "[load-user-display] public.users query failed:",
        error.message ?? error,
      );
      break;
    }
  }

  return rows;
}

async function fillMissingFromAuth(
  db: SupabaseClient,
  missingIds: string[],
  usersMap: Map<string, UserDisplayInfo>,
) {
  const AUTH_BATCH = 10;
  for (let i = 0; i < missingIds.length; i += AUTH_BATCH) {
    const batch = missingIds.slice(i, i + AUTH_BATCH);
    await Promise.all(
      batch.map(async (userId) => {
        try {
          const { data, error } = await db.auth.admin.getUserById(userId);
          if (error || !data.user) return;

          const meta = data.user.user_metadata ?? {};
          const fullName =
            (typeof meta.full_name === "string" && meta.full_name) ||
            (typeof meta.name === "string" && meta.name) ||
            null;

          usersMap.set(userId, {
            full_name: fullName,
            email: data.user.email ?? "",
          });
        } catch (err) {
          console.error(
            `[load-user-display] auth fallback failed for ${userId}:`,
            err,
          );
        }
      }),
    );
  }
}

/** Resolve display name + email for campaign recipient rows. */
export async function loadUserDisplayInfoByIds(
  userIds: string[],
): Promise<Map<string, UserDisplayInfo>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const usersMap = new Map<string, UserDisplayInfo>();
  if (uniqueIds.length === 0) return usersMap;

  const db = createAdminClient();
  const publicUsers = await queryPublicUsers(db, uniqueIds);

  for (const user of publicUsers) {
    usersMap.set(user.id, {
      full_name: user.full_name,
      email: user.email ?? "",
    });
  }

  const missingIds = uniqueIds.filter((id) => !usersMap.has(id));
  if (missingIds.length > 0) {
    await fillMissingFromAuth(db, missingIds, usersMap);
  }

  return usersMap;
}
