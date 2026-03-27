import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const tiktokClientId = process.env.NEXT_PUBLIC_TIKTOK_CLIENT_ID;
    const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

    if (!tiktokClientId) {
        return NextResponse.json(
            { error: 'TikTok Client ID is not configured' },
            { status: 500 }
        );
    }

    if (!appBaseUrl) {
        return NextResponse.json(
            { error: 'Application Base URL is not configured' },
            { status: 500 }
        );
    }

    try {
        // Debug: Check if client ID is properly loaded
        console.log('TikTok Client ID:', tiktokClientId ? 'Found' : 'Not found');
        console.log('App Base URL:', appBaseUrl);
        
        // Generate PKCE code verifier and challenge
        const codeVerifier = randomBytes(32).toString('base64url');
        const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
        
        console.log('Generated PKCE challenge:', codeChallenge ? 'Success' : 'Failed');
        
        // Store code verifier in state for later use in callback
        const state = JSON.stringify({
            timestamp: Date.now(),
            code_verifier: codeVerifier
        });

        // Must exactly match one of the Valid OAuth Redirect URIs in TikTok Developer Portal
        const tiktokRedirectUri = `${appBaseUrl}/api/tiktok/callback`;

        const scopes = [
            "user.info.basic",
            "user.info.profile",
            "user.info.stats"
        ].join(",");

        // TikTok OAuth URL for web with PKCE
        const authUrl = `https://www.tiktok.com/v2/auth/authorize?client_key=${tiktokClientId}&redirect_uri=${encodeURIComponent(
            tiktokRedirectUri
        )}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(
            state
        )}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`;

        console.log('Generated Auth URL:', authUrl.substring(0, 200) + '...');

        return NextResponse.redirect(authUrl);
    } catch (error: any) {
        console.error('Error initiating TikTok connection:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to initiate TikTok connection' },
            { status: 500 }
        );
    }
}