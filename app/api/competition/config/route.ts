import { NextResponse } from "next/server";
import { getDailyChallengeConfig } from "@/lib/daily-challenge";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await getDailyChallengeConfig();
    return NextResponse.json({ config });
  } catch (error) {
    console.error("[competition/config] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
