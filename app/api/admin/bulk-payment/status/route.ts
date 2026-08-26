import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { kickProcessBulkPaymentQueue } from "@/lib/bulk-payment-kick";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const { isAdmin } = await verifyAdminAccess();
    const supabase = await createClient();

    let actorId: string | null = null;
    if (!isAdmin) {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || !user) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }
      actorId = user.id;
    }

    const supabaseAdmin = createAdminClient();
    const { data: job, error: jobError } = await supabaseAdmin
      .from("bulk_payment_jobs")
      .select(
        "id, contest_id, user_id, user_type, payment_type, payout_channel, status, total_count, processed_count, success_count, failed_count, total_amount_cents, total_cpm_cents, total_bonus_cents, total_milestone_cents, error_message, created_at, started_at, finished_at, updated_at",
      )
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (!isAdmin && actorId !== job.user_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Keep the worker alive while the client polls (esp. local/dev where QStash
    // cannot reach localhost). Safe no-op when already processing / queue empty.
    if (job.status === "queued" || job.status === "running") {
      void kickProcessBulkPaymentQueue(request);
    }

    const total = Number(job.total_count) || 0;
    const processed = Number(job.processed_count) || 0;
    const progressPercent =
      total > 0 ? Math.max(0, Math.min(100, (processed / total) * 100)) : 0;

    return NextResponse.json(
      {
        ...job,
        progressPercent,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[bulk-payment status]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected status error",
      },
      { status: 500 },
    );
  }
}
