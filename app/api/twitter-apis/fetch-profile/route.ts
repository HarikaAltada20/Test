import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const screenname = (body?.screenname || '').trim();

    if (!screenname) {
      return NextResponse.json(
        { error: 'Missing screenname' },
        { status: 400 }
      );
    }

    const apiKey = process.env.TWITTER_RAPIDAPI_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Twitter API key is not configured on the server' },
        { status: 500 }
      );
    }

    const response = await axios.request({
      method: 'GET',
      url: 'https://twitter-api45.p.rapidapi.com/screenname.php',
      params: { screenname },
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'twitter-api45.p.rapidapi.com',
      },
    });

    const data = response.data;

    if (!data || data.status !== 'active') {
      return NextResponse.json(
        { error: 'Unable to fetch active X profile' },
        { status: 404 }
      );
    }

    // Return full data so client can pick what it needs
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching Twitter profile via RapidAPI:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch Twitter profile' },
      { status: 500 }
    );
  }
}
