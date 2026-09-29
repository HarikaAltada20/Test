import { NextRequest, NextResponse } from 'next/server';
import { createOAuthClient } from '@/lib/youtube-api';
import { createClient } from '@/utils/supabase/server';

export async function POST(_request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('creator_profiles')
    .select('youtube_account')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.youtube_account) {
    return NextResponse.json(
      { error: 'No YouTube account connected' },
      { status: 404 },
    );
  }

  const youtubeAccount = profile.youtube_account;

  try {
    const oauth2Client = await createOAuthClient();

    oauth2Client.setCredentials({
      refresh_token: youtubeAccount.refresh_token,
      access_token: youtubeAccount.access_token,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    let newExpiresAt;
    if (credentials.expiry_date) {
      newExpiresAt = new Date(credentials.expiry_date).toISOString();
    } else {
      newExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
      console.warn(
        'YouTube refresh: credentials.expiry_date not found, defaulting to 1 hour.',
      );
    }

    const updatedAccount = {
      ...youtubeAccount,
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token || youtubeAccount.refresh_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
      needs_reconnect: false,
    };

    const { error: updateError } = await supabase
      .from('creator_profiles')
      .update({
        youtube_account: updatedAccount,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error saving refreshed YouTube token:', updateError);
      return NextResponse.json(
        { error: 'Failed to save refreshed token' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      youtubeAccount: updatedAccount,
      access_token: credentials.access_token,
      expires_at: newExpiresAt,
    });
  } catch (error) {
    console.error('Error refreshing YouTube token:', error);
    await supabase
      .from('creator_profiles')
      .update({
        youtube_account: {
          ...youtubeAccount,
          needs_reconnect: true,
          updated_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 },
    );
  }
}
