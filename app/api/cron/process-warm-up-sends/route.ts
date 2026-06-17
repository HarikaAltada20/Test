/**
 * Cron: daily warm-up sends (09:00 IST / 03:30 UTC)
 * Also handles midnight counter reset and end-of-day metrics.
 *
 * Schedule this via Vercel Cron / QStash / external scheduler.
 * Authorization: Bearer ${CRON_SECRET}
 */

import { NextResponse } from "next/server";
import {
  runDailyWarmUpSends,
  resetDailyCounters,
  calculateDailyMetrics,
} from "@/lib/admin-email/warm-up-service";

function authorize(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return true; // allow in dev when secret not set

  const auth = request.headers.get("authorization") ?? "";
  if (auth === `Bearer ${cronSecret}`) return true;

  // Vercel Cron sends x-vercel-cron-signature or omits auth
  const vercelCron = request.headers.get("x-vercel-cron");
  if (vercelCron) return true;

  return false;
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleRequest("sends");
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let action = "sends";
  try {
    const body = await request.json() as { action?: string };
    if (body.action) action = body.action;
  } catch {
    // default to sends
  }

  return handleRequest(action);
}

async function handleRequest(action: string): Promise<NextResponse> {
  try {
    if (action === "reset") {
      await resetDailyCounters();
      return NextResponse.json({ action: "reset", success: true });
    }

    if (action === "metrics") {
      const result = await calculateDailyMetrics();
      return NextResponse.json({ action: "metrics", ...result });
    }

    // Default: daily sends
    const result = await runDailyWarmUpSends();
    return NextResponse.json({ action: "sends", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cron failed";
    console.error("[warm-up cron]", action, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
