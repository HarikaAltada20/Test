import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Call the fast aggregation RPC function
    const { data: stats, error } = await supabase.rpc('get_user_review_stats', { 
      include_all_statuses: false 
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
