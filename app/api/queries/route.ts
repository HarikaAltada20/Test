import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

interface QueryRequestBody {
  email: string;
  query_text: string;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = (await req.json()) as QueryRequestBody;
    const { email, query_text } = body;

    if (!email || !query_text) {
      return NextResponse.json(
        { success: false, error: "Missing email or query text" },
        { status: 400 }
      );
    }

    // 1. Get user details from users table
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, user_type")
      .eq("email", email)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // 2. Insert into queries with user.id and user.user_type
    const { data: insertedData, error: insertError } = await supabase
      .from("queries")
      .insert([
        {
          user_id: user.id,       // from users table
          user_type: user.user_type, // from users table
          query_text,
          created_at: new Date(),
        },
      ])
      .select();

    if (insertError) {
      console.error("❌ Insert error:", insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data: insertedData },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("❌ Query API error:", error);
    let errorMessage = "Unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
