import { createAdminClient } from "@/utils/supabase/admin";

const ROW_ID = "default";

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Meta X-App-Usage header: JSON with call_count, total_time, total_cputime (each 0–100). */
function parseXAppUsage(headers: Headers): {
  call_count: number;
  total_time: number;
  total_cputime: number;
  raw: string;
} | null {
  const raw = headers.get("x-app-usage");
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as {
      call_count?: number;
      total_time?: number;
      total_cputime?: number;
    };
    return {
      call_count: clampPct(Number(o.call_count ?? 0)),
      total_time: clampPct(Number(o.total_time ?? 0)),
      total_cputime: clampPct(Number(o.total_cputime ?? 0)),
      raw,
    };
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
