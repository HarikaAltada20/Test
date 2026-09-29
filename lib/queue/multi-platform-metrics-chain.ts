/**
 * Sequential multi-platform metrics refresh chain (Upstash Redis + QStash).
 *
 * Flow:
 * 1. User clicks Refresh → save chain in Redis → enqueue first platform only.
 * 2. Platform processor finishes (completed/failed) → advance chain → enqueue next.
 * 3. Each enqueue triggers QStash (or direct cron POST) via existing enqueue routes.
 *
 * Order is always YouTube → Instagram → TikTok (subset of campaign platforms).
 *
 * Env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, CRON_SECRET
 */

import { Redis } from "@upstash/redis";
import {
  postCampaignEnqueuePathForPlatform,
  postCampaignPlatformLabel,
  postCampaignStatusPathForPlatform,
  type PostCampaignVideoPlatform,
} from "@/lib/post-campaign-platforms";
import type { YouTubeRefreshScope } from "@/lib/queue/youtube-metrics-queue";
import type { MetricsRefreshTarget } from "@/lib/post-campaign-enqueue-guards";

const REDIS_PREFIX = "multi_platform_metrics_chain";
const CHAIN_TTL_SECONDS = 60 * 60 * 6; // 6h safety TTL

export type MultiPlatformChainState = {
  chainId: string;
  contestId: string;
  metricsTarget: MetricsRefreshTarget;
  platforms: PostCampaignVideoPlatform[];
  currentIndex: number;
  /** YouTube enqueue scope (basic by default). */
  scope: YouTubeRefreshScope;
  startedAt: string;
};

const ADVANCE_CHAIN_LUA = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local ok, state = pcall(cjson.decode, raw)
if not ok then return -1 end
if tostring(state.chainId or "") ~= ARGV[1] then return 0 end
if tonumber(state.currentIndex) ~= tonumber(ARGV[2]) then return 0 end
state.currentIndex = tonumber(ARGV[3])
redis.call("SET", KEYS[1], cjson.encode(state), "EX", tonumber(ARGV[4]))
return 1
`;

const CLEAR_CHAIN_LUA = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local ok, state = pcall(cjson.decode, raw)
if not ok then return -1 end
if tostring(state.chainId or "") ~= ARGV[1] then return 0 end
if ARGV[2] ~= "" and tonumber(state.currentIndex) ~= tonumber(ARGV[2]) then return 0 end
return redis.call("DEL", KEYS[1])
`;

export type MultiPlatformChainRun = {
  platform: PostCampaignVideoPlatform;
  platformLabel: string;
  runId: string | undefined;
  alreadyActive: boolean;
  statusPath: string;
};

function chainKey(contestId: string, metricsTarget: MetricsRefreshTarget): string {
  return `${REDIS_PREFIX}:${contestId}:${metricsTarget}`;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    if (!url) {
      console.warn("[multi-platform-metrics-chain] UPSTASH_REDIS_REST_URL is missing");
    }
    if (!token) {
      console.warn(
        "[multi-platform-metrics-chain] UPSTASH_REDIS_REST_TOKEN is missing",
      );
    }
    return null;
  }
  try {
    return Redis.fromEnv();
  } catch (e) {
    console.error("[multi-platform-metrics-chain] Redis client creation failed:", e);
    return null;
  }
}

export function isMultiPlatformMetricsChainEnabled(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() &&
    process.env.CRON_SECRET?.trim()
  );
}

