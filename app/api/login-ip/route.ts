import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getGeoDataForIp, buildGeoDataColumn } from '@/lib/geo-ip';

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
  // Simple user agent parser for browser and OS
  function parseUserAgent(ua: string) {
    let browser_name = 'Unknown', browser_version = '', os_name = 'Unknown', os_version = '';
    // Browser
    if (/Chrome\/(\d+\.\d+)/.test(ua)) {
      browser_name = 'Chrome';
      browser_version = ua.match(/Chrome\/(\d+\.\d+)/)![1];
    } else if (/Firefox\/(\d+\.\d+)/.test(ua)) {
      browser_name = 'Firefox';
      browser_version = ua.match(/Firefox\/(\d+\.\d+)/)![1];
    } else if (/Safari\/(\d+\.\d+)/.test(ua) && /Version\/(\d+\.\d+)/.test(ua)) {
      browser_name = 'Safari';
      browser_version = ua.match(/Version\/(\d+\.\d+)/)![1];
    } else if (/Edg\/(\d+\.\d+)/.test(ua)) {
      browser_name = 'Edge';
      browser_version = ua.match(/Edg\/(\d+\.\d+)/)![1];
    }
    // OS
    if (/Windows NT ([\d\.]+)/.test(ua)) {
      os_name = 'Windows';
      os_version = ua.match(/Windows NT ([\d\.]+)/)![1];
    } else if (/Mac OS X ([\d_]+)/.test(ua)) {
      os_name = 'Mac OS X';
      os_version = ua.match(/Mac OS X ([\d_]+)/)![1].replace(/_/g, '.');
    } else if (/Android ([\d\.]+)/.test(ua)) {
      os_name = 'Android';
      os_version = ua.match(/Android ([\d\.]+)/)![1];
    } else if (/iPhone OS ([\d_]+)/.test(ua)) {
      os_name = 'iOS';
      os_version = ua.match(/iPhone OS ([\d_]+)/)![1].replace(/_/g, '.');
    }
    return { browser_name, browser_version, os_name, os_version, user_agent: ua };
  }
  const uaInfo = parseUserAgent(user_agent || '');
  const geo_data = await getGeoDataForIp(ip);
  const { data: user, error } = await supabase
    .from('users')
    .select('login_history')
    .eq('id', user_id)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  let history = user?.login_history || [];
  history.unshift({
    ip_address: ip,
    timestamp: new Date().toISOString(),
    ...uaInfo,
  });
  if (history.length > 10) history = history.slice(0, 10);
  const geoDataColumn = buildGeoDataColumn(ip, geo_data);
  const updatePayload: { login_history: typeof history; geo_data?: { ip: string; geo_data: typeof geo_data }; updated_at: string } = {
    login_history: history,
    updated_at: new Date().toISOString(),
  };
  if (geoDataColumn) updatePayload.geo_data = geoDataColumn;
  const { error: updateError } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', user_id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
} 