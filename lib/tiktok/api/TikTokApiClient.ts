/**
 * TikTok API Client Layer
 * Strictly handles HTTP external network interactions with TikTok.
 * Knows nothing about databases or Supabase.
 */

export class TikTokApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly rawBody?: any,
  ) {
    super(message);
    this.name = "TikTokApiError";
  }
}

export class RateLimitExceededException extends TikTokApiError {
  constructor(message: string, rawBody?: any) {
    super(message, 429, rawBody);
    this.name = "RateLimitExceededException";
  }
}

export class InvalidTokenException extends TikTokApiError {
  constructor(message: string, rawBody?: any) {
    super(message, 401, rawBody);
    this.name = "InvalidTokenException";
  }
}

/** Display API video/list & video/query fields — https://developers.tiktok.com/doc/tiktok-api-v2-video-object */
export const TIKTOK_DISPLAY_VIDEO_FIELDS =
  "id,create_time,cover_image_url,share_url,video_description,duration,title,view_count,like_count,comment_count,share_count";

export class TikTokApiClient {
  private readonly baseUrl = "https://open.tiktokapis.com/v2";
  private readonly clientKey: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor() {
    this.clientKey = (process.env.NEXT_PUBLIC_TIKTOK_CLIENT_ID || "")
      .replace(/^["']|["']$/g, "")
      .trim();
    this.clientSecret = (process.env.TIKTOK_CLIENT_SECRET || "")
      .replace(/^["']|["']$/g, "")
      .trim();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    this.redirectUri =
      (process.env.TIKTOK_REDIRECT_URI || "").trim() ||
      `${appUrl}/api/auth/tiktok/callback`;

    // Debug logging
    // console.log(
    //   "[TikTokApiClient] Client Key loaded:",
    //   this.clientKey
    //     ? "Yes (length: " + this.clientKey.length + ")"
    //     : "NO - Check NEXT_PUBLIC_TIKTOK_CLIENT_ID env var",
    // );
    // console.log(
    //   "[TikTokApiClient] Client Secret loaded:",
    //   this.clientSecret ? "Yes" : "NO",
    // );
    // console.log("[TikTokApiClient] Redirect URI:", this.redirectUri);
  }

  getRedirectUri(): string {
    return this.redirectUri;
  }

  getClientKey(): string {
    return this.clientKey;
  }

  async getAccessToken(
    code: string,
    codeVerifier?: string,
    customRedirectUri?: string,
  ) {
    const params = new URLSearchParams();
    params.append("client_key", this.clientKey);
    params.append("client_id", this.clientKey); // Some TikTok apps require client_id instead
    params.append("client_secret", this.clientSecret);
    params.append("code", code);
    params.append("grant_type", "authorization_code");
    params.append("redirect_uri", customRedirectUri || this.redirectUri);

    // TikTok requires PKCE code_verifier when PKCE is enabled in app settings
    if (codeVerifier) {
      params.append("code_verifier", codeVerifier);
    }

    // Avoid logging OAuth secrets (code, verifier, full redirect URI) in production logs.

    const res = await fetch(`https://open.tiktokapis.com/v2/oauth/token/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      body: params.toString(),
    });

    let data;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error(
        "[TikTok API Client] Failed to parse JSON response. Status:",
        res.status,
        "Body snippet:",
        text.substring(0, 100),
      );
      throw new TikTokApiError(
        `TikTok API returned non-JSON response (Status: ${res.status})`,
        res.status,
        text,
      );
    }
    this.handleErrorResponse(res.status, data);

    return data;
  }

  async refreshAccessToken(refreshToken: string) {
    const params = new URLSearchParams();
    params.append("client_key", this.clientKey);
    params.append("client_secret", this.clientSecret);
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", refreshToken);

    const res = await fetch(`https://open.tiktokapis.com/v2/oauth/token/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      body: params.toString(),
    });

    let data;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error(
        "[TikTok API Client] Failed to parse JSON response. Status:",
        res.status,
        "Body snippet:",
        text.substring(0, 100),
      );
      throw new TikTokApiError(
        `TikTok API returned non-JSON response (Status: ${res.status})`,
        res.status,
        text,
      );
    }
    this.handleErrorResponse(res.status, data);

    return data;
  }

  async getUserInfo(accessToken: string) {
    // TikTok scopes map to specific fields:
    // user.info.basic: open_id, union_id, avatar_url, display_name
    // user.info.profile: username, bio_description, is_verified, profile_deep_link
    // user.info.stats: follower_count, following_count, likes_count, video_count (requires approval)
    // Try progressively fewer fields if scopes aren't authorized
    const fieldSets = [
      "open_id,union_id,avatar_url,display_name,username,follower_count,following_count,likes_count,video_count",
      "open_id,union_id,avatar_url,display_name,username",
      "open_id,union_id,avatar_url,display_name",
    ];

    for (let i = 0; i < fieldSets.length; i++) {
      const data = await this._fetchUserInfo(accessToken, fieldSets[i]);

      if (
        data?.error?.code === "scope_not_authorized" &&
        i < fieldSets.length - 1
      ) {
        console.warn(
          `[TikTok API Client] Scope not authorized for field set ${i + 1}, trying with fewer fields...`,
        );
        continue;
      }

      // On the last field set, throw if there's still an error
      if (data?.error?.code === "scope_not_authorized") {
        console.warn(
          "[TikTok API Client] Even basic scope not authorized, returning minimal data",
        );
      }

      return data;
    }

    // Should never reach here, but just in case
    return this._fetchUserInfo(accessToken, fieldSets[fieldSets.length - 1]);
  }

  private async _fetchUserInfo(accessToken: string, fields: string) {
    const res = await fetch(`${this.baseUrl}/user/info/?fields=${fields}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let data;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error(
        "[TikTok API Client] Failed to parse JSON response. Status:",
        res.status,
        "Body snippet:",
        text.substring(0, 100),
      );
      throw new TikTokApiError(
        `TikTok API returned non-JSON response (Status: ${res.status})`,
        res.status,
        text,
      );
    }

    // Only throw for errors other than scope_not_authorized (handled by caller)
    if (data?.error?.code === "scope_not_authorized") {
      return data;
    }
    this.handleErrorResponse(res.status, data);
    return data;
  }

  async getVideoList(accessToken: string, cursor?: string) {
    const body = {
      max_count: 20,
      cursor: cursor ? parseInt(cursor, 10) : undefined,
    };

    const res = await fetch(
      `${this.baseUrl}/video/list/?fields=${TIKTOK_DISPLAY_VIDEO_FIELDS}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    let data;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error(
        "[TikTok API Client] Failed to parse JSON response. Status:",
        res.status,
        "Body snippet:",
        text.substring(0, 100),
      );
      throw new TikTokApiError(
        `TikTok API returned non-JSON response (Status: ${res.status})`,
        res.status,
        text,
      );
    }
    this.handleErrorResponse(res.status, data);
    return data;
  }

  async queryVideos(accessToken: string, videoIds: string[]) {
    const body = {
      filters: {
        video_ids: videoIds,
      },
    };

    const res = await fetch(
      `${this.baseUrl}/video/query/?fields=${TIKTOK_DISPLAY_VIDEO_FIELDS}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    let data;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error(
        "[TikTok API Client] Failed to parse JSON response. Status:",
        res.status,
        "Body snippet:",
        text.substring(0, 100),
      );
      throw new TikTokApiError(
        `TikTok API returned non-JSON response (Status: ${res.status})`,
        res.status,
        text,
      );
    }
    this.handleErrorResponse(res.status, data);
    return data;
  }

  private handleErrorResponse(status: number, data: any) {
    if (
      status >= 200 &&
      status < 300 &&
      (!data.error || data.error.code === "ok")
    ) {
      return;
    }

    // console.error("[TikTok API Client] Error Response:", {
    //   status,
    //   data: JSON.stringify(data),
    // });

    // TikTok OAuth errors often use error_description
    // Other errors might use error.message or just message
    const message =
      data.error_description ||
      data.error?.message ||
      data.message ||
      (typeof data.error === "string" ? data.error : "TikTok API Error");

    if (status === 401 || data.error?.code === "unauthorized") {
      throw new InvalidTokenException(message, data);
    }

    if (status === 429) {
      throw new RateLimitExceededException(message, data);
    }

    throw new TikTokApiError(message, status, data);
  }
}
