import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { isAdmin, error } = await verifyAdminAccess();
    if (!isAdmin)
      return NextResponse.json(
        { error: error || "Admin required" },
        { status: 403 }
      );

    const supabase = createAdminClient();

    // Supabase defaults to 1000 rows max per request; fetch in chunks to get all users
    const CHUNK = 1000;
    const usersSelect = `
      *,
      advertiser_profiles (
        id,
        company_name,
        website_url,
        total_money_spent,
        total_contests_run,
        available_deposit_balance,
        withdrawable_balance,
        subscription_info
      )
    `;
    let users: any[] = [];
    let usersFrom = 0;
    while (true) {
      const { data: chunk, error: usersError } = await supabase
        .from("users")
        .select(usersSelect)
        .order("created_at", { ascending: false })
        .range(usersFrom, usersFrom + CHUNK - 1);

      if (usersError) {
        console.error("Error fetching users:", usersError);
        return NextResponse.json(
          { error: usersError.message },
          { status: 500 }
        );
      }
      users = users.concat(chunk || []);
      if (!chunk || chunk.length < CHUNK) break;
      usersFrom += CHUNK;
    }

    // Fetch all creator_profiles in chunks (same 1000-row limit)
    const creatorProfilesSelect = `
      id,
      youtube_account,
      instagram_account,
      twitter_account,
      total_contests_participated,
      total_contests_won,
      total_views,
      total_money_won,
      withdrawable_balance,
      total_submissions_made,
      total_submissions_won,
      date_of_birth,
      gender,
      country,
      state,
      city,
      address,
      languages,
      categories,
      subcategories,
      interests
    `;
    let creatorProfiles: any[] = [];
    let profilesFrom = 0;
    while (true) {
      const { data: profileChunk, error: creatorProfilesError } =
        await supabase
          .from("creator_profiles")
          .select(creatorProfilesSelect)
          .range(profilesFrom, profilesFrom + CHUNK - 1);

      if (creatorProfilesError) {
        console.error("Error fetching creator profiles:", creatorProfilesError);
        break; // Continue without creator profile data
      }
      creatorProfiles = creatorProfiles.concat(profileChunk || []);
      if (!profileChunk || profileChunk.length < CHUNK) break;
      profilesFrom += CHUNK;
    }

    // Create a map of creator profiles by user id
    const creatorProfilesMap = new Map(
      (creatorProfiles || []).map((profile) => [profile.id, profile])
    );

    // Merge creator_profiles into users
    const usersWithProfiles = (users || []).map((user: any) => {
      const creatorProfile = creatorProfilesMap.get(user.id);
      return {
        ...user,
        creator_profiles: creatorProfile || null,
      };
    });

    return NextResponse.json({ items: usersWithProfiles });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Internal error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { isAdmin, error } = await verifyAdminAccess();
    if (!isAdmin)
      return NextResponse.json(
        { error: error || "Admin required" },
        { status: 403 }
      );

    const body = await req.json();
    const { userId, userType } = body as {
      userId: string;
      userType: string;
    };

    if (!userId || !userType) {
      return NextResponse.json(
        { error: "userId and userType are required" },
        { status: 400 }
      );
    }

    // Validate userType
    const validUserTypes = ["creator", "advertiser", "admin"];
    if (!validUserTypes.includes(userType)) {
      return NextResponse.json(
        {
          error: "Invalid userType. Must be one of: creator, advertiser, admin",
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Update user_type in users table
    const { error: updateError } = await supabase
      .from("users")
      .update({ user_type: userType })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating user type:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Internal error" },
      { status: 500 }
    );
  }
}
