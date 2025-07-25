import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET() {
  return NextResponse.json({ message: 'Patch providers API is working' });
}

export async function POST(request: NextRequest) {
  try {
    const { user_id, providers } = await request.json();
    console.log('Patching providers for user:', user_id, 'with providers:', providers);
    
    const supabaseAdmin = createAdminClient();
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      {
        app_metadata: { providers }
      }
    );

    if (updateError) {
      console.error('Supabase admin API error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    console.log('Successfully patched providers');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in patch-providers API:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 