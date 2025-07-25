import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { user_id, user_agent } = await request.json();
  // Get IP address
  const xff = request.headers.get('x-forwarded-for');
  let ip = xff ? xff.split(',')[0].trim() : null;
  if (!ip) {
    // @ts-ignore
    ip = request.ip || request.socket?.remoteAddress || null;
  }
  if (!user_id) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  }
  // Fetch current login_history
  const { data: user, error } = await supabase
    .from('users')
    .select('login_history')
    .eq('id', user_id)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  let history = user?.login_history || [];
  history.unshift({ ip_address: ip, timestamp: new Date().toISOString(), user_agent });
  if (history.length > 10) history = history.slice(0, 10);
  const { error: updateError } = await supabase
    .from('users')
    .update({ login_history: history })
    .eq('id', user_id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
} 