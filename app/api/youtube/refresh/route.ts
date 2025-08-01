import { NextRequest, NextResponse } from 'next/server';
import { createOAuthClient } from '@/lib/youtube-api';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    // Verify user authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get creator profile with YouTube account info
    const { data: profile, error: profileError } = await supabase
      .from('creator_profiles')
      .select('youtube_account')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.youtube_account) {
      return NextResponse.json({ error: 'No YouTube account connected' }, { status: 404 });
    }

    const youtubeAccount = profile.youtube_account;
    const oauth2Client = await createOAuthClient();

    // Refresh the token
    oauth2Client.setCredentials({
      refresh_token: youtubeAccount.refresh_token,
      access_token: youtubeAccount.access_token
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Update the tokens in the database
    let newExpiresAt;
    if (credentials.expiry_date) {
      newExpiresAt = new Date(credentials.expiry_date).toISOString();
    } else {
      // Fallback: Assume 1 hour expiry if not provided (Google usually provides this)
      newExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
      console.warn('YouTube refresh: credentials.expiry_date not found, defaulting to 1 hour.');
    }

    const updatedAccount = {
      ...youtubeAccount,
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token || youtubeAccount.refresh_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('creator_profiles')
      .update({
        youtube_account: updatedAccount
      })
      .eq('id', user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      youtubeAccount: updatedAccount,
      access_token: credentials.access_token,
      expires_at: newExpiresAt
    });

  } catch (error) {
    console.error('Error refreshing YouTube token:', error);
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    );
  }
} 