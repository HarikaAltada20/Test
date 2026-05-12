import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { MetricsService } from "@/lib/metrics-service";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const resolvedParams = await params;
        const contestId = resolvedParams.id;

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user is admin
        const { data: userData } = await supabase
            .from('users')
            .select('user_type')
            .eq('id', user.id)
            .single();

        const isAdmin = userData?.user_type === 'admin';

        // Get contest to verify ownership and status
        let contestQuery = supabase
            .from("contests")
            .select("*")
            .eq("id", contestId);

        // Only check ownership if not admin
        if (!isAdmin) {
            contestQuery = contestQuery.eq("advertiser_id", user.id);
        }

        const { data: contest, error: contestError } = await contestQuery.single();

        if (contestError || !contest) {
            return NextResponse.json({ error: "Contest not found" }, { status: 404 });
        }

        // Verify contest is approved
        if (contest.moderation_status !== 'approved') {
            return NextResponse.json({ 
                error: "Contest must be approved before publishing" 
            }, { status: 400 });
        }

        // Verify dates are set and valid
        if (!contest.start_date || !contest.end_date) {
            return NextResponse.json({ 
                error: "Contest must have start and end dates before publishing" 
            }, { status: 400 });
        }

        // Verify start date is in the future
        if (new Date(contest.start_date) <= new Date()) {
            return NextResponse.json({ 
                error: "Cannot publish contest with past start date" 
            }, { status: 400 });
        }

        // Update contest status to published
        const { error: updateError } = await supabase
            .from("contests")
            .update({
                moderation_status: 'published',
                published_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq("id", contestId);

        if (updateError) {
            console.error("Error publishing contest:", updateError);
            return NextResponse.json({ 
                error: "Failed to publish contest" 
            }, { status: 500 });
        }

        // Application-level advertiser accounting on publish
        try {
            const budgetCents = (contest as any)?.payment_details?.total_amount_paid || 0;
            if (contest.advertiser_id) {
                await MetricsService.applyContestPublished(contest.advertiser_id, budgetCents);
            }
        } catch (accErr: any) {
            console.error('Error applying advertiser publish accounting:', accErr);
            return NextResponse.json({ error: `Published, but accounting failed: ${accErr?.message || 'unknown error'}` }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            message: "Contest published successfully" 
        });

    } catch (error) {
        console.error("Error in publish contest API:", error);
        return NextResponse.json({ 
            error: "Internal server error" 
        }, { status: 500 });
    }
} 