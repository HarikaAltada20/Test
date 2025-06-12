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

        if (!contestData) {
            redirect("/dashboard/admin/contests");
        }

        let finalInspirationLinks: string[] | null = null;
        const rawInspirationLinks = contestData.inspiration_links;

        if (Array.isArray(rawInspirationLinks)) {
            finalInspirationLinks = rawInspirationLinks.filter(link => typeof link === 'string');
        } else if (typeof rawInspirationLinks === 'string') {
            try {
                const parsed = JSON.parse(rawInspirationLinks);
                if (Array.isArray(parsed)) {
                    finalInspirationLinks = parsed.filter(link => typeof link === 'string');
                } else {
                    finalInspirationLinks = null;
                }
            } catch (error) {
                finalInspirationLinks = null;
            }
        } else if (rawInspirationLinks === null) {
            finalInspirationLinks = null;
        } else {
            if (rawInspirationLinks !== undefined) {
                // console.warn('Inspiration links is of unexpected type:', typeof rawInspirationLinks, rawInspirationLinks);
            }
            finalInspirationLinks = null;
        }

        // Fetch submissions for this contest
        const { data: submissionsData, error: submissionsError } = await supabase
            .from("submissions")
            .select(`
        id,
        created_at,
        content_link,
        status,
        views, 
        other_stats,
        platform,
        video_thumbnail_url,
        creator_id
      `)
            .eq("contest_id", contestId)
            .order("created_at", { ascending: false });

        if (submissionsError) {
            console.error(`Admin: Supabase error fetching submissions for contest ${contestId}:`, submissionsError);
        }

        // Fetch creator profiles for the submissions
        let creatorProfilesData: any[] = [];
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
        };

        // Prepare submissions data
        const submissions = submissionsData
            ? submissionsData.map((sub: any) => {
                let creatorUsername: string | null = null;
                let creatorAvatarUrl: string | null = null;
                const actualCreatorProfileId: string | null = sub.creator_id;

                // Find the creator profile for this submission
                const creatorProfile = creatorProfilesData.find(profile => profile.id === sub.creator_id);

                if (creatorProfile) {
                    const platform = sub.platform?.toLowerCase();

                    try {
                        if (platform?.includes('youtube') && creatorProfile.youtube_account) {
                            const ytAccount = typeof creatorProfile.youtube_account === 'string' ? JSON.parse(creatorProfile.youtube_account) : creatorProfile.youtube_account;
                            creatorUsername = ytAccount?.channel_title;
                            creatorAvatarUrl = ytAccount?.channel_thumbnail;
                        } else if (platform?.includes('instagram') && creatorProfile.instagram_account) {
                            const igAccount = typeof creatorProfile.instagram_account === 'string' ? JSON.parse(creatorProfile.instagram_account) : creatorProfile.instagram_account;
                            creatorUsername = igAccount?.username;
                            creatorAvatarUrl = igAccount?.profile_picture_url;
                        }
                    } catch (e) {
                        console.error("Admin: Error parsing social account JSON:", e);
                        // Keep username/avatar as null if parsing fails
                    }

                    // Fallback if platform-specific data extraction failed or platform is different
                    if (!creatorUsername && creatorProfile.username) creatorUsername = creatorProfile.username;
                    if (!creatorAvatarUrl && creatorProfile.avatar_url) creatorAvatarUrl = creatorProfile.avatar_url;
                    if (!creatorUsername) creatorUsername = 'N/A';

                } else {
                    creatorUsername = 'Unknown Creator';
                }

                return {
                    id: sub.id,
                    created_at: sub.created_at,
                    content_link: sub.content_link,
                    status: sub.status,
                    views: sub.views,
                    other_stats: sub.other_stats,
                    platform: sub.platform,
                    video_thumbnail_url: sub.video_thumbnail_url,
                    creator_username: creatorUsername,
                    creator_avatar_url: creatorAvatarUrl,
                    creator_id: actualCreatorProfileId
                };
            })
            : [];

        console.log(`Admin: Mapped submissions for contest ${contestId}:`, JSON.stringify(submissions, null, 2));

        return (
            <ContestDetailClient
                contest={contest}
                initialSubmissions={submissions}
                durationDays={durationDays}
                contestId={contestId}
                isAdminView={true}
            />
        );

    } catch (error) {
        console.error('Error in admin contest detail page:', error);
        redirect("/dashboard/admin/contests");
    }
}
