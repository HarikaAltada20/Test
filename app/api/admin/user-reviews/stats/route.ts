import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Verify user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (userError || userData?.user_type !== 'admin') {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Call the fast aggregation RPC function
    const { data: stats, error } = await supabase.rpc('get_user_review_stats', { 
      include_all_statuses: true 
    });

    if (error) {
      console.error('Error fetching rating statistics:', error);
      return NextResponse.json({ error: "Failed to fetch rating statistics" }, { status: 500 });
    }

    return NextResponse.json(stats);


  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
