/**
 * TikTok Business (TTO/TCM) API Client
 * Handles communication with the TikTok for Business / TikTok One APIs.
 */

import { TIKTOK_BUSINESS_VIDEO_LIST_FIELDS } from "@/lib/tiktok/constants/business-video-list-fields";

export class TikTokBusinessApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly rawBody?: any,
  ) {
    super(message);
    this.name = "TikTokBusinessApiError";
  }
}

export class TikTokBusinessApiClient {
  private readonly baseUrl = "https://business-api.tiktok.com/open_api/v1.3";
  private readonly appId: string;
  private readonly secret: string;
  private readonly redirectUri: string;

  constructor() {
    this.appId = (process.env.TIKTOK_BUSINESS_APP_ID || "").trim();
    this.secret = (process.env.TIKTOK_BUS_SECRET || "").trim();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    this.redirectUri =
      (process.env.TIKTOK_BUSINESS_REDIRECT_URI || "").trim() ||
      `${appUrl}/api/tiktok/marketing/callback`;

    console.log("[TikTokBusinessApiClient] Initialized with App ID:", this.appId || "MISSING");
  }

  getRedirectUri(): string {
    return this.redirectUri;
  }

  getAppId(): string {
    return this.appId;
  }

  /**
   * Exchanges authorization code for an access token.
   * @see https://github.com/tiktok/tiktok-business-api-sdk/blob/main/js_sdk/docs/AuthenticationApi.md
   */
  async getAccessToken(code: string) {
    const url = `${this.baseUrl}/oauth2/access_token/`;
    const body = {
      app_id: this.appId,
      secret: this.secret,
      auth_code: code,
    };

    console.log("[TikTok Business API] POST /oauth2/access_token/ with app_id:", this.appId);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("[TikTok Business API] Non-JSON token response:", {
        status: res.status,
        snippet: text.slice(0, 200),
      });
      throw new TikTokBusinessApiError(
        `Token exchange failed (${res.status}): ${text.slice(0, 120).trim() || res.statusText}`,
        res.status,
        text,
      );
    }

    this.handleErrorResponse(res.status, data);

