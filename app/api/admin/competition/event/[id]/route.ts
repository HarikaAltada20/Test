import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createClient } from "@/utils/supabase/server";
import { clearDailyChallengeCache } from "@/lib/cache-utils";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["draft", "active", "ended"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body?.name === "string" && body.name.trim().length > 0) {
      updates.name = body.name.trim().slice(0, 120);
    }

    if (typeof body?.timezone === "string" && body.timezone.trim().length > 0) {
      updates.timezone = body.timezone.trim().slice(0, 64);
    }

    if (typeof body?.status === "string" && VALID_STATUS.has(body.status)) {
      updates.status = body.status;
    }

    if (typeof body?.is_active === "boolean") {
      updates.is_active = body.is_active;
    }

    if (typeof body?.starts_at === "string" && body.starts_at.trim()) {
      const d = new Date(body.starts_at);
      if (!Number.isNaN(d.getTime())) updates.starts_at = d.toISOString();
    }

    if (typeof body?.ends_at === "string" && body.ends_at.trim()) {
      const d = new Date(body.ends_at);
      if (!Number.isNaN(d.getTime())) updates.ends_at = d.toISOString();
    }

    if (body?.makeSoleActive === true) {
      updates.is_active = true;
    }

    const supabase = await createClient();

    if (body?.makeSoleActive === true) {
      const { error: deactErr } = await supabase
        .from("competition_event")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("is_active", true);
      if (deactErr) throw deactErr;
    }

    const { data: current, error: readErr } = await supabase
      .from("competition_event")
      .select("starts_at,ends_at")
      .eq("id", id)
      .single();
    if (readErr) throw readErr;

    const nextStart = (updates.starts_at as string) ?? current.starts_at;
    const nextEnd = (updates.ends_at as string) ?? current.ends_at;
    if (new Date(nextEnd).getTime() <= new Date(nextStart).getTime()) {
      return NextResponse.json(
        { error: "ends_at must be after starts_at" },
        { status: 400 },
      );
    }

    const { data: event, error: updateErr } = await supabase
      .from("competition_event")
      .update(updates)
      .eq("id", id)
      .select("id,name,starts_at,ends_at,timezone,status,is_active")
      .single();

    if (updateErr) throw updateErr;

    const cleared = clearDailyChallengeCache();
    return NextResponse.json({
      success: true,
      event,
      cacheEntriesCleared: cleared,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[admin/competition/event/:id] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
