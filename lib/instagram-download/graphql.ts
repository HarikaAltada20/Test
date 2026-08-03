/**
 * Instagram post media via PolarisPostRootQuery (web_info).
 * Replaces the deprecated xdt_shortcode_media doc_id path (~June 2026).
 */

const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36";

const POLARIS_POST_DOC_ID = "27128499623469141";

export type InstagramMediaItem = {
  code?: string;
  pk?: string | number;
  media_type?: number;
  taken_at?: number;
  video_versions?: Array<{ url: string }>;
  image_versions2?: { candidates?: Array<{ url: string }> };
  video_duration?: number;
  view_count?: number;
  play_count?: number;
  user?: {
    pk?: string | number;
    username?: string;
    full_name?: string;
    is_verified?: boolean;
    profile_pic_url?: string;
  };
  caption?: { text?: string } | null;
};

export type InstagramWebInfoResponse = {
  data?: {
    xdt_api__v1__media__shortcode__web_info?: {
      items?: InstagramMediaItem[];
    };
  } | null;
  status?: string;
  errors?: unknown;
};

/** Minimal legacy GraphQL shape used by download consumers. */
export type LegacyShortcodeMedia = {
  xdt_shortcode_media: {
    id: string;
    shortcode: string;
    is_video: boolean;
    video_url: string;
    display_url: string;
    thumbnail_src: string;
    video_duration: number;
    video_view_count: number;
    video_play_count: number;
    owner: {
      id: string;
      username: string;
      full_name: string;
      is_verified: boolean;
      profile_pic_url: string;
    };
  };
};

function generateRequestBody(shortcode: string): string {
  const params = new URLSearchParams({
    av: "0",
    __d: "www",
    __user: "0",
    __a: "1",
    __req: "b",
    dpr: "3",
    __ccg: "GOOD",
    lsd: "AVrqPT0gJDo",
    jazoest: "2946",
    __crn: "comet.igweb.PolarisPostRoute",
    fb_api_caller_class: "RelayModern",
    fb_api_req_friendly_name: "PolarisPostRootQuery",
    variables: JSON.stringify({
      shortcode,
      __relay_internal__pv__PolarisAIGMMediaWebLabelEnabledrelayprovider: false,
    }),
    server_timestamps: "true",
    doc_id: POLARIS_POST_DOC_ID,
  });
  return params.toString();
}

function extractCsrfToken(setCookieHeaders: string[]): string | null {
  for (const header of setCookieHeaders) {
    const match = header.match(/(?:^|,\s*)csrftoken=([^;]+)/i);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

async function getCsrfToken(): Promise<string> {
  const response = await fetch("https://www.instagram.com/", {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  const setCookieHeaders =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""];

  return extractCsrfToken(setCookieHeaders) ?? "";
}

export function normalizeMediaToLegacyGraphQL(
  media: InstagramMediaItem
): LegacyShortcodeMedia {
  const mediaType = media.media_type;
  const isVideo = mediaType === 2;
  const candidates = media.image_versions2?.candidates ?? [];
  const videoVersions = media.video_versions ?? [];

  return {
    xdt_shortcode_media: {
      id: String(media.pk ?? ""),
      shortcode: media.code ?? "",
      is_video: isVideo,
      video_url: videoVersions[0]?.url ?? "",
      display_url: candidates[0]?.url ?? "",
      thumbnail_src: candidates[0]?.url ?? "",
      video_duration: media.video_duration ?? 0,
      video_view_count: media.view_count ?? 0,
      video_play_count: media.play_count ?? 0,
      owner: {
        id: String(media.user?.pk ?? ""),
        username: media.user?.username ?? "",
        full_name: media.user?.full_name ?? "",
        is_verified: media.user?.is_verified ?? false,
        profile_pic_url: media.user?.profile_pic_url ?? "",
      },
    },
  };
}

export function getMediaItemFromWebInfoResponse(
  payload: InstagramWebInfoResponse
): InstagramMediaItem | null {
  const items =
    payload.data?.xdt_api__v1__media__shortcode__web_info?.items ?? [];
  return items[0] ?? null;
}

export async function getInstagramPostGraphQL(shortcode: string): Promise<Response> {
  const csrfToken = await getCsrfToken();
  const requestUrl = new URL("https://www.instagram.com/graphql/query");

  return fetch(requestUrl, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.5",
      "Content-Type": "application/x-www-form-urlencoded",
      "X-FB-Friendly-Name": "PolarisPostRootQuery",
      "X-BLOKS-VERSION-ID":
        "0d99de0d13662a50e0958bcb112dd651f70dea02e1859073ab25f8f2a477de96",
      "X-CSRFToken": csrfToken,
      "X-IG-App-ID": "1217981644879628",
      "X-FB-LSD": "AVrqPT0gJDo",
      "X-ASBD-ID": "359341",
      "Sec-GPC": "1",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      Pragma: "no-cache",
      "Cache-Control": "no-cache",
      Referer: `https://www.instagram.com/p/${shortcode}/`,
      ...(csrfToken ? { Cookie: `csrftoken=${csrfToken}` } : {}),
    },
    body: generateRequestBody(shortcode),
  });
}

export type ResolveInstagramVideoResult =
  | { ok: true; videoUrl: string; shortcode: string; data: LegacyShortcodeMedia }
  | {
      ok: false;
      error:
        | "noShortcode"
        | "notFound"
        | "notVideo"
        | "tooManyRequests"
        | "serverError";
      message: string;
      status: number;
    };

export async function resolveInstagramVideoUrl(
  shortcode: string
): Promise<ResolveInstagramVideoResult> {
  if (!shortcode) {
    return {
      ok: false,
      error: "noShortcode",
      message: "shortcode is required",
      status: 400,
    };
  }

  try {
    const response = await getInstagramPostGraphQL(shortcode);
    const status = response.status;

    if (status === 200) {
      const payload = (await response.json()) as InstagramWebInfoResponse;
      const mediaItem = getMediaItemFromWebInfoResponse(payload);

      if (!mediaItem) {
        return {
          ok: false,
          error: "notFound",
          message: "post not found",
          status: 404,
        };
      }

      const data = normalizeMediaToLegacyGraphQL(mediaItem);

      if (!data.xdt_shortcode_media.is_video) {
        return {
          ok: false,
          error: "notVideo",
          message: "post is not a video",
          status: 400,
        };
      }

      if (!data.xdt_shortcode_media.video_url) {
        return {
          ok: false,
          error: "notFound",
          message: "video url not found",
          status: 404,
        };
      }

      return {
        ok: true,
        videoUrl: data.xdt_shortcode_media.video_url,
        shortcode: data.xdt_shortcode_media.shortcode || shortcode,
        data,
      };
    }

    if (status === 404) {
      return {
        ok: false,
        error: "notFound",
        message: "post not found",
        status: 404,
      };
    }

    if (status === 429 || status === 401) {
      return {
        ok: false,
        error: "tooManyRequests",
        message: "too many requests, try again later",
        status: 429,
      };
    }

    return {
      ok: false,
      error: "serverError",
      message: `Failed to fetch post data (HTTP ${status})`,
      status: 500,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch post data";
    return {
      ok: false,
      error: "serverError",
      message,
      status: 500,
    };
  }
}