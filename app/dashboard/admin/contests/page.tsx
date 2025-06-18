import React, { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ContestListClient } from "../../contests/ContestListClient";
import { verifyAdminAccess } from "@/utils/admin-auth";

// Define the type for a contest in the admin view
export type AdminContest = {
    id: string;
    title: string | null;
    platform: string | null;
    contest_type: string | null;
    created_at: string;
    moderation_status: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    live_submission_count: number | null;
    total_prize_money_sortable: number | null;
    contest_based_details: {
        leaderboard_contest?: {
            total_prize?: number;
        };
        cpm_contest?: {
            total_budget?: number;
        };
    } | null;
    thumbnail_url: string | null;
    advertiser_name: string; // Added for admin view
};

export const revalidate = 0;

export default async function AdminContestsPage() {
    // Verify admin access
    const { isAdmin, error } = await verifyAdminAccess();

    if (!isAdmin) {
        console.log('Non-admin user attempted to access admin contests:', error);
        redirect("/dashboard");
    }

    const supabase = await createClient();

    try {
        // Admin users see all contests from all brands
        const { data: contestsData = [] } = await supabase
            .from("contests_with_status")
            .select(`
        *,
        contest_based_details,
        advertiser_profiles!advertiser_id(company_name)
      `)
            .order("created_at", { ascending: false });

        // Add advertiser name to contests for admin view
        const typedContests = (contestsData || []).map(contest => ({
            ...contest,
            status: contest.status || 'unknown',
            advertiser_name: (contest.advertiser_profiles as any)?.company_name || 'Unknown Brand'
        })) as any[];

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">All Contests (Admin)</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Admin view - showing all contests from all brands on the platform
                        </p>
                    </div>
                </div>
                <Suspense fallback={<div>Loading contests...</div>}>
                    <ContestListClient
                        initialContests={typedContests}
                        isAdminView={true}
                    />
                </Suspense>
            </div>
        );

    } catch (error) {
        console.error('Error fetching admin contests:', error);
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Error loading contests</p>
            </div>
        );
    }
} 