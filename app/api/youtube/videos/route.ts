import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getUserVideos } from '@/lib/youtube-api';

export async function GET() {
  try {
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

    // Verify user authentication with server
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Authentication error:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get creator profile with YouTube account info
    const { data: profile, error: profileError } = await supabase
      .from('creator_profiles')
      .select('youtube_account')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching creator profile:', profileError);
      return NextResponse.json({ error: 'Failed to fetch creator profile' }, { status: 500 });
    }

    if (!profile?.youtube_account) {
      return NextResponse.json({ error: 'No YouTube account connected' }, { status: 404 });
    }

    // Check if token is expired
    if (profile.youtube_account.expires_at && new Date(profile.youtube_account.expires_at) <= new Date()) {
      return NextResponse.json({ error: 'YouTube token expired' }, { status: 401 });
    }

    const videos = await getUserVideos(profile.youtube_account.access_token);
    
    if (!videos) {
      return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
    }

    return NextResponse.json({ videos });

  } catch (error) {
    console.error('Error in YouTube videos endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch YouTube videos' },
      { status: 500 }
    );
  }
} 