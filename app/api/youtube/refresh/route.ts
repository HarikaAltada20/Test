import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createOAuthClient } from '@/lib/youtube-api';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

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
    const expiresAt = new Date(Date.now() + (credentials.expiry_date! - Date.now())).toISOString();
    const updatedAccount = {
      ...youtubeAccount,
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token || youtubeAccount.refresh_token,
      expires_at: expiresAt,
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
      access_token: credentials.access_token,
      expires_at: expiresAt
    });

  } catch (error) {
    console.error('Error refreshing YouTube token:', error);
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    );
  }
} 