import { createAdminClient } from "@/utils/supabase/admin";

const ROW_ID = "default";

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function readNumericField(obj: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return NaN;
}

/**
 * X-App-Usage: classic Graph uses call_count, total_time, total_cputime.
 * Instagram Graph often returns call_volume, cpu_time (and sometimes total_time).
 */
function parseXAppUsage(headers: Headers): {
  call_count: number;
  total_time: number;
  total_cputime: number;
  raw: string;
} | null {
  const raw = headers.get("x-app-usage");
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const call_count = clampPct(
      readNumericField(o, ["call_count", "call_volume"])
    );
    const total_time = clampPct(
      readNumericField(o, ["total_time", "total_wall_time"])
    );
    const total_cputime = clampPct(
      readNumericField(o, ["total_cputime", "cpu_time", "cputime"])
    );
    return { call_count, total_time, total_cputime, raw };
  } catch {
    return null;
  }
}

async function persistFromHeaders(headers: Headers): Promise<void> {
  const parsed = parseXAppUsage(headers);
  if (!parsed) return;

  let client;
  try {
    client = createAdminClient();
  } catch {
    return;
  }

  const { error } = await client.from("meta_graph_app_usage").upsert(
    {
      id: ROW_ID,
      call_count: parsed.call_count,
      total_time: parsed.total_time,
      total_cputime: parsed.total_cputime,
      updated_at: new Date().toISOString(),
      raw_headers: { x_app_usage: parsed.raw },
    },
    { onConflict: "id" }
  );

  if (error) {
    console.warn("[instagram-graph] meta_graph_app_usage upsert failed:", error.message);
  }
}

/**
 * fetch() to graph.instagram.com only; saves X-App-Usage to meta_graph_app_usage when present.
 * Used by Instagram insights batch refresh and token refresh in lib/instagram-insights.
 */
export async function instagramGraphFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const request = new Request(input as URL | Request | string, init);
  const host = new URL(request.url).hostname.toLowerCase();
  if (host !== "graph.instagram.com") {
    throw new Error(
      `[instagram-graph] only graph.instagram.com is allowed, got: ${host}`
    );
  }

  const res = await fetch(request.clone());
  await persistFromHeaders(res.headers);

  const bodyText = await res.text();
  return new Response(bodyText, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}
