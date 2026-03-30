import {
  PlatformToken,
  CreatorProfile,
  VideoMetrics,
  VideoList,
  IPlatformProvider,
} from "../../core/interfaces/IPlatformProvider";
import { TikTokApiClient } from "../api/TikTokApiClient";
import crypto from "crypto";

export class TikTokProvider implements IPlatformProvider {
  readonly platformId = "tiktok";
  private client: TikTokApiClient;

  constructor(client?: TikTokApiClient) {
    // Allows dependency injection for testing or fallback to default
    this.client = client || new TikTokApiClient();
  }

  generateAuthUrl(
    state: string,
    codeVerifier?: string,
    customRedirectUri?: string,
  ): string {
    const baseUrl = "https://www.tiktok.com/v2/auth/authorize/";
    const clientKey = this.client.getClientKey();
    const redirectUri = customRedirectUri || this.client.getRedirectUri();

    // Required scopes for TikTok API
    // user.info.basic: open_id, union_id, avatar_url, display_name
    // user.info.profile: username, bio_description, is_verified, profile_deep_link
    // user.info.stats: follower_count, following_count, likes_count, video_count (requires approval)
    // video.list: access to user's video list
    const scopes =
      "user.info.basic,user.info.profile,user.info.stats,video.list";

    const url = new URL(baseUrl);
    url.searchParams.append("client_key", clientKey);
    url.searchParams.append("response_type", "code");
    url.searchParams.append("scope", scopes);
    url.searchParams.append("redirect_uri", redirectUri);
    url.searchParams.append("state", state);

    if (codeVerifier) {
      // TikTok uses HEX-encoded SHA256 for code_challenge (NOT base64url per RFC 7636)
      const codeChallenge = crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("hex");

      console.log(
        "[TikTok Provider] Generated code_challenge from verifier (first 10):",
        codeChallenge.substring(0, 10),
      );

      url.searchParams.append("code_challenge", codeChallenge);
      url.searchParams.append("code_challenge_method", "S256");
    }

    return url.toString();
  }

  async exchangeCodeForToken(
    code: string,
    codeVerifier?: string,
    customRedirectUri?: string,
  ): Promise<PlatformToken> {
    const data = await this.client.getAccessToken(
      code,
      codeVerifier,
      customRedirectUri,
    );

    return {
      accessToken: data.data?.access_token || data.access_token,
      refreshToken: data.data?.refresh_token || data.refresh_token,
      expiresIn: data.data?.expires_in || data.expires_in,
      tokenType: data.data?.token_type || data.token_type,
      scope: data.data?.scope || data.scope,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformToken> {
    const data = await this.client.refreshAccessToken(refreshToken);

    return {
      accessToken: data.data?.access_token || data.access_token,
      refreshToken: data.data?.refresh_token || data.refresh_token,
      expiresIn: data.data?.expires_in || data.expires_in,
      tokenType: data.data?.token_type || data.token_type,
      scope: data.data?.scope || data.scope,
    };
  }

  async getProfile(accessToken: string): Promise<CreatorProfile> {
    const response = await this.client.getUserInfo(accessToken);
    const user = response.data?.user || response.data;

    return {
      id: user.open_id || user.union_id,
      username: user.username || user.display_name,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      followerCount: user.follower_count,
      followingCount: user.following_count,
      likesCount: user.likes_count,
      videoCount: user.video_count,
    };
  }

  async getRecentVideos(accessToken: string, since?: Date): Promise<VideoList> {
    // For simplicity, fetching page 1
    const response = await this.client.getVideoList(accessToken);
    const videos = response.data?.videos || [];

    let mapped = videos.map((v: any) => {
      const createTime = v.create_time
        ? parseInt(v.create_time.toString(), 10)
        : null;
      let publishedAt = new Date().toISOString();

      if (createTime && !isNaN(createTime)) {
        try {
          publishedAt = new Date(createTime * 1000).toISOString();
        } catch (e) {
          console.warn(
            "[TikTokProvider] Failed to convert create_time to ISO string:",
            createTime,
          );
        }
      }

      return {
        id: v.id,
        url: v.share_url,
        publishedAt,
        title: v.title || v.video_description,
        cover_image_url: v.cover_image_url,
        duration: v.duration,
        view_count: v.view_count || 0,
        like_count: v.like_count || 0,
        comment_count: v.comment_count || 0,
        share_count: v.share_count || 0,
      };
    });

    // Filter videos by date if since parameter is provided and valid
    if (since && !isNaN(since.getTime())) {
      const sinceTime = since.getTime();
      mapped = mapped.filter((video: any) => {
        const videoTime = new Date(video.publishedAt).getTime();
        return !isNaN(videoTime) && videoTime >= sinceTime;
      });
    }

    return {
      videos: mapped,
      nextCursor: response.data?.cursor?.toString(),
    };
  }

  async getVideoMetrics(
    accessToken: string,
    videoIds: string[],
  ): Promise<VideoMetrics[]> {
    if (!videoIds.length) return [];

    const response = await this.client.queryVideos(accessToken, videoIds);
    const videos = response.data?.videos || response.data || [];

    return videos.map((v: any) => {
      const createTime = v.create_time
        ? parseInt(v.create_time.toString(), 10)
        : null;
      const publishedAt =
        createTime && !isNaN(createTime)
          ? new Date(createTime * 1000)
          : new Date();

      return {
        videoId: v.id,
        platform: this.platformId,
        creatorId: "unknown", // will be injected by SyncService
        url: v.share_url,
        title: v.title || v.video_description,
        viewCount: v.view_count || 0,
        likeCount: v.like_count || 0,
        commentCount: v.comment_count || 0,
        shareCount: v.share_count || 0,
        duration: v.duration,
        cover_image_url: v.cover_image_url,
        publishedAt,
      };
    });
  }
}
