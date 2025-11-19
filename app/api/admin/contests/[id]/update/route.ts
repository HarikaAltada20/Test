import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const resolvedParams = await params;
    const contestId = resolvedParams.id;
    const payload = await request.json();

    // Whitelist allowed columns to prevent accidental/unsafe writes
    const allowedKeys = new Set([
      "title",
      "category",
      "brief_html",
      "brief_json",
      "rules_html",
      "rules_json",
      "inspiration_links",
      "tracking_links",
      "resources",
      "moderation_status",
      "submitted_for_approval_at",
      "rejection_reason",
      "start_date",
      "end_date",
      "contest_type",
      "contest_based_details",
      "thumbnail_url",
      // Categories, subcategories, and interests
      "categories",
      "subcategories",
      "interests",
      // New features (2025-10-01)
      "multiple_submissions_enabled",
      "max_submissions_per_creator",
      "content_type",
      "bonus_details",
      "max_earnings_per_creator",
    ]);

    const updateData: Record<string, any> = {};
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (allowedKeys.has(key)) {
        updateData[key] = value;
      }
    });

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("contests")
      .update(updateData)
      .eq("id", contestId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Admin update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Admin contest update failed:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