    return data;
  }

  /**
   * Refreshes the creator/marketing access token (valid ~24h per TikTok; refresh token ~1y).
   * POST /open_api/v1.3/oauth2/refresh_token/
   */
  async oauth2RefreshCreatorToken(refreshToken: string): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}/oauth2/refresh_token/`;
    const body = {
      app_id: this.appId,
      secret: this.secret,
      refresh_token: refreshToken,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      console.error("[TikTok Business API] oauth2/refresh_token non-JSON:", {
        status: res.status,
        snippet: text.slice(0, 200),
      });
      throw new TikTokBusinessApiError(
        `refresh_token invalid response (${res.status}): ${text.slice(0, 120).trim() || res.statusText}`,
        res.status,
        text,
      );
    }

    this.handleErrorResponse(res.status, data);
    return data;
  }

  /**
   * @deprecated Use {@link oauth2RefreshCreatorToken}. Kept name avoids accidental use for Login Kit.
   */
  async refreshAccessToken(_refreshToken: string) {
    throw new Error("Use oauth2RefreshCreatorToken for TikTok Business (Marketing) tokens.");
  }

  private async parseJsonBody(res: Response): Promise<Record<string, unknown>> {
    const text = await res.text();
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      console.error("[TikTok Business API] Non-JSON body:", {
        status: res.status,
        url: res.url,
        snippet: text.slice(0, 200),
      });
      throw new TikTokBusinessApiError(
        `Expected JSON (${res.status}): ${text.slice(0, 120).trim() || "empty body"}`,
        res.status,
        text,
      );
    }
  }

  /**
   * Fetches the identity information for the authorized creator.
   * Endpoint: /oauth2/info/
   */
  async getCreatorInfo(accessToken: string) {
    const url = `${this.baseUrl}/oauth2/info/`;
    
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Access-Token": accessToken,
      },
    });

    const data = await this.parseJsonBody(res);
    this.handleErrorResponse(res.status, data);

    return data;
  }

  /**
   * TCM-style video report (TikTok for Business). May include metrics not available
   * on the Login Kit Display API Video Object (e.g. reach, saves, watch time), depending
   * on app product access and response schema — see TikTok API for Business portal docs.
   *
   * Display API video fields (documented): https://developers.tiktok.com/doc/tiktok-api-v2-video-object
   *
   * @param videoUrl Typically `share_url` from Display API for that video.
   * @param opts.ttoTcmAccountId Required by TikTok as `tto_tcm_account_id` on this endpoint.
   */
  async getTcmReport(
    accessToken: string,
    videoUrl: string,
    opts?: { ttoTcmAccountId?: string | null },
  ) {
    const url = `${this.baseUrl}/tto/tcm/report/`;

    const params = new URLSearchParams({
      video_url: videoUrl,
    });
    const tto = opts?.ttoTcmAccountId?.trim();
    if (tto) {
      params.set("tto_tcm_account_id", tto);
    }

    const res = await fetch(`${url}?${params.toString()}`, {
      method: "GET",
      headers: {
        "Access-Token": accessToken,
      },
    });

    const data = await this.parseJsonBody(res);
    this.handleErrorResponse(res.status, data);

    return data;
  }

  /**
   * Creator audience breakdown (TCM path). Availability and field shape depend on
   * TikTok for Business app capabilities — verify in API for Business documentation.
   *
   * Endpoint: /tto/tcm/creator/public/get/
   */
  /**
   * Organic (Business) video list with rich metrics (reach, watch time, etc.).
   * @see TikTok API for Business — business video list (portal doc id 1762228421622786)
   */
  async listBusinessVideosPage(
    accessToken: string,
    businessId: string,
    cursor?: string | number,
    opts?: { maxCount?: number },
  ): Promise<{
    videos: Record<string, unknown>[];
    cursor?: string | number;
    hasMore: boolean;
  }> {
    const params = new URLSearchParams();
    params.set("business_id", businessId);
    params.set("fields", JSON.stringify([...TIKTOK_BUSINESS_VIDEO_LIST_FIELDS]));
    const maxCount = Math.min(Math.max(opts?.maxCount ?? 20, 1), 20);
    params.set("max_count", String(maxCount));
    if (cursor !== undefined && cursor !== null && `${cursor}` !== "") {
      params.set("cursor", String(cursor));
    }

    const url = `${this.baseUrl}/business/video/list/?${params.toString()}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Access-Token": accessToken,
      },
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("[TikTok Business API] business/video/list non-JSON:", {
        status: res.status,
        snippet: text.slice(0, 200),
      });
      throw new TikTokBusinessApiError(
        `business/video/list invalid response (${res.status})`,
        res.status,
        text,
      );
    }

    this.handleErrorResponse(res.status, data);
    const d = data.data ?? {};
    const chunk = d.videos ?? d.list ?? d.video_list ?? [];
    const videos: Record<string, unknown>[] = Array.isArray(chunk)
      ? chunk.filter((x: unknown) => x && typeof x === "object") as Record<
          string,
          unknown
        >[]
      : [];

    return {
      videos,
      cursor: d.cursor,
      hasMore: Boolean(d.has_more),
    };
  }

  /** Paginate until `has_more` is false or `maxPages` is reached. */
  async listAllBusinessVideos(
    accessToken: string,
    businessId: string,
    opts?: { maxPages?: number; maxCountPerPage?: number },
  ): Promise<Record<string, unknown>[]> {
    const out: Record<string, unknown>[] = [];
    const maxPages = opts?.maxPages ?? 25;
    let cursor: string | number | undefined;
    let hasMore = true;

    for (let page = 0; page < maxPages && hasMore; page++) {
      const pageResult = await this.listBusinessVideosPage(
        accessToken,
        businessId,
        cursor,
        { maxCount: opts?.maxCountPerPage },
      );
      out.push(...pageResult.videos);
      hasMore = pageResult.hasMore;
      cursor = pageResult.cursor;
      if (!pageResult.videos.length && !hasMore) break;
    }

    return out;
  }

  async getAudienceDemographics(
    accessToken: string,
    creatorId: string,
    opts?: { ttoTcmAccountId?: string | null },
  ) {
    const url = `${this.baseUrl}/tto/tcm/creator/public/get/`;

    const params = new URLSearchParams({
      creator_id: creatorId,
      fields: JSON.stringify([
        "audience_age",
        "audience_gender",
        "audience_country",
        "audience_device",
      ]),
    });
    const tto = opts?.ttoTcmAccountId?.trim();
    if (tto) {
      params.set("tto_tcm_account_id", tto);
    }

    const res = await fetch(`${url}?${params.toString()}`, {
      method: "GET",
      headers: {
        "Access-Token": accessToken,
      },
    });

    const data = await this.parseJsonBody(res);
    this.handleErrorResponse(res.status, data);

    return data;
  }

  private handleErrorResponse(status: number, data: any) {
    if (data.code === 0 || data.message === "OK") {
      return;
    }

    console.error("[TikTok Business API Client] Error Response:", {
      status,
      code: data.code,
      message: data.message,
      request_id: data.request_id,
    });

    throw new TikTokBusinessApiError(
      data.message || "TikTok Business API Error",
      status,
      data
    );
  }
}
