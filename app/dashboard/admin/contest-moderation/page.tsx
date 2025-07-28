import React, { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { verifyAdminAccess } from "@/utils/admin-auth";
import ContestModerationClient from "./ContestModerationClient";

export default async function ContestModerationPage() {
    // Verify admin access
    const { isAdmin, error } = await verifyAdminAccess();

    if (!isAdmin) {
        console.log('Non-admin user attempted to access contest moderation:', error);
        redirect("/dashboard");
    }

    const supabase = await createClient();

    try {
        // Fetch contests pending approval and recent moderated contests
        const { data: contestsData = [] } = await supabase
            .from("contests_with_status")
            .select(`
        *,
        advertiser_profiles!advertiser_id(company_name, id),
        users!approved_by(full_name)
      `)
            .in('moderation_status', ['pending_approval', 'approved', 'rejected'])
            .order("submitted_for_approval_at", { ascending: false });

        // Format the data for the frontend
        const formattedContests = (contestsData || []).map(contest => ({
            id: contest.id,
            title: contest.title,
            platform: contest.platform,
            contest_type: contest.contest_type,
            moderation_status: contest.moderation_status,
            status: contest.status,
            created_at: contest.created_at,
            submitted_for_approval_at: contest.submitted_for_approval_at,
            approved_at: contest.approved_at,
            approved_by_name: contest.users?.full_name || null,
            published_at: contest.published_at,
            rejection_reason: contest.rejection_reason,
            thumbnail_url: contest.thumbnail_url,
            brief_html: contest.brief_html,
            start_date: contest.start_date,
            end_date: contest.end_date,
            advertiser_name: contest.advertiser_profiles?.company_name || 'Unknown Brand',
            advertiser_id: contest.advertiser_id,
            contest_based_details: contest.contest_based_details,
            brief: contest.brief,
            rules_html: contest.rules_html,
            resources: contest.resources,
            inspiration_links: contest.inspiration_links
        }));

        return (
            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Contest Moderation</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Review and approve contests submitted by brands
                        </p>
                    </div>
                </div>

                <Suspense fallback={<div>Loading contests...</div>}>
                    <ContestModerationClient />
                </Suspense>
            </div>
        );

    } catch (error) {
        console.error('Error in contest moderation page:', error);
        return <div>Error loading contest moderation page</div>;
    }
} 