async function createMultiPlatformMetricsChain(
  state: MultiPlatformChainState,
): Promise<{ created: boolean; error?: string }> {
  const redis = getRedis();
  if (!redis) return { created: false, error: "Redis not configured" };
  try {
    const result = await redis.set(
      chainKey(state.contestId, state.metricsTarget),
      state,
      {
        ex: CHAIN_TTL_SECONDS,
        nx: true,
      },
    );
    if (result !== "OK") {
      return { created: false };
    }
    console.info("[multi-platform-metrics-chain] saved", {
      chainId: state.chainId,
      contestId: state.contestId,
      metricsTarget: state.metricsTarget,
      platforms: state.platforms,
      currentIndex: state.currentIndex,
    });
    return { created: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[multi-platform-metrics-chain] save failed:", message);
    return { created: false, error: message };
  }
}

export async function getMultiPlatformMetricsChain(
  contestId: string,
  metricsTarget: MetricsRefreshTarget,
): Promise<MultiPlatformChainState | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get<MultiPlatformChainState | string>(
      chainKey(contestId, metricsTarget),
    );
    if (!raw) return null;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as MultiPlatformChainState;
      } catch {
        return null;
      }
    }
    if (
      raw &&
      typeof raw === "object" &&
      typeof raw.chainId === "string" &&
      Array.isArray(raw.platforms) &&
      typeof raw.currentIndex === "number"
    ) {
      return raw;
    }
    return null;
  } catch (e) {
    console.error("[multi-platform-metrics-chain] get failed:", e);
    return null;
  }
}

export async function clearMultiPlatformMetricsChain(
  contestId: string,
  metricsTarget: MetricsRefreshTarget,
  chainId?: string,
  currentIndex?: number,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    if (!chainId) {
      await redis.del(chainKey(contestId, metricsTarget));
      return;
    }
    await redis.eval(
      CLEAR_CHAIN_LUA,
      [chainKey(contestId, metricsTarget)],
      [chainId, currentIndex == null ? "" : String(currentIndex)],
    );
  } catch (e) {
    console.error("[multi-platform-metrics-chain] clear failed:", e);
  }
}

function resolveBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

/**
 * Enqueue one platform's metrics refresh (user cookie or CRON_SECRET for chain).
 */
