/**
 * TikTok Business (TTO/TCM) API Client
 * Handles communication with the TikTok for Business / TikTok One APIs.
 */

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
    this.redirectUri = `${appUrl}/api/tiktok/marketing/callback`;

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
   * Endpoint: /oauth2/get/
   */
  async getAccessToken(code: string) {
    const url = `${this.baseUrl}/oauth2/get/`;
    
    // TikTok Business API uses JSON body for token exchange in some versions, 
    // but the unified V1.3 often uses application/json
    const body = {
      app_id: this.appId,
      secret: this.secret,
      auth_code: code,
    };

    console.log("[TikTok Business API] POST /oauth2/get/ with app_id:", this.appId);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    this.handleErrorResponse(res.status, data);

    return data;
  }

  /**
   * Refreshes the access token.
   * Note: Some Business API apps don't provide refresh tokens; they use long-lived tokens.
   */
  async refreshAccessToken(refreshToken: string) {
    // TTO Refresh implementation if available
    // For now, returning the same or throwing if not supported
    throw new Error("Refresh token flow not implemented for Business API yet.");
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

    const data = await res.json();
    this.handleErrorResponse(res.status, data);

    return data;
  }

  /**
   * Fetches detailed performance metrics for a specific video.
   * Endpoint: /tto/tcm/report/
   */
  async getTcmReport(accessToken: string, videoUrl: string) {
    const url = `${this.baseUrl}/tto/tcm/report/`;
    
    // The TTO report API usually takes a video URL or ID
    const params = new URLSearchParams({
      video_url: videoUrl,
    });

    const res = await fetch(`${url}?${params.toString()}`, {
      method: "GET",
      headers: {
        "Access-Token": accessToken,
      },
    });

    const data = await res.json();
    this.handleErrorResponse(res.status, data);

    return data;
  }

  /**
   * Fetches audience demographics for the creator.
   * Endpoint: /tto/tcm/creator/public/get/
   */
  async getAudienceDemographics(accessToken: string, creatorId: string) {
    const url = `${this.baseUrl}/tto/tcm/creator/public/get/`;
    
    const params = new URLSearchParams({
      creator_id: creatorId,
      fields: JSON.stringify(["audience_age", "audience_gender", "audience_country", "audience_device"]),
    });

    const res = await fetch(`${url}?${params.toString()}`, {
      method: "GET",
      headers: {
        "Access-Token": accessToken,
      },
    });

    const data = await res.json();
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
