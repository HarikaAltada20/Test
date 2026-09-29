export interface PlatformToken {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    tokenType?: string;
    scope?: string;
}

export interface CreatorProfile {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    followerCount?: number;
    followingCount?: number;
    likesCount?: number;
    videoCount?: number;
}

export interface VideoMetrics {
    videoId: string;
    platform: string;
    creatorId: string;
    url: string;
    title?: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    saveCount: number;
    duration?: number;
    publishedAt: Date;
}

export interface VideoList {
    videos: { id: string; url: string; publishedAt: string }[];
    nextCursor?: string;
}

export interface IPlatformProvider {
    readonly platformId: string;

    // OAuth Lifecycle
    generateAuthUrl(state: string, codeVerifier?: string, redirectUri?: string): string;
    exchangeCodeForToken(code: string, codeVerifier?: string, redirectUri?: string): Promise<PlatformToken>;
    refreshAccessToken(refreshToken: string): Promise<PlatformToken>;

    // Data Fetching
    getProfile(accessToken: string): Promise<CreatorProfile>;
    getRecentVideos(accessToken: string, since?: Date): Promise<VideoList>;
    getVideoMetrics(accessToken: string, videoIds: string[]): Promise<VideoMetrics[]>;
}