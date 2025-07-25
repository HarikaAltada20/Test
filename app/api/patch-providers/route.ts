import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { user_id, providers } = await request.json();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Missing Supabase service role key or URL' }, { status: 500 });
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user_id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ app_metadata: { providers } }),
  });

  if (!res.ok) {
    const error = await res.text();
    return NextResponse.json({ error }, { status: res.status });
  }

  return NextResponse.json({ success: true });
} 