/**
 * Cron: daily warm-up sends, counter reset, metrics, health checks.
 *
 * Scheduling: QStash (recommended) — POST /api/admin/warm-up/admin/setup-schedules
 * Authorization: QStash Upstash-Signature or Bearer ${CRON_SECRET}
 */

import { NextResponse } from "next/server";
import {
  runDailyWarmUpSends,
  resetDailyCounters,
  calculateDailyMetrics,
  checkWarmUpHealth,
} from "@/lib/admin-email/warm-up-service";
import { authorizeProcessWarmUpSends } from "@/lib/qstash";

function parseAction(request: Request, rawBody: string): string {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("action");
  if (fromQuery) return fromQuery;

  if (rawBody.trim()) {
    try {
      const body = JSON.parse(rawBody) as { action?: string };
      if (body.action) return body.action;
    } catch {
      // ignore
    }
  }

  return "sends";
}

export async function GET(request: Request) {
  const rawBody = await request.text();
  if (!(await authorizeProcessWarmUpSends(request, rawBody))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleRequest(parseAction(request, rawBody));
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!(await authorizeProcessWarmUpSends(request, rawBody))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleRequest(parseAction(request, rawBody));
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

    if (action === "health") {
      const result = await checkWarmUpHealth();
      return NextResponse.json({ action: "health", ...result });
    }

    const result = await runDailyWarmUpSends();
    return NextResponse.json({ action: "sends", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cron failed";
    console.error("[warm-up cron]", action, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
