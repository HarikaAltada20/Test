import type { SupabaseClient } from "@supabase/supabase-js";
import { encrypt } from "@/lib/encryption";

/**
 * Bidirectional vault upsert for account switching (owner ↔ target).
 * Forward row stores target's refresh; reverse row stores owner's refresh.
 */
export async function upsertBidirectionalVaultLinks(
  adminSupabase: Admin,
  ownerUserId: string,
  targetUserId: string,
  ownerRefreshPlain: string,
  targetRefreshPlain: string,
  options?: { linkedTargetEmail?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const encryptedOwnerToken = encrypt(ownerRefreshPlain);
  const encryptedTargetToken = encrypt(targetRefreshPlain);

  const [{ data: existingForward }, { data: existingReverse }] =
    await Promise.all([
      adminSupabase
        .from("user_sessions_vault")
        .select(
          "owner_user_id, target_user_id, encrypted_refresh_token, updated_at, linked_target_email",
        )
        .eq("owner_user_id", ownerUserId)
        .eq("target_user_id", targetUserId)
        .maybeSingle(),
      adminSupabase
        .from("user_sessions_vault")
        .select(
          "owner_user_id, target_user_id, encrypted_refresh_token, updated_at, linked_target_email",
        )
        .eq("owner_user_id", targetUserId)
        .eq("target_user_id", ownerUserId)
        .maybeSingle(),
    ]);

  const rollbackVaultPair = async () => {
    const restoreOne = async (
      ownerId: string,
      targetId: string,
      previous: {
        owner_user_id: string;
        target_user_id: string;
        encrypted_refresh_token: string;
        updated_at: string | null;
        linked_target_email?: string | null;
      } | null,
    ) => {
      if (previous) {
        const row: Record<string, unknown> = {
          owner_user_id: previous.owner_user_id,
          target_user_id: previous.target_user_id,
          encrypted_refresh_token: previous.encrypted_refresh_token,
          updated_at: previous.updated_at ?? new Date().toISOString(),
        };
        if (previous.linked_target_email !== undefined) {
          row.linked_target_email = previous.linked_target_email;
        }
        await adminSupabase
          .from("user_sessions_vault")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .upsert(row as any, { onConflict: "owner_user_id,target_user_id" });
        return;
      }
      await adminSupabase
        .from("user_sessions_vault")
        .delete()
        .eq("owner_user_id", ownerId)
        .eq("target_user_id", targetId);
    };

    await restoreOne(ownerUserId, targetUserId, existingForward ?? null);
    await restoreOne(targetUserId, ownerUserId, existingReverse ?? null);
  };

  const forwardRow: Record<string, unknown> = {
    owner_user_id: ownerUserId,
    target_user_id: targetUserId,
    encrypted_refresh_token: encryptedTargetToken,
    updated_at: new Date().toISOString(),
  };
  if (options?.linkedTargetEmail) {
    forwardRow.linked_target_email = options.linkedTargetEmail;
  }

  const { error: vaultError1 } = await adminSupabase
    .from("user_sessions_vault")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(forwardRow as any, { onConflict: "owner_user_id,target_user_id" });

  if (vaultError1) {
    console.error("[vault] forward link error:", vaultError1);
    await rollbackVaultPair().catch((e) =>
      console.error("[vault] rollback after forward error:", e),
    );
    return { ok: false, error: "Failed to store session link" };
  }

  const { error: vaultError2 } = await adminSupabase
    .from("user_sessions_vault")
    .upsert(
      {
        owner_user_id: targetUserId,
        target_user_id: ownerUserId,
        encrypted_refresh_token: encryptedOwnerToken,
        updated_at: new Date().toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      { onConflict: "owner_user_id,target_user_id" },
    );

  if (vaultError2) {
    console.error("[vault] reverse link error:", vaultError2);
    await rollbackVaultPair().catch((e) =>
      console.error("[vault] rollback after reverse error:", e),
    );
    return { ok: false, error: "Failed to store session link" };
  }

  return { ok: true };
}
