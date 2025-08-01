import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import dayjs from 'dayjs';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const supabase = await createClient();

    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile, error: profileError } = await supabase
            .from('creator_profiles')
            .select('instagram_account')
            .eq('id', user.id)
            .single();

        if (profileError || !profile?.instagram_account?.access_token) {
            return NextResponse.json({ error: 'Instagram account not found or access token missing.' }, { status: 404 });
        }

        const currentToken = profile.instagram_account.access_token;

        const refreshRes = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`);
        const refreshData = await refreshRes.json();

        if (!refreshRes.ok || refreshData.error) {
            console.error('Failed to refresh Instagram long-lived token:', refreshData.error);
            // If refresh fails, it might mean the token is truly expired or revoked.
            // The user might need to re-authenticate fully via the OAuth flow.
            return NextResponse.json({ error: refreshData.error?.message || 'Failed to refresh Instagram token.' }, { status: 500 });
        }

        const { access_token: new_long_lived_token, expires_in: new_expires_in } = refreshData;

        if (!new_long_lived_token || typeof new_expires_in === 'undefined') {
            throw new Error('New long-lived access token or expires_in not received from Instagram after refresh.');
        }

        const newActualTokenExpiry = dayjs().add(new_expires_in, 'seconds').toISOString();

        const updatedInstagramAccountData = {
            ...profile.instagram_account,
            access_token: new_long_lived_token,
            token_expiry: newActualTokenExpiry,
            updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
            .from('creator_profiles')
            .update({
                instagram_account: updatedInstagramAccountData,
            })
            .eq('id', user.id);

        if (updateError) {
            console.error('Supabase update error after refreshing Instagram token:', updateError);
            throw new Error(`Failed to update creator profile with new Instagram token: ${updateError.message}`);
        }

        console.log('Instagram long-lived token refreshed successfully for user:', user.id);
        return NextResponse.json({ 
            success: true, 
            message: 'Instagram token refreshed successfully.', 
            instagramAccount: updatedInstagramAccountData,
            new_expiry: newActualTokenExpiry 
        });

    } catch (err: any) {
        console.error('Error during Instagram token refresh process:', err);
        return NextResponse.json({ error: err.message || 'An unexpected error occurred during token refresh.' }, { status: 500 });
    }
} 