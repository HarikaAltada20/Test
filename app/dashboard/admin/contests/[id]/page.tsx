import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import ContestDetailClient from "../../../contests/[id]/contest-detail-client";
import { verifyAdminAccess } from "@/utils/admin-auth";

export default async function AdminContestDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const resolvedParams = await params;
    const contestId = resolvedParams.id;

    // Verify admin access
    const { isAdmin, error } = await verifyAdminAccess();

    if (!isAdmin) {
        console.log('Non-admin user attempted to access admin contest detail:', error);
        redirect("/dashboard");
    }

    const supabase = await createClient();

    try {
        // Admin users can access any contest (no advertiser_id filter)
        const { data: contestData } = await supabase
            .from("contests_with_status")
            .select("*")
            .eq("id", contestId)
            .single();

        console.log("Admin accessing contestData:", contestData);
        console.log("Contest status:", contestData.status);
        console.log("Contest moderation_status:", contestData.moderation_status);
        console.log("Contest post_contest_status:", contestData.post_contest_status);

        if (!contestData) {
            redirect("/dashboard/admin/contests");
        }

        // Remove all legacy parsing and filtering for inspiration_links
        const finalInspirationLinks = Array.isArray(contestData.inspiration_links)
            ? contestData.inspiration_links
            : [];

        // Fetch submissions for this contest
        const { data: submissionsData, error: submissionsError } = await supabase
            .from("submissions")
            .select(`
        id,
        created_at,
        content_link,
        status,
        views, 
        earnings,
        other_stats,
        platform,
        video_thumbnail_url,
        video_title,
        creator_id,
        paid,
        paid_at,
        bonus_paid,
        bonus_paid_at
      `)
            .eq("contest_id", contestId)
            .order("created_at", { ascending: false });

        if (submissionsError) {
            console.error(`Admin: Supabase error fetching submissions for contest ${contestId}:`, submissionsError);
        }

        // Fetch creator profiles and users for the submissions
        let creatorProfilesData: any[] = [];
        let usersData: any[] = [];
        if (submissionsData && submissionsData.length > 0) {
            const creatorIds = [...new Set(submissionsData.map(sub => sub.creator_id).filter(Boolean))];

            if (creatorIds.length > 0) {
                const { data: profilesData, error: profilesError } = await supabase
                    .from("creator_profiles")
                    .select(`
            id,
            youtube_account,
            instagram_account
          `)
                    .in("id", creatorIds);

                if (profilesError) {
                    console.error(`Admin: Supabase error fetching creator profiles:`, profilesError);
                } else {
                    creatorProfilesData = profilesData || [];
                }

                // Fetch users for additional fallbacks
                const { data: fetchedUsers, error: usersError } = await supabase
                    .from("users")
                    .select(`
            id,
            full_name,
            username,
            profile_picture_url
          `)
                    .in("id", creatorIds);

                if (usersError) {
                    console.error(`Admin: Supabase error fetching users:`, usersError);
                } else {
                    usersData = fetchedUsers || [];
                }
            }
        }

        const calculateDurationDays = (
            start: string | null,
            end: string | null
        ): number | null => {
            if (!start || !end) return null;
            try {
                const startDate = new Date(start);
                const endDate = new Date(end);
                const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays;
            } catch (error) {
                console.error("Error calculating duration:", error);
                return null;
            }
        };

        const durationDays = calculateDurationDays(
            contestData.start_date,
            contestData.end_date
        );

        // Prepare contest data for the client component
        const contest = {
            id: contestData.id,
            title: contestData.title,
            status: contestData.status,
            moderation_status: contestData.moderation_status,
            post_contest_status: contestData.post_contest_status,
            thumbnail_url: contestData.thumbnail_url,
            brief_html: contestData.brief_html,
            platform: contestData.platform,
            start_date: contestData.start_date,
            end_date: contestData.end_date,
            rules_html: contestData.rules_html,
            inspiration_links: finalInspirationLinks,
            resources: contestData.resources,
            contest_type: contestData.contest_type,
            contest_based_details: contestData.contest_based_details,
            last_metrics_updated: contestData.last_metrics_updated,
            // Add other moderation fields for completeness
            submitted_for_approval_at: contestData.submitted_for_approval_at,
            approved_at: contestData.approved_at,
            approved_by: contestData.approved_by,
            published_at: contestData.published_at,
            rejection_reason: contestData.rejection_reason,
            // New features (2025-10-01)
            multiple_submissions_enabled: contestData.multiple_submissions_enabled,
            max_submissions_per_creator: contestData.max_submissions_per_creator,
            content_type: contestData.content_type,
            bonus_details: contestData.bonus_details,
            max_earnings_per_creator: contestData.max_earnings_per_creator,
            // Categories, subcategories, interests, and region
            categories: contestData.categories,
            subcategories: contestData.subcategories,
            interests: contestData.interests,
            region: contestData.region,
        };

        // Prepare submissions data
        const submissions = submissionsData
            ? submissionsData.map((sub: any) => {
                let creatorDisplayName: string | null = null;
                let creatorUsername: string | null = null;
                let creatorAvatarUrl: string | null = null;
                const actualCreatorProfileId: string | null = sub.creator_id;

                // Find the creator profile and user for this submission
                const creatorProfile = creatorProfilesData.find(profile => profile.id === sub.creator_id);
                const user = usersData.find(u => u.id === sub.creator_id);

                if (creatorProfile) {
                    const platform = sub.platform?.toLowerCase();

                    try {
                        if (platform?.includes('youtube') && creatorProfile.youtube_account) {
                            const ytAccount = typeof creatorProfile.youtube_account === 'string' ? JSON.parse(creatorProfile.youtube_account) : creatorProfile.youtube_account;
                            creatorDisplayName = ytAccount?.channel_title;
                            creatorUsername = ytAccount?.channel_custom_url || ytAccount?.channel_id;
                            creatorAvatarUrl = ytAccount?.channel_thumbnail;
                        } else if (platform?.includes('instagram') && creatorProfile.instagram_account) {
                            const igAccount = typeof creatorProfile.instagram_account === 'string' ? JSON.parse(creatorProfile.instagram_account) : creatorProfile.instagram_account;
                            // Mirror the working contests page mapping exactly
                            creatorDisplayName = igAccount?.name_of_account || igAccount?.full_name || igAccount?.display_name;
                            creatorUsername = igAccount?.username;
                            creatorAvatarUrl = igAccount?.profile_picture_url;
                        }
                    } catch (e) {
                        console.error("Admin: Error parsing social account JSON:", e);
                        // Keep username/avatar as null if parsing fails
                    }

                    // Fallbacks from user record
                    if (!creatorDisplayName && user?.full_name) creatorDisplayName = user.full_name;
                    if (!creatorUsername && user?.username) creatorUsername = user.username;
                    if (!creatorAvatarUrl && user?.profile_picture_url) creatorAvatarUrl = user.profile_picture_url;

                    // Final defaults
                    if (!creatorDisplayName) creatorDisplayName = 'Unknown Creator';
                    if (!creatorUsername) creatorUsername = 'unknown';

                } else {
                    creatorDisplayName = user?.full_name || user?.username || 'Unknown Creator';
                    creatorUsername = user?.username || 'unknown';
                    creatorAvatarUrl = user?.profile_picture_url || null;
                }

                return {
                    id: sub.id,
                    created_at: sub.created_at,
                    content_link: sub.content_link,
                    status: sub.status,
                    views: sub.views,
                    earnings: sub.earnings,
                    other_stats: sub.other_stats,
                    platform: sub.platform,
                    video_thumbnail_url: sub.video_thumbnail_url,
                    video_title: sub.video_title,
                    creator_display_name: creatorDisplayName,
                    creator_username: creatorUsername,
                    creator_avatar_url: creatorAvatarUrl,
                    creator_id: actualCreatorProfileId,
                    paid: sub.paid,
                    paid_at: sub.paid_at,
                    bonus_paid: sub.bonus_paid,
                    bonus_paid_at: sub.bonus_paid_at,
                    // Add nested creator object for creator-wise grouping compatibility
                    creator: {
                        id: actualCreatorProfileId,
                        username: creatorUsername,
                        profile_picture_url: creatorAvatarUrl,
                        full_name: creatorDisplayName,
                    },
                };
            })
            : [];

        console.log(`Admin: Mapped submissions for contest ${contestId}:`, JSON.stringify(submissions, null, 2));

        return (
            <>
                <div className="mb-4">
                    <a
                        href={`/dashboard/admin/affiliate/${contestId}`}
                        className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                        Settle Affiliate Earnings
                    </a>
                </div>
                <ContestDetailClient
                    contest={contest}
                    initialSubmissions={submissions}
                    durationDays={durationDays}
                    contestId={contestId}
                    isAdminView={true}
                />
            </>
        );

    } catch (error) {
        console.error('Error in admin contest detail page:', error);
        redirect("/dashboard/admin/contests");
    }
}
