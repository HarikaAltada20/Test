/**
 * Database and storage side of "Copy an existing campaign".
 *
 * Who may copy what is decided here, never by row-level security: brands can
 * read other brands' published campaigns through RLS, so "readable" is not
 * "owned". Everything below uses the service client after these checks.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CampaignAccessError,
  fetchAllRows,
  isMissingColumnError,
  WRITE_BATCH_SIZE,
  type AccessActor,
} from "@/lib/campaign-access-server";
import { isUuid } from "@/lib/campaign-access";
import {
  defaultDuplicateTitle,
  isDuplicateSectionKey,
  resolveSectionSelection,
  shiftDuplicateDates,
  type DuplicatePreview,
  type DuplicateRequest,
  type DuplicateResult,
  type DuplicateSavedListOption,
  type DuplicateSectionKey,
  type DuplicateSourceCard,
  type DuplicateWarning,
} from "@/lib/campaign-duplicate";
import {
  availableSections,
  buildDuplicateRow,
  CONTEST_ASSETS_BUCKET,
  getDuplicateFacts,
  planAssetCopies,
  planWarnings,
  rewriteAssetUrls,
  sanitizeSearchTerm,
} from "@/lib/campaign-duplicate-server";
import { getPlanByName, getPlanByProductId, PRODUCT_IDS } from "@/constants/subscriptionPlans";
import { invalidateCampaignListCachesAfterMutation } from "@/lib/campaign-list-cache";

type Row = Record<string, unknown>;

export const SOURCE_NOT_FOUND = "This campaign no longer exists or you can't copy it.";

const CARD_COLUMNS =
  "id, title, thumbnail_url, moderation_status, status, contest_type, contest_format, platform, access_mode, created_at, advertiser_id";

// ---------------------------------------------------------------------------
// Who may copy what
// ---------------------------------------------------------------------------

/** The full source row. Brands only ever get their own campaigns (404 otherwise). */
export async function loadDuplicateSource(
  admin: SupabaseClient,
  actor: AccessActor,
  sourceId: unknown,
): Promise<Row> {
  if (!isUuid(sourceId)) throw new CampaignAccessError(SOURCE_NOT_FOUND, 404);
  const { data, error } = await admin
    .from("contests")
    .select("*")
    .eq("id", sourceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new CampaignAccessError(SOURCE_NOT_FOUND, 404);
  if (!actor.isAdmin && data.advertiser_id !== actor.userId) {
    // Same answer as a missing campaign, so IDs can't be probed.
    throw new CampaignAccessError(SOURCE_NOT_FOUND, 404);
  }
  return data as Row;
}

/** Brands always copy into their own account; admins name a brand (default: the source's). */
export async function resolveDuplicateTarget(
  admin: SupabaseClient,
  actor: AccessActor,
  requested: unknown,
  source: Row,
): Promise<{ advertiserId: string; brandName: string | null }> {
  const advertiserId = actor.isAdmin
    ? isUuid(requested)
      ? requested
      : (source.advertiser_id as string)
    : actor.userId;
  const [{ data: user, error: userError }, { data: profile, error: profileError }] =
    await Promise.all([
      admin.from("users").select("id, user_type").eq("id", advertiserId).maybeSingle(),
      admin
        .from("advertiser_profiles")
        .select("id, company_name")
        .eq("id", advertiserId)
        .maybeSingle(),
    ]);
  if (userError) throw userError;
  if (profileError) throw profileError;
  if (!user || user.user_type !== "advertiser" || !profile) {
    throw new CampaignAccessError("Brand not found", 404);
  }
  return { advertiserId, brandName: profile.company_name?.trim() || null };
}

// ---------------------------------------------------------------------------
// Reading the source
// ---------------------------------------------------------------------------

type AccessRow = {
  user_id: string;
  source: string;
  source_allowlist_id: string | null;
};

async function loadSourceAccessRows(admin: SupabaseClient, sourceId: string): Promise<AccessRow[]> {
  return fetchAllRows<AccessRow>(() =>
    admin
      .from("contest_access_list")
      .select("user_id, source, source_allowlist_id")
      .eq("contest_id", sourceId)
      .in("source", ["manual", "saved_list"])
      .order("user_id"),
  );
}

type InviteGroups = {
  lists: Map<string, { name: string; advertiserId: string; userIds: string[] }>;
  manual: string[];
};

/**
 * Invited creators on the source, by saved list. Rows whose list was deleted
 * count as added individually. Invite-link joins, approved applications and
 * existing submitters came from the live campaign and are never copied.
 */
async function loadInviteGroups(admin: SupabaseClient, sourceId: string): Promise<InviteGroups> {
  const rows = await loadSourceAccessRows(admin, sourceId);
  const listIds = Array.from(
    new Set(rows.map((r) => r.source_allowlist_id).filter((id): id is string => !!id)),
  );
  const listInfo = new Map<string, { name: string; advertiserId: string }>();
  if (listIds.length > 0) {
    const { data, error } = await admin
      .from("brand_allowlists")
      .select("id, name, advertiser_id")
      .in("id", listIds);
    if (error) throw error;
    for (const l of data || []) {
      listInfo.set(l.id, { name: l.name, advertiserId: l.advertiser_id });
    }
  }
  const groups: InviteGroups = { lists: new Map(), manual: [] };
  for (const r of rows) {
    const info =
      r.source === "saved_list" && r.source_allowlist_id
        ? listInfo.get(r.source_allowlist_id)
        : undefined;
    if (info && r.source_allowlist_id) {
      const g = groups.lists.get(r.source_allowlist_id) ?? { ...info, userIds: [] };
      g.userIds.push(r.user_id);
      groups.lists.set(r.source_allowlist_id, g);
    } else {
      groups.manual.push(r.user_id);
    }
  }
  return groups;
}

async function countQuestions(admin: SupabaseClient, sourceId: string): Promise<number> {
  const { count, error } = await admin
    .from("contest_application_questions")
    .select("id", { count: "exact", head: true })
    .eq("contest_id", sourceId);
  if (error) throw error;
  return count ?? 0;
}

async function loadTargetPlan(admin: SupabaseClient, advertiserId: string) {
  const { data } = await admin
    .from("advertiser_profiles")
    .select("subscription_info")
    .eq("id", advertiserId)
    .maybeSingle();
  const info = data?.subscription_info as { product_id?: string } | null | undefined;
  const plan =
    getPlanByProductId(info?.product_id ?? PRODUCT_IDS.EXPLORER) ?? getPlanByName("EXPLORER");
  return plan ?? null;
}

async function loadBrandName(admin: SupabaseClient, advertiserId: string): Promise<string | null> {
  const { data } = await admin
    .from("advertiser_profiles")
    .select("company_name")
    .eq("id", advertiserId)
    .maybeSingle();
  return data?.company_name?.trim() || null;
}

async function loadStatus(admin: SupabaseClient, sourceId: string): Promise<string | null> {
  const { data } = await admin
    .from("contests_with_status")
    .select("status")
    .eq("id", sourceId)
    .maybeSingle();
  return (data?.status as string | null) ?? null;
}

function toCard(source: Row, brandName: string | null, status: string | null): DuplicateSourceCard {
  return {
    id: source.id as string,
    title: (source.title as string) || "",
    thumbnail_url: (source.thumbnail_url as string | null) ?? null,
    moderation_status: (source.moderation_status as string) || "draft",
    status,
    contest_type: (source.contest_type as string | null) ?? null,
    contest_format: (source.contest_format as string | null) ?? null,
    platform: (source.platform as string | null) ?? null,
    access_mode: (source.access_mode as string | null) ?? null,
    created_at: source.created_at as string,
    advertiser_id: source.advertiser_id as string,
    brand_name: brandName,
  };
}

// ---------------------------------------------------------------------------
// Preview (what the dialog shows before creating)
// ---------------------------------------------------------------------------

export async function buildDuplicatePreview(
  admin: SupabaseClient,
  actor: AccessActor,
  sourceId: unknown,
  requestedTarget: unknown,
): Promise<DuplicatePreview> {
  const source = await loadDuplicateSource(admin, actor, sourceId);
  const target = await resolveDuplicateTarget(admin, actor, requestedTarget, source);
  const sourceIdStr = source.id as string;
  const [groups, questionCount, plan, sourceBrand, status] = await Promise.all([
    loadInviteGroups(admin, sourceIdStr),
    countQuestions(admin, sourceIdStr),
    loadTargetPlan(admin, target.advertiserId),
    loadBrandName(admin, source.advertiser_id as string),
    loadStatus(admin, sourceIdStr),
  ]);
  const facts = getDuplicateFacts(source);
  const inviteCount =
    groups.manual.length +
    Array.from(groups.lists.values()).reduce((n, g) => n + g.userIds.length, 0);
  const crossBrand = target.advertiserId !== source.advertiser_id;

  const savedLists: DuplicateSavedListOption[] = Array.from(groups.lists.entries())
    .map(([id, g]) => ({ id, name: g.name, creator_count: g.userIds.length }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const warnings: DuplicateWarning[] = planWarnings(
    source,
    plan ? plan.features : null,
    plan ? plan.displayName : null,
  );
  if (crossBrand) {
    warnings.push({
      code: "cross_brand",
      message: `You're copying a campaign from ${sourceBrand || "another brand"} into ${
        target.brandName || "this brand"
      }. Check the brief and thumbnail for the original brand's name.`,
    });
  }
  if (source.payment_details) {
    warnings.push({
      code: "paid_source",
      message: "The original was paid. Payment is not copied; the new draft is paid when you submit it.",
    });
  }

  return {
    source: toCard(source, sourceBrand, status),
    target: { advertiser_id: target.advertiserId, brand_name: target.brandName },
    crossBrand,
    facts,
    available: availableSections(source, { questions: questionCount, invites: inviteCount }),
    savedLists,
    manualInviteCount: groups.manual.length,
    questionCount,
    warnings,
    defaultTitle: defaultDuplicateTitle(source.title as string | null),
    datesPassed: shiftDuplicateDates(
      source.start_date as string | null,
      source.end_date as string | null,
    ).shifted,
  };
}

// ---------------------------------------------------------------------------
// Source search
// ---------------------------------------------------------------------------

export const DUPLICATE_SOURCES_PAGE_SIZE = 20;

export async function searchDuplicateSources(
  admin: SupabaseClient,
  actor: AccessActor,
  params: { q?: string | null; advertiserId?: string | null; offset?: number },
): Promise<{ items: DuplicateSourceCard[]; hasMore: boolean }> {
  const offset = Math.max(0, Math.floor(params.offset ?? 0));
  const rawQ = (params.q ?? "").trim();
  const q = sanitizeSearchTerm(rawQ);

  let query = admin
    .from("contests_with_status")
    .select(CARD_COLUMNS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (!actor.isAdmin) {
    query = query.eq("advertiser_id", actor.userId);
  } else if (isUuid(params.advertiserId)) {
    query = query.eq("advertiser_id", params.advertiserId);
  }

  if (rawQ) {
    if (isUuid(rawQ)) {
      query = query.eq("id", rawQ);
    } else if (q) {
      const filters = [`title.ilike.%${q}%`];
      if (actor.isAdmin && !isUuid(params.advertiserId)) {
        const { data: brands, error } = await admin
          .from("advertiser_profiles")
          .select("id")
          .ilike("company_name", `%${q}%`)
          .limit(50);
        if (error) throw error;
        const ids = (brands || []).map((b) => b.id).filter(isUuid);
        if (ids.length > 0) filters.push(`advertiser_id.in.(${ids.join(",")})`);
      }
      query = query.or(filters.join(","));
    }
  }

  const { data, error } = await query.range(offset, offset + DUPLICATE_SOURCES_PAGE_SIZE);
  if (error) throw error;
  const rows = (data || []) as Row[];
  const page = rows.slice(0, DUPLICATE_SOURCES_PAGE_SIZE);

  const brandIds = Array.from(new Set(page.map((r) => r.advertiser_id as string)));
  const names = new Map<string, string | null>();
  if (brandIds.length > 0) {
    const { data: profiles, error: profileError } = await admin
      .from("advertiser_profiles")
      .select("id, company_name")
      .in("id", brandIds);
    if (profileError) throw profileError;
    for (const p of profiles || []) names.set(p.id, p.company_name?.trim() || null);
  }

  return {
    items: page.map((r) =>
      toCard(r, names.get(r.advertiser_id as string) ?? null, (r.status as string | null) ?? null),
    ),
    hasMore: rows.length > DUPLICATE_SOURCES_PAGE_SIZE,
  };
}

// ---------------------------------------------------------------------------
// Creating the copy
// ---------------------------------------------------------------------------

export function parseDuplicateRequest(body: unknown): DuplicateRequest {
  if (!body || typeof body !== "object") {
    throw new CampaignAccessError("Invalid request", 400);
  }
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.sections)) {
    throw new CampaignAccessError("sections must be a list", 400);
  }
  const sections: DuplicateSectionKey[] = [];
  for (const s of b.sections) {
    if (!isDuplicateSectionKey(s)) {
      throw new CampaignAccessError(`Unknown section: ${String(s).slice(0, 40)}`, 400);
    }
    if (!sections.includes(s)) sections.push(s);
  }
  if (b.title !== undefined && b.title !== null && typeof b.title !== "string") {
    throw new CampaignAccessError("title must be text", 400);
  }
  if (b.savedListIds !== undefined && !Array.isArray(b.savedListIds)) {
    throw new CampaignAccessError("savedListIds must be a list", 400);
  }
  const savedListIds = ((b.savedListIds as unknown[]) ?? []).filter(isUuid);
  if (savedListIds.length > 100) {
    throw new CampaignAccessError("Too many saved lists", 400);
  }
  return {
    sourceContestId: b.sourceContestId as string,
    targetAdvertiserId: (b.targetAdvertiserId as string | null | undefined) ?? null,
    sections,
    title: (b.title as string | null | undefined) ?? null,
    savedListIds: Array.from(new Set(savedListIds)),
    includeManualInvites: b.includeManualInvites === true,
  };
}

async function copyQuestions(admin: SupabaseClient, sourceId: string, newId: string) {
  const { data, error } = await admin
    .from("contest_application_questions")
    .select("position, prompt, kind, options, required")
    .eq("contest_id", sourceId)
    .order("position")
    .order("created_at");
  if (error) throw error;
  const rows = (data || []).map((q, i) => ({
    contest_id: newId,
    position: i,
    prompt: q.prompt,
    kind: q.kind,
    options: q.options,
    required: q.required,
  }));
  if (rows.length === 0) return 0;
  const { error: insertError } = await admin.from("contest_application_questions").insert(rows);
  if (insertError) throw insertError;
  return rows.length;
}

async function creatorIdsOnly(admin: SupabaseClient, userIds: string[]): Promise<Set<string>> {
  const ok = new Set<string>();
  const CHUNK = 200;
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const { data, error } = await admin
      .from("users")
      .select("id")
      .in("id", userIds.slice(i, i + CHUNK))
      .eq("user_type", "creator");
    if (error) throw error;
    for (const u of data || []) ok.add(u.id);
  }
  return ok;
}

async function copyInvites(
  admin: SupabaseClient,
  params: {
    sourceId: string;
    newId: string;
    targetAdvertiserId: string;
    actorId: string;
    savedListIds: string[];
    includeManual: boolean;
  },
): Promise<number> {
  const groups = await loadInviteGroups(admin, params.sourceId);
  const byUser = new Map<string, { source: string; source_allowlist_id: string | null }>();
  for (const listId of params.savedListIds) {
    const g = groups.lists.get(listId);
    if (!g) continue;
    // A saved list stays with the brand that owns it; on another brand's
    // campaign its creators are invited directly instead.
    const sameBrand = g.advertiserId === params.targetAdvertiserId;
    for (const uid of g.userIds) {
      if (byUser.has(uid)) continue;
      byUser.set(uid, {
        source: sameBrand ? "saved_list" : "manual",
        source_allowlist_id: sameBrand ? listId : null,
      });
    }
  }
  if (params.includeManual) {
    for (const uid of groups.manual) {
      if (!byUser.has(uid)) byUser.set(uid, { source: "manual", source_allowlist_id: null });
    }
  }
  if (byUser.size === 0) return 0;
  const creators = await creatorIdsOnly(admin, Array.from(byUser.keys()));
  const rows = Array.from(byUser.entries())
    .filter(([uid]) => creators.has(uid))
    .map(([user_id, r]) => ({
      contest_id: params.newId,
      user_id,
      source: r.source,
      source_allowlist_id: r.source_allowlist_id,
      added_by: params.actorId,
    }));
  for (let i = 0; i < rows.length; i += WRITE_BATCH_SIZE) {
    const { error } = await admin
      .from("contest_access_list")
      .upsert(rows.slice(i, i + WRITE_BATCH_SIZE), {
        onConflict: "contest_id,user_id",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }
  return rows.length;
}

async function copyAssets(
  admin: SupabaseClient,
  plan: Map<string, string>,
): Promise<Map<string, string>> {
  const copied = new Map<string, string>();
  const storage = admin.storage.from(CONTEST_ASSETS_BUCKET);
  const entries = Array.from(plan.entries());
  const CONCURRENCY = 4;
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    await Promise.all(
      entries.slice(i, i + CONCURRENCY).map(async ([from, to]) => {
        const { error } = await storage.copy(from, to);
        if (error) {
          console.warn(`[campaign-duplicate] could not copy ${from}:`, error.message);
          return;
        }
        copied.set(from, to);
      }),
    );
  }
  return copied;
}

async function removeAssets(admin: SupabaseClient, paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await admin.storage.from(CONTEST_ASSETS_BUCKET).remove(paths);
  if (error) console.warn("[campaign-duplicate] cleanup of copied files failed:", error.message);
}

async function insertContest(admin: SupabaseClient, row: Row): Promise<void> {
  const { error } = await admin.from("contests").insert(row);
  if (!error) return;
  // Before the 20261023 migration the link column doesn't exist yet.
  if (isMissingColumnError(error) && "duplicated_from_contest_id" in row) {
    const { duplicated_from_contest_id: _ignored, ...rest } = row;
    const { error: retryError } = await admin.from("contests").insert(rest);
    if (!retryError) return;
    throw retryError;
  }
  throw error;
}

/**
 * Creates the new draft. Order: files first (the new id is chosen up front),
 * then the campaign row, then questions and invited creators. If any database
 * step fails, the new campaign is deleted (its questions and access rows go
 * with it) and the copied files are removed, so a half-made copy never stays.
 */
export async function duplicateCampaign(
  admin: SupabaseClient,
  actor: AccessActor,
  request: DuplicateRequest,
): Promise<DuplicateResult> {
  const source = await loadDuplicateSource(admin, actor, request.sourceContestId);
  const target = await resolveDuplicateTarget(admin, actor, request.targetAdvertiserId, source);
  const facts = getDuplicateFacts(source);
  const sourceId = source.id as string;

  const sections = resolveSectionSelection(request.sections, facts);
  const { row, warnings } = buildDuplicateRow({
    source,
    sections,
    targetAdvertiserId: target.advertiserId,
    title: request.title,
  });

  const newId = crypto.randomUUID();
  row.id = newId;
  row.duplicated_from_contest_id = sourceId;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const assetPlan = planAssetCopies(row, newId, supabaseUrl);
  const copied = await copyAssets(admin, assetPlan.copies);
  const storage = admin.storage.from(CONTEST_ASSETS_BUCKET);
  const rewritten = rewriteAssetUrls(
    row,
    supabaseUrl,
    copied,
    (path) => storage.getPublicUrl(path).data.publicUrl,
  );
  row.thumbnail_url = rewritten.thumbnail_url;
  row.resources = rewritten.resources;
  if (rewritten.missingThumbnail) {
    warnings.push({
      code: "thumbnail_missing",
      message: "The thumbnail couldn't be copied. Please upload one.",
    });
  }
  if (rewritten.missingResources > 0) {
    warnings.push({
      code: "resources_missing",
      message: `${rewritten.missingResources} file${
        rewritten.missingResources === 1 ? "" : "s"
      } couldn't be copied and ${rewritten.missingResources === 1 ? "was" : "were"} left out.`,
    });
  }

  const sectionSet = new Set(sections);
  try {
    await insertContest(admin, row);
    if (sectionSet.has("questions") && row.access_mode === "restricted") {
      await copyQuestions(admin, sourceId, newId);
    }
    if (sectionSet.has("invites") && row.access_mode !== "public") {
      await copyInvites(admin, {
        sourceId,
        newId,
        targetAdvertiserId: target.advertiserId,
        actorId: actor.userId,
        savedListIds: request.savedListIds ?? [],
        includeManual: request.includeManualInvites === true,
      });
    }
  } catch (err) {
    const { error: deleteError } = await admin.from("contests").delete().eq("id", newId);
    if (deleteError) {
      console.error("[campaign-duplicate] could not remove a failed copy:", deleteError.message);
    }
    await removeAssets(admin, Array.from(copied.values()));
    throw err;
  }

  try {
    await invalidateCampaignListCachesAfterMutation({
      advertiserId: target.advertiserId,
      touchOpportunities: false,
    });
  } catch (err) {
    console.warn("[campaign-duplicate] cache invalidation failed:", err);
  }

  return { id: newId, advertiserId: target.advertiserId, warnings };
}
