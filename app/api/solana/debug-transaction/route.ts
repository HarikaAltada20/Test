import { NextRequest, NextResponse } from 'next/server';
import { debugTransaction } from '@/lib/solana-utils-no-memo';

export async function POST(request: NextRequest) {
  try {
    const { signature } = await request.json();

    if (!signature) {
      return NextResponse.json(
        { error: 'Transaction signature is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Debug request for signature:', signature);
    
    // Run debug analysis
    await debugTransaction(signature);

    return NextResponse.json({
      success: true,
      message: 'Debug analysis completed. Check server logs for details.',
      signature
    });

  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      { error: 'Failed to debug transaction' },
      { status: 500 }
    );
  }
}
