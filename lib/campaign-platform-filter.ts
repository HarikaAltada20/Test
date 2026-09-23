import { PLATFORMS } from "@/constants/platforms";

export const CAMPAIGN_FILTER_PLATFORMS = [
  "youtube",
  "instagram",
  "tiktok",
  "twitter",
] as const;

export const MULTIPLE_CAMPAIGN_FILTER_PLATFORMS = [
  "youtube",
  "instagram",
  "tiktok",
] as const;

export type CampaignFilterPlatform =
  (typeof CAMPAIGN_FILTER_PLATFORMS)[number];

export const CAMPAIGN_PLATFORM_MATCH_MODES = ["single", "multiple"] as const;
export type CampaignPlatformMatchMode =
  (typeof CAMPAIGN_PLATFORM_MATCH_MODES)[number];

const MULTIPLE_PLATFORM_FILTER_PREFIX = "multiple:";
const SINGLE_PLATFORM_FILTER_PREFIX = "single:";
const ALL_MULTIPLE_PLATFORMS = MULTIPLE_CAMPAIGN_FILTER_PLATFORMS.join(",");

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
  const raw = platformFilterSelectionValue(platform);
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

function platformFilterSelectionValue(
  filter: string | null | undefined,
): string {
  const raw = (filter ?? "").toLowerCase().trim();
  if (raw.startsWith(MULTIPLE_PLATFORM_FILTER_PREFIX)) {
    return raw.slice(MULTIPLE_PLATFORM_FILTER_PREFIX.length).trim();
  }
  if (raw.startsWith(SINGLE_PLATFORM_FILTER_PREFIX)) {
    return raw.slice(SINGLE_PLATFORM_FILTER_PREFIX.length).trim();
  }
  return raw;
}

export function campaignPlatformMatchMode(
  filter: string | null | undefined,
): CampaignPlatformMatchMode {
  return (filter ?? "").toLowerCase().trim().startsWith(
    MULTIPLE_PLATFORM_FILTER_PREFIX,
  )
    ? "multiple"
    : "single";
}

function serializeCampaignPlatformFilter(
  mode: CampaignPlatformMatchMode,
  selection: string,
): string {
  if (mode === "multiple") {
    return `${MULTIPLE_PLATFORM_FILTER_PREFIX}${selection || "all"}`;
  }
  return selection || "all";
}

