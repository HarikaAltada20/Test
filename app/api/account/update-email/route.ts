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

    // Check if user has changed email in the last month
    const supabaseAdmin = createAdminClient();
    const { data: authUser, error: authUserError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (authUserError) {
      console.error("Error fetching user:", authUserError);
      return NextResponse.json(
        { error: "Failed to verify email change eligibility" },
        { status: 500 }
      );
    }

    // Check last email change date from user metadata
    const lastEmailChangeAt =
      authUser.user?.user_metadata?.last_email_change_at;
    if (lastEmailChangeAt) {
      const lastChangeDate = new Date(lastEmailChangeAt);
      const now = new Date();

      // Check if the last change was in the same calendar month and year
      const lastMonth = lastChangeDate.getMonth();
      const lastYear = lastChangeDate.getFullYear();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      // If same month and year, user cannot change email yet
      if (lastMonth === currentMonth && lastYear === currentYear) {
        // Calculate days until next month
        const nextMonth = new Date(currentYear, currentMonth + 1, 1);
        const daysUntilNextMonth = Math.ceil(
          (nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        return NextResponse.json(
          {
            error: `You can only change your email once per month. Please wait until next month (${nextMonth.toLocaleDateString(
              "en-US",
              { month: "long", year: "numeric" }
            )}) to change your email again.`,
            daysRemaining: daysUntilNextMonth,
          },
          { status: 429 }
        );
      }
    }

    // Use admin client to force-update the email (bypasses double confirmation)
    console.log(`Force-updating email for user ${userId} to ${trimmedEmail}`);

    // Update email and set last_email_change_at in metadata
    const { data, error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: trimmedEmail,
        user_metadata: {
          ...authUser.user?.user_metadata,
          last_email_change_at: new Date().toISOString(),
        },
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
