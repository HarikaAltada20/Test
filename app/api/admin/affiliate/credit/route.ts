import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { creditUserWithdrawableBalance } from "@/lib/payment-utils";

type CreditPayload = {
  items: Array<{
    submission_id: string;
    contest_id: string;
    winner_user_id: string;
    referrer_user_id: string;
    winning_amount_cents: number;
    rate_percent?: number; // optional override per row
  }>;
  default_rate_percent?: number; // optional uniform override
  credit_type?: "wallet" | "external"; // wallet (default) credits withdrawable & logs txn; external only bumps affiliate_earnings
};

export async function POST(req: NextRequest) {
  try {
    const { isAdmin, error } = await verifyAdminAccess();
    if (!isAdmin)
      return NextResponse.json(
        { error: error || "Admin required" },
        { status: 403 }
      );

    const body = (await req.json()) as CreditPayload;
    if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const creditType = body.credit_type === "external" ? "external" : "wallet";

    // Preload submissions to skip already paid
    const submissionIds = body.items.map((i) => i.submission_id);
    const { data: existingSubs } = await supabase
      .from("submissions")
      .select("id, affiliate_paid")
      .in("id", submissionIds);
    const paidSet = new Set<string>(
      (existingSubs || [])
        .filter((s) => (s as any).affiliate_paid === true)
        .map((s) => String((s as any).id))
    );

    // Pre-skip by transactions too (legacy safety)
    const { data: existingTx } = await supabase
      .from("money_transactions")
      .select("metadata")
      .eq("type", "reward")
      .in(
        "user_id",
        body.items.map((i) => i.referrer_user_id)
      )
      .contains("metadata", {
        affiliate_commission: true,
        contest_id: body.items[0]?.contest_id || null,
      });
    const creditedSet = new Set<string>();
    for (const t of existingTx || []) {
      const sid = (t as any)?.metadata?.submission_id;
      if (sid) creditedSet.add(String(sid));
    }

    // Build list after skipping already credited
    const filtered = body.items
      .map((row) => {
        const rate =
          typeof row.rate_percent === "number"
            ? row.rate_percent
            : typeof body.default_rate_percent === "number"
            ? body.default_rate_percent
            : 10;
        const commissionCents = Math.round(
          (row.winning_amount_cents * rate) / 100
        );
        return { ...row, rate, commission_cents: commissionCents };
      })
      .filter(
        (r) =>
          r.commission_cents > 0 &&
          !paidSet.has(String(r.submission_id)) &&
          !creditedSet.has(String(r.submission_id))
      );

    // Group by referrer
    const byReferrer: Record<
      string,
      { total: number; items: any[]; contest_id: string }
    > = {};
    for (const r of filtered) {
      if (!byReferrer[r.referrer_user_id])
        byReferrer[r.referrer_user_id] = {
          total: 0,
          items: [],
          contest_id: r.contest_id,
        };
      byReferrer[r.referrer_user_id].total += r.commission_cents;
      byReferrer[r.referrer_user_id].items.push(r);
    }

    const results: any[] = [];
    for (const [referrerId, group] of Object.entries(byReferrer)) {
      if (group.total <= 0) continue;

      if (creditType === "wallet") {
        const description = `Affiliate commission for contest ${group.contest_id} (bulk ${group.items.length} entries)`;
        const res = await creditUserWithdrawableBalance(
          referrerId,
          group.total,
          description,
          {
            remarks: "Affiliate income credited (bulk)",
            metadata: {
              affiliate_commission: true,
              contest_id: group.contest_id,
              submission_ids: group.items.map((i) => i.submission_id),
              breakdown: group.items.map((i) => ({
                submission_id: i.submission_id,
                winner_user_id: i.winner_user_id,
                amount_cents: i.commission_cents,
                rate_percent: i.rate,
              })),
            },
          }
        );
        if (!res.success) {
          for (const it of group.items)
            results.push({
              submission_id: it.submission_id,
              status: "failed",
              error: res.error,
            });
          continue;
        }
      } else {
        // External: only bump users.affiliate_earnings (no wallet credit)
        const { error: incErr } = await supabase.rpc(
          "increment_other_earnings",
          { p_user_id: referrerId, p_amount: group.total }
        );
        if (incErr) {
          for (const it of group.items)
            results.push({
              submission_id: it.submission_id,
              status: "failed",
              error: incErr.message,
            });
          continue;
        }
      }

      // Update all submissions in group
      for (const it of group.items) {
        const { error: updErr } = await supabase
          .from("submissions")
          .update({
            affiliate_paid: true,
            affiliate_metadata: {
              amount_cents: it.commission_cents,
              rate_percent: it.rate,
              credited_at: new Date().toISOString(),
              method: creditType,
            },
          })
          .eq("id", it.submission_id);
        if (updErr) {
          results.push({
            submission_id: it.submission_id,
            status: "credited_but_flag_update_failed",
            amount_cents: it.commission_cents,
            error: updErr.message,
          });
        } else {
          results.push({
            submission_id: it.submission_id,
            status: "credited",
            amount_cents: it.commission_cents,
          });
        }
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Internal error" },
      { status: 500 }
    );
  }
}
