import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdminApi } from "@/lib/admin-email/api-auth";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_templates")
    .select("id, name, subject, body, cta_text, cta_url, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  let body: {
    name?: string;
    subject?: string;
    body?: string;
    ctaText?: string;
    ctaUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  const subject = body.subject?.trim();
  const templateBody = body.body?.trim();
  if (!name || !subject || !templateBody) {
    return NextResponse.json(
      { error: "Name, subject, and body are required" },
      { status: 400 },
    );
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_templates")
    .insert({
      name,
      subject,
      body: templateBody,
      cta_text: body.ctaText?.trim() || null,
      cta_url: body.ctaUrl?.trim() || null,
      created_by: auth.user!.id,
    })
    .select("id, name, subject, body")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: data });
}
