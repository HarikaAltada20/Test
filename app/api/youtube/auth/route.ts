import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createOAuthClient, getAuthUrl } from '@/lib/youtube-api';

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const oauth2Client = await createOAuthClient();
  const authUrl = await getAuthUrl(oauth2Client);
  
  return NextResponse.redirect(authUrl);
} 