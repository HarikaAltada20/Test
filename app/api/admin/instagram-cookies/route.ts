import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  checkInstagramCookieStatus,
  upsertInstagramCookies,
} from "@/lib/instagram-cookies";

/**
 * GET /api/admin/instagram-cookies
 * Check live Instagram download cookie status (DB → env → file).
 *
 * PUT /api/admin/instagram-cookies
 * Upload fresh Netscape cookies without redeploying.
 * Body: { cookies: "<netscape cookies.txt content>", note?: string }
 *
 * Critical: use a dedicated Instagram account. After exporting cookies,
 * do NOT keep that account open/logged-in in a browser — Instagram rotates
 * sessionid and production downloads will fail after the first use.
 */
export async function GET() {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const status = await checkInstagramCookieStatus();
  return NextResponse.json({
    cookies: status,
    tips: [
      "Use a dedicated Instagram account only for downloads",
      "After exporting cookies, log out of that account in the browser (or do not use it)",
      "Upload fresh cookies here — no redeploy needed",
      "Run migration 20260803_instagram_download_cookies.sql if DB persistence is missing",
    ],
  });
}

export async function PUT(request: Request) {
  const { isAdmin, user } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: { cookies?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.cookies || typeof body.cookies !== "string") {
    return NextResponse.json(
      { error: "Body must include cookies (Netscape cookies.txt content)" },
      { status: 400 }
    );
  }

  try {
    await upsertInstagramCookies(
      body.cookies,
      body.note || "uploaded via admin API",
      user?.id || null
    );
    const status = await checkInstagramCookieStatus();
    return NextResponse.json({
      success: true,
      message:
        "Cookies saved. They are live immediately (no redeploy). Do not reuse this Instagram session in a browser.",
      cookies: status,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to save cookies" },
      { status: 400 }
    );
  }
}