export async function enqueuePlatformMetricsRefresh(options: {
  baseUrl: string;
  contestId: string;
  platform: PostCampaignVideoPlatform;
  metricsTarget: MetricsRefreshTarget;
  scope?: YouTubeRefreshScope;
  cookieHeader?: string | null;
  /** When true, uses CRON_SECRET (bypasses cooldown; used for chain advance). */
  useCronAuth?: boolean;
}): Promise<{
  runId?: string;
  alreadyActive?: boolean;
  error?: string;
  status?: number;
}> {
  const {
    contestId,
    platform,
    metricsTarget,
    scope = "basic",
    cookieHeader,
    useCronAuth = false,
  } = options;
  const enqueueUrl = `${resolveBaseUrl(options.baseUrl)}${postCampaignEnqueuePathForPlatform(
    contestId,
    platform,
  )}`;

  const body: Record<string, unknown> = { metricsTarget };
  if (platform === "youtube") {
    body.scope = scope;
  }
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (useCronAuth && !cronSecret) {
    return {
      error: "Multi-platform metrics chain requires CRON_SECRET",
      status: 503,
    };
  }

  // Mid-chain advance: claim the already-advanced Redis step and skip cooldown.
  if (useCronAuth) {
    body.chainContinue = true;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (useCronAuth && cronSecret) {
    headers.Authorization = `Bearer ${cronSecret}`;
  } else if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  try {
    const res = await fetch(enqueueUrl, {
      method: "POST",
      headers,
      credentials: cookieHeader ? "include" : "omit",
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        error:
          (data as { error?: string })?.error ??
          `Failed to start ${postCampaignPlatformLabel(platform)} refresh`,
        status: res.status,
      };
    }
    return {
      runId:
        typeof (data as { runId?: string }).runId === "string"
          ? (data as { runId: string }).runId
          : undefined,
      alreadyActive: Boolean((data as { alreadyActive?: boolean }).alreadyActive),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[multi-platform-metrics-chain] enqueue failed:", message);
    return { error: message, status: 500 };
  }
}

/**
 * Start a sequential chain: persist Redis state (if 2+ platforms) and enqueue the first.
 * Later platforms are started by {@link advanceMultiPlatformMetricsChainAfterTerminal}.
 */
export async function startMultiPlatformMetricsChain(options: {
  baseUrl: string;
  contestId: string;
  platforms: PostCampaignVideoPlatform[];
  metricsTarget: MetricsRefreshTarget;
  scope?: YouTubeRefreshScope;
  cookieHeader?: string | null;
}): Promise<{
  runs: MultiPlatformChainRun[];
  chain: boolean;
  error?: string;
  status?: number;
}> {
  const {
    contestId,
    platforms,
    metricsTarget,
    scope = "basic",
    cookieHeader,
  } = options;

  if (platforms.length === 0) {
    return {
      runs: [],
      chain: false,
      error: "No platforms to refresh",
      status: 400,
    };
  }

  if (platforms.length > 1 && !isMultiPlatformMetricsChainEnabled()) {
    return {
      runs: [],
      chain: false,
      error:
        "Multi-platform metrics refresh requires shared Redis and CRON_SECRET configuration.",
      status: 503,
    };
  }

  const useChain = platforms.length > 1;
  const chainId = crypto.randomUUID();

  if (useChain) {
    const saveResult = await createMultiPlatformMetricsChain({
      chainId,
      contestId,
      metricsTarget,
      platforms,
      currentIndex: 0,
      scope,
      startedAt: new Date().toISOString(),
    });
    if (saveResult.error) {
      return {
        runs: [],
        chain: false,
        error: saveResult.error,
        status: 503,
      };
    }
    if (!saveResult.created) {
      return {
        runs: [],
        chain: false,
        error: "A multi-platform metrics refresh is already in progress.",
        status: 409,
      };
    }
  }

  const first = platforms[0]!;
  const enqueueResult = await enqueuePlatformMetricsRefresh({
    baseUrl: options.baseUrl,
    contestId,
    platform: first,
    metricsTarget,
    scope,
    cookieHeader,
    useCronAuth: false,
  });

  if (enqueueResult.error) {
    if (useChain) {
      await clearMultiPlatformMetricsChain(contestId, metricsTarget, chainId, 0);
    }
    return {
      runs: [],
      chain: false,
      error: enqueueResult.error,
      status: enqueueResult.status ?? 500,
    };
  }

  const runs: MultiPlatformChainRun[] = platforms.map((platform, index) => ({
    platform,
    platformLabel: postCampaignPlatformLabel(platform),
    runId: index === 0 ? enqueueResult.runId : undefined,
    alreadyActive: index === 0 ? Boolean(enqueueResult.alreadyActive) : false,
    statusPath: postCampaignStatusPathForPlatform(platform),
  }));

  return { runs, chain: useChain };
}

/**
 * After a platform run reaches a terminal status, enqueue the next platform in the chain.
 * Safe no-op when no chain exists or the completed platform is not the current head.
 */
export async function advanceMultiPlatformMetricsChainAfterTerminal(options: {
  contestId: string;
  platform: PostCampaignVideoPlatform;
  metricsTarget: MetricsRefreshTarget;
  baseUrl: string;
}): Promise<{
  advanced: boolean;
  nextPlatform?: PostCampaignVideoPlatform;
  done?: boolean;
  error?: string;
}> {
  const { contestId, platform, metricsTarget, baseUrl } = options;

  if (!isMultiPlatformMetricsChainEnabled()) {
    return { advanced: false };
  }

  const chain = await getMultiPlatformMetricsChain(contestId, metricsTarget);
  if (!chain || chain.platforms.length === 0) {
    return { advanced: false };
  }

  const current = chain.platforms[chain.currentIndex];
  if (current !== platform) {
    // Stale completion from a prior run — ignore.
    return { advanced: false };
  }

  const nextIndex = chain.currentIndex + 1;
  if (nextIndex >= chain.platforms.length) {
    await clearMultiPlatformMetricsChain(
      contestId,
      metricsTarget,
      chain.chainId,
      chain.currentIndex,
    );
    console.info("[multi-platform-metrics-chain] completed", {
      contestId,
      metricsTarget,
      platforms: chain.platforms,
    });
    return { advanced: false, done: true };
  }

  const nextPlatform = chain.platforms[nextIndex]!;
  const redis = getRedis();
  if (!redis) {
    return { advanced: false, error: "Redis not configured" };
  }
  let transitionResult: unknown;
  try {
    transitionResult = await redis.eval(
      ADVANCE_CHAIN_LUA,
      [chainKey(contestId, metricsTarget)],
      [
        chain.chainId,
        String(chain.currentIndex),
        String(nextIndex),
        String(CHAIN_TTL_SECONDS),
      ],
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { advanced: false, error: message };
  }
  if (Number(transitionResult) !== 1) {
    // Another terminal callback or a newer chain already changed this state.
    return { advanced: false };
  }

  const advanceBaseUrl = resolveMetricsChainAdvanceBaseUrl(baseUrl);
  const enqueueResult = await enqueuePlatformMetricsRefresh({
    baseUrl: advanceBaseUrl,
    contestId,
    platform: nextPlatform,
    metricsTarget,
    scope: chain.scope,
    useCronAuth: true,
  });

  if (enqueueResult.error) {
    console.error(
      "[multi-platform-metrics-chain] failed to enqueue next platform",
      {
        contestId,
        nextPlatform,
        error: enqueueResult.error,
      },
    );
    // Keep Redis chain so the client can recover via chainContinue.
    return {
      advanced: false,
      nextPlatform,
      error: enqueueResult.error,
    };
  }

  console.info("[multi-platform-metrics-chain] advanced", {
    contestId,
    metricsTarget,
    from: platform,
    to: nextPlatform,
    runId: enqueueResult.runId,
    alreadyActive: enqueueResult.alreadyActive,
  });

  return { advanced: true, nextPlatform };
}

export function isCurrentMultiPlatformChainStep(
  chain: {
    platforms: readonly PostCampaignVideoPlatform[];
    currentIndex: number;
  },
  platform: PostCampaignVideoPlatform,
): boolean {
  const platformIndex = chain.platforms.indexOf(platform);
  return platformIndex >= 0 && chain.currentIndex === platformIndex;
}

/**
 * Client (or processor) claims the platform already selected by the server-side
 * terminal transition. This intentionally cannot advance the index: callers
 * must not be able to start a later platform before the previous run finishes.
 */
export async function claimMultiPlatformChainPlatform(options: {
  contestId: string;
  metricsTarget: MetricsRefreshTarget;
  platform: PostCampaignVideoPlatform;
}): Promise<{ ok: true; chain: MultiPlatformChainState } | { ok: false; error: string }> {
  const { contestId, metricsTarget, platform } = options;
  if (!isMultiPlatformMetricsChainEnabled()) {
    return { ok: false, error: "Redis chain not configured" };
  }

  const chain = await getMultiPlatformMetricsChain(contestId, metricsTarget);
  if (!chain || chain.platforms.length === 0) {
    return { ok: false, error: "No active multi-platform refresh chain" };
  }

  const platformIndex = chain.platforms.indexOf(platform);
  if (platformIndex < 0) {
    return { ok: false, error: "Platform is not part of this refresh chain" };
  }

  if (isCurrentMultiPlatformChainStep(chain, platform)) {
    return { ok: true, chain };
  }

  return {
    ok: false,
    error: `Platform ${platform} is not the active chain step (currentIndex=${chain.currentIndex})`,
  };
}

/**
 * True when this platform is the last step of an active multi-platform chain
 * (or there is no chain). Used so mid-chain YouTube/IG do not bump
 * `last_metrics_updated` / heavy finalize before Instagram + TikTok run.
 */
export async function isFinalPlatformInMetricsChain(
  contestId: string,
  metricsTarget: MetricsRefreshTarget,
  platform: PostCampaignVideoPlatform,
): Promise<boolean> {
  if (!isMultiPlatformMetricsChainEnabled()) return true;
  const chain = await getMultiPlatformMetricsChain(contestId, metricsTarget);
  if (!chain || chain.platforms.length <= 1) return true;
  const last = chain.platforms[chain.platforms.length - 1];
  return last === platform;
}

/** Prefer public app URL for server→server chain enqueue (avoids bad localhost origins). */
export function resolveMetricsChainAdvanceBaseUrl(requestBaseUrl: string): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    const withProto = envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
    return withProto.replace(/\/$/, "");
  }
  return requestBaseUrl.replace(/\/$/, "");
}
