import { createClient } from "@/utils/supabase/client";

export async function refreshYouTubeToken() {
  try {
    const response = await fetch('/api/youtube/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to refresh token');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error refreshing YouTube token:', error);
    throw error;
  }
}

export async function getYouTubeAccount() {
  const supabase = createClient()

  try {
    const { data: profile, error } = await supabase
      .from('creator_profiles')
      .select('youtube_account')
      .single();

    if (error) throw error;
    if (!profile?.youtube_account) return null;

    // Check if token is expired or about to expire (within 5 minutes)
    const expiresAt = new Date(profile.youtube_account.expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    if (expiresAt <= fiveMinutesFromNow) {
      // Token is expired or about to expire, refresh it
      const refreshed = await refreshYouTubeToken();
      return {
        ...profile.youtube_account,
        access_token: refreshed.access_token,
        expires_at: refreshed.expires_at
      };
    }

    return profile.youtube_account;
  } catch (error) {
    console.error('Error getting YouTube account:', error);
    throw error;
  }
} 