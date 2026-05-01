import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getDailyChallengeConfig } from "@/lib/daily-challenge";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const config = await getDailyChallengeConfig();
    return NextResponse.json({ config });
  } catch (error) {
    console.error("[competition/config] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
