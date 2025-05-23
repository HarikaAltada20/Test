import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server'; // Import Supabase server client
import dayjs from 'dayjs';

export async function POST(request: NextRequest) {
  const supabase = await createClient(); // Create Supabase server client instance

  // 1. Authenticate Supabase User
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('Error authenticating Supabase user:', authError);
    return NextResponse.json({ error: 'User not authenticated in Supabase.' }, { status: 401 });
  }

  try {
    const { code, redirectUri: clientRedirectUri } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Authorization code is missing' }, { status: 400 });
    }
    if (!clientRedirectUri) {
      return NextResponse.json({ error: 'Client redirect URI is missing' }, { status: 400 });
    }

    const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID;
    const clientSecret = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      console.error('Instagram client ID or secret is not configured in environment variables.');
      return NextResponse.json({ error: 'Server configuration error: Instagram credentials missing.' }, { status: 500 });
    }

    // 2. Exchange Instagram Code for Token
    const form = new URLSearchParams();
    form.append('client_id', clientId);
    form.append('client_secret', clientSecret);
    form.append('grant_type', 'authorization_code');
    form.append('redirect_uri', clientRedirectUri);
    form.append('code', code);

    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: form,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error || !tokenData.access_token || !tokenData.user_id) {
      console.error('Instagram token exchange error:', tokenData);
      return NextResponse.json(
        { error: tokenData.error_message || tokenData.error?.message || 'Failed to exchange code for Instagram token', details: tokenData },
        { status: tokenRes.status }
      );
    }
    
    const { access_token: instagram_user_access_token, user_id: instagram_business_id } = tokenData;

    // 3. Fetch Instagram User Profile
    const profileRes = await fetch(`https://graph.instagram.com/me?fields=id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count&access_token=${instagram_user_access_token}`);
    const profileData = await profileRes.json();

    if (!profileRes.ok || profileData.error) {
        console.error('Failed to fetch Instagram User profile (/me):', profileData.error);
        throw new Error(`Failed to fetch Instagram User profile (/me): ${profileData.error?.message || profileRes.statusText}`);
    }
    
    // The 'id' field from /me is the app-scoped ID. The 'user_id' field from tokenData is the Instagram Business Account ID.
    // We should prefer the `instagram_business_id` for API calls, and `profileData.id` (app_scoped_user_id)
    // `profileData.username` is the actual username.
    
    // 4. Store in Supabase (`creator_profiles.instagram_account`)
    const instagramAccountData = {
        access_token: instagram_user_access_token,
        instagram_user_id: instagram_business_id, // This is the IGBA ID
        username: profileData.username,
        profile_picture_url: profileData.profile_picture_url,
        followers_count: profileData.followers_count,
        follows_count: profileData.follows_count,
        media_count: profileData.media_count,
        account_type: profileData.account_type,
        token_expiry: dayjs().add(59, 'days').toISOString(), // Instagram long-lived tokens are typically 60 days. Refresh before that.
        name_of_account: profileData.name,
        app_scoped_user_id: profileData.id, // This is the app-scoped ID from the /me endpoint
        updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
        .from('creator_profiles')
        .update({ instagram_account: instagramAccountData as any })
        .eq('id', user.id);

    if (updateError) {
        console.error('Supabase update error:', updateError);
        throw new Error(`Failed to update creator profile in Supabase: ${updateError.message}`);
    }

    return NextResponse.json({ success: true, message: 'Instagram account connected and profile updated.' });

  } catch (error: any) {
    console.error('Error in /api/instagram/exchange-token:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error during Instagram token exchange.' }, { status: 500 });
  }
} 