import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { newEmail } = body;

    if (!newEmail || typeof newEmail !== "string") {
      return NextResponse.json(
        { error: "New email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const userId = user.id;
    const trimmedEmail = newEmail.trim();

    // Use admin client to force-update the email (bypasses double confirmation)
    const supabaseAdmin = createAdminClient();

    console.log(`Force-updating email for user ${userId} to ${trimmedEmail}`);

    const { data, error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: trimmedEmail,
      });

    if (updateError) {
      console.error("Error force-updating email:", updateError);
      return NextResponse.json(
        {
          error: updateError.message || "Failed to update email",
          details: updateError,
        },
        { status: 400 }
      );
    }

    if (!data?.user) {
      return NextResponse.json(
        { error: "Email update completed but user data not returned" },
        { status: 500 }
      );
    }

    // Verify the email was actually updated
    const updatedEmail = data.user.email?.toLowerCase();
    const expectedEmail = trimmedEmail.toLowerCase();

    if (updatedEmail !== expectedEmail) {
      console.error(
        `Email mismatch after update. Expected: ${expectedEmail}, Got: ${updatedEmail}`
      );
      return NextResponse.json(
        {
          error: "Email update completed but verification failed",
          expected: expectedEmail,
          actual: updatedEmail,
        },
        { status: 500 }
      );
    }

    console.log(`Email successfully force-updated to ${updatedEmail}`);

    // Update the users table to keep it in sync
    const { error: usersTableError } = await supabaseAdmin
      .from("users")
      .update({ email: data.user.email })
      .eq("id", userId);

    if (usersTableError) {
      console.error("Error updating users table:", usersTableError);
      // Don't fail the request - auth email is updated which is critical
      // Users table can be synced later
    }

    return NextResponse.json({
      success: true,
      message: "Email updated successfully",
      email: data.user.email,
    });
  } catch (error: any) {
    console.error("Error in force-update-email route:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
