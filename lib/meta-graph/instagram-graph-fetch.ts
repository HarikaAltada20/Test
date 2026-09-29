import {
  applyUsageHeadersToAccumulator,
  type MetaGraphUsageAccumulator,
} from "@/lib/meta-graph/usage-accumulator";

export type InstagramGraphFetchInit = RequestInit & {
  usageAccumulator?: MetaGraphUsageAccumulator;
};

function toRequestInit(init?: InstagramGraphFetchInit): RequestInit | undefined {
  if (!init) return undefined;
  const { usageAccumulator: _, ...rest } = init;
  return rest;
}

/**
 * fetch() to graph.instagram.com only.
 * Optional `usageAccumulator`: last X-App-Usage / X-Business-Use-Case-Usage from
 * responses are merged in; the batch/cron caller appends meta_graph_app_usage_log.
 */
export async function instagramGraphFetch(
  input: RequestInfo | URL,
  init?: InstagramGraphFetchInit
): Promise<Response> {
  const stripped = toRequestInit(init);
  const request = new Request(input as URL | Request | string, stripped);
  const host = new URL(request.url).hostname.toLowerCase();
  if (host !== "graph.instagram.com") {
    throw new Error(
      `[instagram-graph] only graph.instagram.com is allowed, got: ${host}`
    );
  }

  const res = await fetch(request.clone());
  if (init?.usageAccumulator) {
    applyUsageHeadersToAccumulator(res.headers, init.usageAccumulator);
  }

  const bodyText = await res.text();
  return new Response(bodyText, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}
