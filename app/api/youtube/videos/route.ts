import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createOAuthClient, getUserVideos } from '@/lib/youtube-api';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get the session to check if the user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get the user's YouTube account info
    const { data: accountData } = await supabase
      .from('creator_youtube_accounts')
      .select('*')
      .eq('creator_id', session.user.id)
      .single();
    
    if (!accountData || !accountData.access_token) {
      return NextResponse.json(
        { error: 'YouTube account not connected' },
        { status: 404 }
      );
    }
    
    // Get user's YouTube videos using our updated function
    const videos = await getUserVideos(accountData.access_token);
    
    // Return the videos
    return NextResponse.json({ videos });
  } catch (error: any) {
    console.error('Error fetching YouTube videos:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch YouTube videos' },
      { status: 500 }
    );
  }
} 