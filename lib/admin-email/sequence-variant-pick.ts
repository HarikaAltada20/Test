import { Redis } from "@upstash/redis";
import { createAdminClient } from "@/utils/supabase/admin";
import type { StoredVariant } from "./sequence-types";
import { sortVariantsByLetter } from "./sequence-store";

const RR_PREFIX = "admin_email:sequence_rr";

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  try {
    return Redis.fromEnv();
  } catch {
    return null;
  }
}

function sortActiveVariants(variants: StoredVariant[]): StoredVariant[] {
  return sortVariantsByLetter(variants.filter((v) => v.is_active));
}

/**
 * Assign variants evenly by each lead's position in the campaign recipient list.
 * Lead 1 → Variant A, Lead 2 → Variant B, etc. Stable across retries.
 */
export async function pickVariantByRecipientIndex(
  campaignId: string,
  userId: string,
  variants: StoredVariant[],
): Promise<StoredVariant> {
  const active = sortActiveVariants(variants);
  if (active.length === 0) {
    throw new Error("No active variants for step");
  }
  if (active.length === 1) return active[0];

  const db = createAdminClient();
  const { data: rows } = await db
    .from("admin_email_campaign_recipients")
    .select("user_id")
    .eq("campaign_id", campaignId)
    .order("user_id", { ascending: true });

  const ordered = (rows ?? []).map((row) => row.user_id);
  const index = ordered.indexOf(userId);
  if (index < 0) return active[0];
  return active[index % active.length];
}

/** Round-robin variant pick per step (Redis counter), falls back to Variant A. */
export async function pickVariantRoundRobin(
  stepId: string,
  variants: StoredVariant[],
): Promise<StoredVariant> {
  const active = sortActiveVariants(variants);
  if (active.length === 0) {
    throw new Error("No active variants for step");
  }
  if (active.length === 1) return active[0];

  const redis = getRedis();
  if (redis) {
    try {
      const key = `${RR_PREFIX}:${stepId}`;
      const counter = await redis.incr(key);
      const index = Number(counter) - 1;
      return active[index % active.length];
    } catch (err) {
      console.warn("[admin-email] variant round-robin Redis failed:", err);
    }
  }

  return active[0];
}
