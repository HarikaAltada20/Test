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
    const { newEmail, logOnly, oldEmail } = body as {
      newEmail?: string;
      logOnly?: boolean;
      oldEmail?: string;
    };

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

    // Admin client is used both for force-updating and for logging-only mode
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

    // Capture current email before change (if we're about to change it)
    const currentEmail = authUser.user?.email || null;

    let updatedEmail: string | null = null;
    let finalEmailForResponse: string | null = null;

    if (logOnly) {
      // Log-only mode: email has already been changed through the normal OTP flow.
      // We just want to insert an audit log entry using the provided oldEmail/newEmail.
      updatedEmail = trimmedEmail.toLowerCase();
      finalEmailForResponse = trimmedEmail;
    } else {
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
      updatedEmail = data.user.email?.toLowerCase() || null;
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

      finalEmailForResponse = data.user.email || trimmedEmail;

      console.log(`Email successfully force-updated to ${updatedEmail}`);
    }

    // Insert email change log; if this fails, treat it as an error so we know the audit data is consistent
    const normalizedUpdatedEmail = updatedEmail || trimmedEmail.toLowerCase();

    // For normal updates, use the previous email from auth.
    // For log-only mode, prefer the oldEmail passed in from the client (captured before OTP flow).
    const previousEmail = (logOnly && oldEmail) || currentEmail || null;

    if (
      previousEmail &&
      normalizedUpdatedEmail &&
      previousEmail.toLowerCase() !== normalizedUpdatedEmail.toLowerCase()
    ) {
      const { error: logError } = await supabaseAdmin
        .from("email_change_logs")
        .insert({
          user_id: userId,
          old_email: previousEmail,
          new_email: normalizedUpdatedEmail,
        });

      if (logError) {
        console.error("Error inserting email change log:", logError);
        return NextResponse.json(
          {
            error:
              logError.message ||
              "Email updated but failed to write audit log in email_change_logs",
          },
          { status: 500 }
        );
      }
    }

    // Update the users table to keep it in sync (only when we're the ones changing the email).
    // If this fails, return an error so callers know the public.users row is out of sync.
    if (!logOnly && finalEmailForResponse) {
      const { error: usersTableError } = await supabaseAdmin
        .from("users")
        .update({ email: finalEmailForResponse })
        .eq("id", userId);

      if (usersTableError) {
        console.error("Error updating users table:", usersTableError);
        return NextResponse.json(
          {
            error:
              usersTableError.message ||
              "Auth email updated but failed to update users table",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: logOnly
        ? "Email change logged successfully"
        : "Email updated successfully",
      email: finalEmailForResponse || trimmedEmail,
    });
  } catch (error: any) {
    console.error("Error in force-update-email route:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
