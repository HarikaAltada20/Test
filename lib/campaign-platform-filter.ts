import { PLATFORMS } from "@/constants/platforms";

export const CAMPAIGN_FILTER_PLATFORMS = [
  "youtube",
  "instagram",
  "tiktok",
  "twitter",
] as const;

export type CampaignFilterPlatform =
  (typeof CAMPAIGN_FILTER_PLATFORMS)[number];

export const CAMPAIGN_FILTER_PLATFORM_LABELS: Record<
  CampaignFilterPlatform,
  string
> = {
  youtube: PLATFORMS.youtube.displayName,
  instagram: PLATFORMS.instagram.displayName,
  tiktok: PLATFORMS.tiktok.displayName,
  twitter: "Twitter",
};

function canonicalizePlatformToken(token: string): CampaignFilterPlatform | null {
  const normalized = token.toLowerCase().trim();
  if (!normalized) return null;
  if (normalized === "x" || normalized === "twitter" || normalized.startsWith("twitter")) {
    return "twitter";
  }
  const match = CAMPAIGN_FILTER_PLATFORMS.find(
    (platform) =>
      platform !== "twitter" &&
      (normalized === platform || normalized.includes(platform)),
  );
  return match ?? null;
}

/** Split contest.platform CSV (and aliases) into individual filter tokens. */
export function parseCampaignPlatformTokens(
  platform: string | null | undefined,
): CampaignFilterPlatform[] {
  const raw = (platform ?? "").toLowerCase().trim();
  if (!raw || raw === "all") return [];

  const tokens = raw
    .split(/[,+/|&]+|\band\b/)
    .map((token) => token.trim())
    .filter(Boolean);

  const ordered: CampaignFilterPlatform[] = [];
  for (const token of tokens) {
    const match = canonicalizePlatformToken(token);
    if (match && !ordered.includes(match)) ordered.push(match);
  }
  return ordered;
}

export function expandAvailableCampaignPlatforms(
  values: string[] | null | undefined,
): string[] {
  const seen = new Set<CampaignFilterPlatform>();
  for (const value of values ?? []) {
    if (!value || value === "all") continue;
    for (const token of parseCampaignPlatformTokens(value)) {
      seen.add(token);
    }
  }

  const platforms = CAMPAIGN_FILTER_PLATFORMS.filter((platform) =>
    seen.has(platform),
  );
  return ["all", ...platforms];
}

export function campaignPlatformsForMediaType(
  mediaType: "all" | "text" | "media" | string | undefined,
): CampaignFilterPlatform[] {
  if (mediaType === "text") return ["twitter"];
  if (mediaType === "media") return ["youtube", "instagram", "tiktok"];
  return [...CAMPAIGN_FILTER_PLATFORMS];
}

/** "all" or a canonical CSV such as "instagram,youtube". */
export function normalizeCampaignPlatformFilter(
  raw: string | null | undefined,
  available: readonly CampaignFilterPlatform[] = CAMPAIGN_FILTER_PLATFORMS,
): string {
  const allowed = CAMPAIGN_FILTER_PLATFORMS.filter((platform) =>
    available.includes(platform),
  );
  if (allowed.length === 0) return "all";

  const rawValue = (raw ?? "").trim();
  if (!rawValue || rawValue === "all") return "all";

  const selected = parseCampaignPlatformTokens(rawValue).filter((platform) =>
    allowed.includes(platform),
  );
  if (selected.length === 0) return "all";
  if (selected.length === allowed.length) return "all";

  return CAMPAIGN_FILTER_PLATFORMS.filter((platform) =>
    selected.includes(platform),
  ).join(",");
}

export function selectedCampaignPlatforms(
  filter: string | null | undefined,
  available: readonly CampaignFilterPlatform[] = CAMPAIGN_FILTER_PLATFORMS,
): CampaignFilterPlatform[] {
  const normalized = normalizeCampaignPlatformFilter(filter, available);
  if (normalized === "all") return [...available];
  return parseCampaignPlatformTokens(normalized);
}

export function campaignMatchesPlatformFilter(
  contestPlatform: string | null | undefined,
  filter: string | null | undefined,
): boolean {
  const normalized = normalizeCampaignPlatformFilter(filter);
  if (normalized === "all") return true;
  const wanted = new Set(parseCampaignPlatformTokens(normalized));
  return parseCampaignPlatformTokens(contestPlatform).some((platform) =>
    wanted.has(platform),
  );
}

export function campaignPlatformFilterLabel(
  filter: string | null | undefined,
  available: readonly CampaignFilterPlatform[] = CAMPAIGN_FILTER_PLATFORMS,
): string {
  const normalized = normalizeCampaignPlatformFilter(filter, available);
  if (normalized === "all") return "All Platforms";
  return parseCampaignPlatformTokens(normalized)
    .map((platform) => CAMPAIGN_FILTER_PLATFORM_LABELS[platform])
    .join(", ");
}

export function toggleCampaignPlatformFilter(
  current: string | null | undefined,
  platform: CampaignFilterPlatform | "all",
  available: readonly CampaignFilterPlatform[] = CAMPAIGN_FILTER_PLATFORMS,
): string {
  if (platform === "all") return "all";
  if (!available.includes(platform)) {
    return normalizeCampaignPlatformFilter(current, available);
  }

  const normalized = normalizeCampaignPlatformFilter(current, available);
  const selected = new Set(
    normalized === "all" ? [] : parseCampaignPlatformTokens(normalized),
  );

  if (normalized === "all") {
    return platform;
  }

  if (selected.has(platform)) selected.delete(platform);
  else selected.add(platform);

  return normalizeCampaignPlatformFilter(
    CAMPAIGN_FILTER_PLATFORMS.filter((item) => selected.has(item)).join(","),
    available,
  );
}

export function postgrestPlatformOrFilter(
  filter: string | null | undefined,
): string | null {
  const normalized = normalizeCampaignPlatformFilter(filter);
  if (normalized === "all") return null;

  const clauses = parseCampaignPlatformTokens(normalized).flatMap((platform) => {
    if (platform === "twitter") {
      return ["platform.ilike.%twitter%", "platform.eq.x"];
    }
    return [`platform.ilike.%${platform}%`];
  });

  return clauses.length > 0 ? clauses.join(",") : null;
}
