import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Handles campaign form submissions -> saves to campaign_form_submissions table
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string" || email.trim() === "") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const now = new Date().toISOString();

    // Check if submission already exists in campaign_form_submissions
    const { data: existing, error: checkError } = await supabase
      .from("campaign_form_submissions")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      console.error(
        "Error checking existing campaign form submission:",
        checkError
      );
      return NextResponse.json(
        { error: "Failed to check existing campaign submission" },
        { status: 500 }
      );
    }

    if (existing) {
      // Update existing record with submitted_at timestamp
      const { error: updateError } = await supabase
        .from("campaign_form_submissions")
        .update({ submitted_at: now })
        .eq("email", email);

      if (updateError) {
        console.error("Error updating campaign form submission:", updateError);
        return NextResponse.json(
          { error: "Failed to update campaign form submission" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Campaign form submission updated",
        email: email,
        submitted_at: now,
        form_type: "campaign",
      });
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from("campaign_form_submissions")
        .insert({
          email: email,
          submitted_at: now,
        });

      if (insertError) {
        console.error("Error saving campaign form submission:", insertError);
        return NextResponse.json(
          { error: "Failed to save campaign form submission" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Campaign form submission saved",
        email: email,
        submitted_at: now,
        form_type: "campaign",
      });
    }
  } catch (error: any) {
    console.error("Error in campaign form submission API:", error);
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}