export function isAllCampaignPlatformFilter(
  filter: string | null | undefined,
): boolean {
  const value = platformFilterSelectionValue(filter);
  return (
    campaignPlatformMatchMode(filter) === "single" &&
    (!value || value === "all")
  );
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

/** Normalize global, single-platform, and exact multi-platform selections. */
export function normalizeCampaignPlatformFilter(
  raw: string | null | undefined,
  available: readonly CampaignFilterPlatform[] = CAMPAIGN_FILTER_PLATFORMS,
): string {
  const mode = campaignPlatformMatchMode(raw);
  const allowed: readonly CampaignFilterPlatform[] =
    mode === "multiple"
      ? MULTIPLE_CAMPAIGN_FILTER_PLATFORMS
      : CAMPAIGN_FILTER_PLATFORMS.filter((platform) =>
          available.includes(platform),
        );
  if (allowed.length === 0) {
    return "all";
  }

  const rawValue = platformFilterSelectionValue(raw);
  if (!rawValue || rawValue === "all") {
    return mode === "multiple"
      ? serializeCampaignPlatformFilter(mode, ALL_MULTIPLE_PLATFORMS)
      : "all";
  }

  const selected = parseCampaignPlatformTokens(rawValue).filter((platform) =>
    allowed.includes(platform),
  );
  if (selected.length < (mode === "multiple" ? 2 : 1)) {
    return mode === "multiple"
      ? serializeCampaignPlatformFilter(mode, ALL_MULTIPLE_PLATFORMS)
      : "all";
  }

  const selection = CAMPAIGN_FILTER_PLATFORMS.filter((platform) =>
    selected.includes(platform),
  ).join(",");
  return serializeCampaignPlatformFilter(mode, selection);
}

export function selectedCampaignPlatforms(
  filter: string | null | undefined,
  available: readonly CampaignFilterPlatform[] = CAMPAIGN_FILTER_PLATFORMS,
): CampaignFilterPlatform[] {
  const normalized = normalizeCampaignPlatformFilter(filter, available);
  if (isAllCampaignPlatformFilter(normalized)) return [...available];
  return parseCampaignPlatformTokens(normalized);
}

export function isCampaignPlatformSelected(
  filter: string | null | undefined,
  platform: CampaignFilterPlatform,
  available: readonly CampaignFilterPlatform[] = CAMPAIGN_FILTER_PLATFORMS,
): boolean {
  const normalized = normalizeCampaignPlatformFilter(filter, available);
  return (
    !isAllCampaignPlatformFilter(normalized) &&
    parseCampaignPlatformTokens(normalized).includes(platform)
  );
}

export function setCampaignPlatformMatchMode(
  filter: string | null | undefined,
  mode: CampaignPlatformMatchMode,
  available: readonly CampaignFilterPlatform[] = CAMPAIGN_FILTER_PLATFORMS,
): string {
  const normalized = normalizeCampaignPlatformFilter(filter, available);
  if (mode === "multiple") {
    const selected = parseCampaignPlatformTokens(normalized).filter((platform) =>
      MULTIPLE_CAMPAIGN_FILTER_PLATFORMS.some(
        (candidate) => candidate === platform,
      ),
    );
    return normalizeCampaignPlatformFilter(
      serializeCampaignPlatformFilter(
        mode,
        selected.length >= 2 ? selected.join(",") : ALL_MULTIPLE_PLATFORMS,
      ),
      available,
    );
  }
  if (isAllCampaignPlatformFilter(normalized)) {
    return "all";
  }
  return normalizeCampaignPlatformFilter(
    serializeCampaignPlatformFilter(
      mode,
      parseCampaignPlatformTokens(normalized).join(","),
    ),
    available,
  );
}

export function campaignMatchesPlatformFilter(
  contestPlatform: string | null | undefined,
  filter: string | null | undefined,
): boolean {
  const normalized = normalizeCampaignPlatformFilter(filter);
  if (isAllCampaignPlatformFilter(normalized)) return true;
  const wanted = new Set(parseCampaignPlatformTokens(normalized));
  const campaignPlatforms = parseCampaignPlatformTokens(contestPlatform);
  if (campaignPlatformMatchMode(normalized) === "multiple") {
    return (
      campaignPlatforms.length === wanted.size &&
      campaignPlatforms.every((platform) => wanted.has(platform))
    );
  }
  return campaignPlatforms.length === 1 && wanted.has(campaignPlatforms[0]!);
}

export function campaignPlatformFilterLabel(
  filter: string | null | undefined,
  available: readonly CampaignFilterPlatform[] = CAMPAIGN_FILTER_PLATFORMS,
): string {
  const normalized = normalizeCampaignPlatformFilter(filter, available);
  if (isAllCampaignPlatformFilter(normalized)) return "All campaigns";
  if (
    campaignPlatformMatchMode(normalized) === "multiple" &&
    parseCampaignPlatformTokens(normalized).length ===
      MULTIPLE_CAMPAIGN_FILTER_PLATFORMS.length
  ) {
    return "All 3 platforms";
  }
  return parseCampaignPlatformTokens(normalized)
    .map((platform) => CAMPAIGN_FILTER_PLATFORM_LABELS[platform])
    .join(", ");
}

export function toggleCampaignPlatformFilter(
  current: string | null | undefined,
  platform: CampaignFilterPlatform | "all",
  available: readonly CampaignFilterPlatform[] = CAMPAIGN_FILTER_PLATFORMS,
): string {
  const normalized = normalizeCampaignPlatformFilter(current, available);
  const mode = campaignPlatformMatchMode(normalized);
  if (platform === "all") {
    return mode === "multiple"
      ? serializeCampaignPlatformFilter(mode, ALL_MULTIPLE_PLATFORMS)
      : "all";
  }
  if (
    mode === "multiple"
      ? !MULTIPLE_CAMPAIGN_FILTER_PLATFORMS.some(
          (candidate) => candidate === platform,
        )
      : !available.includes(platform)
  ) {
    return normalized;
  }
  const selected = new Set(
    isAllCampaignPlatformFilter(normalized)
      ? []
      : parseCampaignPlatformTokens(normalized),
  );

  if (isAllCampaignPlatformFilter(normalized)) {
    return serializeCampaignPlatformFilter(mode, platform);
  }

  if (selected.has(platform)) {
    if (mode === "multiple" && selected.size === 2) return normalized;
    selected.delete(platform);
  } else {
    selected.add(platform);
  }

  return normalizeCampaignPlatformFilter(
    serializeCampaignPlatformFilter(
      mode,
      CAMPAIGN_FILTER_PLATFORMS.filter((item) => selected.has(item)).join(","),
    ),
    available,
  );
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, index) =>
    permutations(items.filter((_, itemIndex) => itemIndex !== index)).map(
      (rest) => [item, ...rest],
    ),
  );
}

export function postgrestPlatformOrFilter(
  filter: string | null | undefined,
): string | null {
  const normalized = normalizeCampaignPlatformFilter(filter);
  if (isAllCampaignPlatformFilter(normalized)) return null;

  const selected = parseCampaignPlatformTokens(normalized);
  if (campaignPlatformMatchMode(normalized) === "single") {
    const clauses = selected.flatMap((platform) =>
      platform === "twitter"
        ? ["platform.eq.twitter", "platform.eq.x"]
        : [`platform.eq.${platform}`],
    );
    return clauses.length > 0 ? clauses.join(",") : null;
  }

  const aliases = selected.map((platform) =>
    platform === "twitter" ? (["twitter", "x"] as const) : [platform],
  );
  const combinations = aliases.reduce<string[][]>(
    (acc, values) =>
      acc.flatMap((prefix) => values.map((value) => [...prefix, value])),
    [[]],
  );
  const exactValues = new Set<string>();
  for (const combination of combinations) {
    for (const ordered of permutations(combination)) {
      exactValues.add(ordered.join(","));
      exactValues.add(ordered.join(", "));
    }
  }
  const clauses = [...exactValues].map((value) =>
    value.includes(",")
      ? `platform.eq."${value}"`
      : `platform.eq.${value}`,
  );

  return clauses.length > 0 ? clauses.join(",") : null;
}
