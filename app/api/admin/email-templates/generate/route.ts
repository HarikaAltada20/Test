import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { generateEmailTemplateWithGemini } from "@/lib/admin-email/gemini-email-template";
import { BULK_EMAIL_MERGE_TAG_DEFAULTS } from "@/lib/admin-notifications/template";

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  let body: {
    templateType?: string;
    tone?: string;
    targetAudience?: string;
    industryFocus?: string;
    selectedVariables?: string[];
    calendlyUrl?: string | null;
    templateName?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await generateEmailTemplateWithGemini({
      templateType: body.templateType?.trim() || "cold_outreach",
      tone: body.tone?.trim() || "professional",
      targetAudience: body.targetAudience?.trim() || "",
      industryFocus: body.industryFocus?.trim() || "",
      selectedVariables: Array.isArray(body.selectedVariables)
        ? body.selectedVariables.filter((v) => typeof v === "string")
        : [...BULK_EMAIL_MERGE_TAG_DEFAULTS],
      calendlyUrl: body.calendlyUrl ?? null,
      templateName: body.templateName?.trim(),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate template";
    const status =
      message.includes("GOOGLE_API_KEY") || message.includes("GEMINI_API_KEY")
        ? 503
        : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
