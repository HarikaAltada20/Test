import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'Patch providers API is working' });
}

export async function POST(request: NextRequest) {
  try {
    const { user_id, providers } = await request.json();
    console.log('Patching providers for user:', user_id, 'with providers:', providers);
    
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      console.error('Missing environment variables:', { serviceRoleKey: !!serviceRoleKey, supabaseUrl: !!supabaseUrl });
      return NextResponse.json({ error: 'Missing Supabase service role key or URL' }, { status: 500 });
    }

    console.log('Making request to Supabase admin API...');
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ app_metadata: { providers } }),
    });

    console.log('Supabase response status:', res.status);
    
    if (!res.ok) {
      const error = await res.text();
      console.error('Supabase API error:', error);
      return NextResponse.json({ error }, { status: res.status });
    }

    console.log('Successfully patched providers');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in patch-providers API:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 