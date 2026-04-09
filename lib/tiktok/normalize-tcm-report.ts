/**
 * Best-effort parsing of TikTok for Business **TCM** (or related) video report payloads.
 *
 * **Not the same as the Login Kit Display API.**
 * The public [Video object](https://developers.tiktok.com/doc/tiktok-api-v2-video-object)
 * for `/v2/video/list` and `/v2/video/query` only documents:
 * `view_count`, `like_count`, `comment_count`, `share_count`, plus metadata — **not** reach,
 * saves (collects), or watch-time metrics.
 *
 * Reach / saves / watch time here are taken **only if** your Marketing access and
 * `GET /open_api/v1.3/tto/tcm/report/` (or nested `data`) return those fields.
 * Field names vary by product version; confirm against **TikTok API for Business**
 * documentation for your app and adjust aliases below from real API responses.
 */
export type NormalizedTcmVideoMetrics = {
  reach: number;
  save_count: number;
  /** Average watch time in seconds (best effort). */
  avg_watch_time_sec: number;
  /** Total watch time in seconds (best effort). */
  total_watch_time_sec: number;
};

export function normalizeTcmVideoReport(raw: unknown): NormalizedTcmVideoMetrics | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const firstList =
    Array.isArray(r.list) && r.list.length > 0 && typeof r.list[0] === "object"
      ? (r.list[0] as Record<string, unknown>)
      : null;
  const inner = firstList || (r.metrics && typeof r.metrics === "object"
      ? (r.metrics as Record<string, unknown>)
      : r);

  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    reach: num(
      inner.reach ??
        inner.reach_count ??
        inner.video_reach ??
        inner.video_reach_count,
    ),
    save_count: num(
      inner.save_count ??
        inner.saves ??
        inner.collect_count ??
        inner.favorite_count,
    ),
    avg_watch_time_sec: num(
      inner.avg_watch_time ??
        inner.average_watch_time ??
        inner.average_time_watched ??
        inner.avg_play_time,
    ),
    total_watch_time_sec: num(
      inner.total_watch_time ??
        inner.total_time_watched ??
        inner.total_play_time,
    ),
  };
}
