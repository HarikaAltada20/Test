import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Try to get the IP from x-forwarded-for header (works with Vercel, proxies, etc.)
  const xff = request.headers.get('x-forwarded-for');
  let ip = xff ? xff.split(',')[0].trim() : null;
  if (!ip) {
    // Fallback to remote address
    // @ts-ignore
    ip = request.ip || request.socket?.remoteAddress || null;
  }
  return NextResponse.json({ ip });
} 