import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { MetricsService } from "@/lib/metrics-service";
import { POST_CONTEST_STATUS } from "@/lib/constants-status";

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = await createClient();
        const resolvedParams = await params;
        const contestId = resolvedParams.id;

        // Get request body
        const { status, reason } = await request.json();

        // Validate status
        const validStatuses = ['pending_review', 'in_review', 'verification_complete', 'payouts_processed'];
        if (!status || !validStatuses.includes(status)) {
            return NextResponse.json({ 
                error: "Invalid status. Must be one of: " + validStatuses.join(', ')
            }, { status: 400 });
        }

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user is admin or contest owner
        const { data: userData } = await supabase
            .from('users')
            .select('user_type')
            .eq('id', user.id)
            .single();

        const isAdmin = userData?.user_type === 'admin';

        // Get contest to verify ownership and current status
        let contestQuery = supabase
            .from("contests_with_status")
            .select("id, title, advertiser_id, moderation_status, status, post_contest_status")
            .eq("id", contestId);

        // If not admin, verify ownership
        if (!isAdmin) {
            contestQuery = contestQuery.eq("advertiser_id", user.id);
        }

        const { data: contest, error: contestError } = await contestQuery.single();

        if (contestError || !contest) {
            return NextResponse.json({ error: "Contest not found or access denied" }, { status: 404 });
        }

        // Verify contest is published and ended
        if (contest.moderation_status !== 'published') {
            return NextResponse.json({ 
                error: "Contest must be published to update post-contest status" 
            }, { status: 400 });
        }

        if (contest.status !== 'ended') {
            return NextResponse.json({ 
                error: "Contest must be ended to update post-contest status" 
            }, { status: 400 });
        }

        // Validate status transitions (basic business logic)
        const currentStatus = contest.post_contest_status;
        
        // Restrict payouts_processed to admins only
        if (status === 'payouts_processed' && !isAdmin) {
            return NextResponse.json({ 
                error: "Only admins can change status to payouts_processed" 
            }, { status: 403 });
        }
        
        // Admins can change to any status, brands have restrictions
        if (!isAdmin) {
            if (currentStatus === 'payouts_processed') {
                return NextResponse.json({ 
                    error: "Cannot change status after payouts have been processed" 
                }, { status: 400 });
            }
            
            if (currentStatus === 'verification_complete' && status !== 'payouts_processed') {
                return NextResponse.json({ 
                    error: "Contest verification is complete. Only payouts_processed status is allowed" 
                }, { status: 400 });
            }
        }

        // Update contest post_contest_status (and lock timestamp when entering locked states)
        const nowIso = new Date().toISOString();
        const contestUpdate: any = {
            post_contest_status: status,
            updated_at: nowIso,
        };
        if (status === POST_CONTEST_STATUS.verification_complete || status === POST_CONTEST_STATUS.payouts_processed) {
            // record when views were locked for this contest
            // column exists on contests per schema: views_locked_at
            (contestUpdate as any).views_locked_at = nowIso;
        }
        const { error: updateError } = await supabase
            .from("contests")
            .update(contestUpdate)
            .eq("id", contestId);

        if (updateError) {
            console.error("Error updating contest status:", updateError);
            return NextResponse.json({ 
                error: "Failed to update contest status" 
            }, { status: 500 });
        }

        // Kick off views credit asynchronously to avoid serverless timeouts
        if (status === POST_CONTEST_STATUS.verification_complete || status === POST_CONTEST_STATUS.payouts_processed) {
            try {
                // Fire-and-forget without blocking the response
                // Safe: this only updates creator aggregate views and snapshots
                MetricsService.creditViewsForContest(contestId, 20000)
                    .then(() => console.log(`[update-status] Views credit finished for contest ${contestId}`))
                    .catch((e) => console.warn('[update-status] Views credit failed (non-blocking):', e));
            } catch (e) {
                console.warn('[update-status] Failed to start views credit task:', e);
            }
        }

        // Note: Audit logging could be added here in the future if needed

        return NextResponse.json({ 
            success: true, 
            message: `Contest status updated to ${status}`,
            previous_status: currentStatus,
            new_status: status
        });

    } catch (error) {
        console.error("Error in update contest status API:", error);
        return NextResponse.json({ 
            error: "Internal server error" 
        }, { status: 500 });
    }
} 