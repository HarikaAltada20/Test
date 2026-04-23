import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "@/lib/encryption";

const MAX_LINKED_ACCOUNTS = 5;
const MAX_POOL_MEMBERS = MAX_LINKED_ACCOUNTS + 1;
const VAULT_CONFLICT_KEY = "owner_user_id,target_user_id";

type VaultSnapshotRow = {
  owner_user_id: string;
  target_user_id: string;
  encrypted_refresh_token: string;
  updated_at: string | null;
  linked_target_email?: string | null;
};

/**
 * Bidirectional vault upsert for account switching (owner ↔ target).
 * Forward row stores target's refresh; reverse row stores owner's refresh.
 */
export async function upsertBidirectionalVaultLinks(
  adminSupabase: SupabaseClient,
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

  // Final safety check against max-account races. If concurrent link attempts
  // push this owner above the allowed limit, rollback this pair.
  const { count: ownerLinkCount, error: ownerCountErr } = await adminSupabase
    .from("user_sessions_vault")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", ownerUserId);

  if (!ownerCountErr && (ownerLinkCount ?? 0) > 5) {
    await rollbackVaultPair().catch((e) =>
      console.error("[vault] rollback after max-limit race:", e),
    );
    return { ok: false, error: "Maximum account limit reached (5 accounts)." };
  }

  return { ok: true };
}

function pairKey(ownerId: string, targetId: string): string {
  return `${ownerId}::${targetId}`;
}

export async function linkAccountIntoSharedPool(
  adminSupabase: SupabaseClient,
  ownerUserId: string,
  targetUserId: string,
  ownerRefreshPlain: string,
  targetRefreshPlain: string,
  options?: { linkedTargetEmail?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: ownerRows, error: ownerRowsErr } = await adminSupabase
    .from("user_sessions_vault")
    .select("target_user_id, encrypted_refresh_token, linked_target_email")
    .eq("owner_user_id", ownerUserId);

  if (ownerRowsErr) {
    console.error("[vault/shared] owner rows fetch failed:", ownerRowsErr);
    return { ok: false, error: "Failed to load existing linked accounts" };
  }

  const tokenByUserId = new Map<string, string>();
  tokenByUserId.set(ownerUserId, ownerRefreshPlain);
  tokenByUserId.set(targetUserId, targetRefreshPlain);

  const emailHintByUserId = new Map<string, string | null>();
  if (options?.linkedTargetEmail) {
    emailHintByUserId.set(targetUserId, options.linkedTargetEmail);
  }

  for (const row of ownerRows ?? []) {
    const rowTargetId = row.target_user_id as string;
    if (!rowTargetId || rowTargetId === targetUserId) continue;
    try {
      tokenByUserId.set(
        rowTargetId,
        decrypt(row.encrypted_refresh_token as string),
      );
    } catch (e) {
      console.error("[vault/shared] decrypt existing token failed:", e);
      return {
        ok: false,
        error:
          "One linked account needs re-link before adding another account to the shared pool",
      };
    }
    const hint = (row.linked_target_email as string | null | undefined) ?? null;
    if (hint && !emailHintByUserId.has(rowTargetId)) {
      emailHintByUserId.set(rowTargetId, hint);
    }
  }

  const memberIds = Array.from(tokenByUserId.keys());
  if (memberIds.length > MAX_POOL_MEMBERS) {
    return {
      ok: false,
      error:
        "Maximum account limit reached (5 accounts). Remove an existing account to add a new one.",
    };
  }

  const { data: memberOwnerRows, error: memberOwnerRowsErr } = await adminSupabase
    .from("user_sessions_vault")
    .select("owner_user_id, target_user_id")
    .in("owner_user_id", memberIds);

  if (memberOwnerRowsErr) {
    console.error("[vault/shared] member row fetch failed:", memberOwnerRowsErr);
    return { ok: false, error: "Failed to validate linked account limits" };
  }

  const outsideCounts = new Map<string, number>();
  for (const memberId of memberIds) outsideCounts.set(memberId, 0);
  for (const row of memberOwnerRows ?? []) {
    const owner = row.owner_user_id as string;
    const target = row.target_user_id as string;
    if (!outsideCounts.has(owner)) continue;
    if (memberIds.includes(target)) continue;
    outsideCounts.set(owner, (outsideCounts.get(owner) ?? 0) + 1);
  }

  const poolLinksPerOwner = memberIds.length - 1;
  for (const memberId of memberIds) {
    if ((outsideCounts.get(memberId) ?? 0) + poolLinksPerOwner > MAX_LINKED_ACCOUNTS) {
      return {
        ok: false,
        error:
          "One linked account is already at the maximum limit. Unlink an account from that profile and try again.",
      };
    }
  }

  const { data: existingPoolRows, error: existingPoolRowsErr } = await adminSupabase
    .from("user_sessions_vault")
    .select(
      "owner_user_id, target_user_id, encrypted_refresh_token, updated_at, linked_target_email",
    )
    .in("owner_user_id", memberIds)
    .in("target_user_id", memberIds);

  if (existingPoolRowsErr) {
    console.error("[vault/shared] existing pool fetch failed:", existingPoolRowsErr);
    return { ok: false, error: "Failed to prepare account-link update" };
  }

  const snapshot = (existingPoolRows ?? []).filter(
    (row) => row.owner_user_id !== row.target_user_id,
  ) as VaultSnapshotRow[];

  const snapshotKeys = new Set(
    snapshot.map((row) => pairKey(row.owner_user_id, row.target_user_id)),
  );

  const now = new Date().toISOString();
  const upsertRows: Record<string, unknown>[] = [];
  for (const ownerId of memberIds) {
    for (const toId of memberIds) {
      if (ownerId === toId) continue;
      const targetToken = tokenByUserId.get(toId);
      if (!targetToken) {
        return { ok: false, error: "Failed to build shared account switch pool" };
      }
      const row: Record<string, unknown> = {
        owner_user_id: ownerId,
        target_user_id: toId,
        encrypted_refresh_token: encrypt(targetToken),
        updated_at: now,
      };
      const emailHint = emailHintByUserId.get(toId);
      if (emailHint) row.linked_target_email = emailHint;
      upsertRows.push(row);
    }
  }

  const rollbackSharedPool = async () => {
    if (snapshot.length > 0) {
      await adminSupabase
        .from("user_sessions_vault")
        .upsert(snapshot, { onConflict: VAULT_CONFLICT_KEY });
    }
    for (const ownerId of memberIds) {
      for (const toId of memberIds) {
        if (ownerId === toId) continue;
        const key = pairKey(ownerId, toId);
        if (snapshotKeys.has(key)) continue;
        await adminSupabase
          .from("user_sessions_vault")
          .delete()
          .eq("owner_user_id", ownerId)
          .eq("target_user_id", toId);
      }
    }
  };

  const { error: upsertPoolErr } = await adminSupabase
    .from("user_sessions_vault")
    .upsert(upsertRows, { onConflict: VAULT_CONFLICT_KEY });

  if (upsertPoolErr) {
    console.error("[vault/shared] upsert failed:", upsertPoolErr);
    await rollbackSharedPool().catch((e) =>
      console.error("[vault/shared] rollback failed:", e),
    );
    return { ok: false, error: "Failed to store session link" };
  }

  return { ok: true };
}
