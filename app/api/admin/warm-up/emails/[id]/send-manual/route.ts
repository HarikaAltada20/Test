import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  sendWarmUpEmails,
  sendManualWarmUpEmailRich,
} from "@/lib/admin-email/warm-up-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;

  let body: {
    count?: number;
    templateId?: string;
    template_id?: string;
    recipients?: string[];
    customSubject?: string;
    custom_subject?: string;
    customBody?: string;
    custom_body?: string;
    fromEmail?: string;
    from_email?: string;
  } = {};

  try {
    body = await req.json();
  } catch {
    // body is optional
  }

  // Rich send: when recipients array is provided
  const recipientEmails = body.recipients;
  if (recipientEmails?.length) {
    try {
      const result = await sendManualWarmUpEmailRich(id, {
        templateId: body.templateId ?? body.template_id,
        recipientEmails,
        customSubject: body.customSubject ?? body.custom_subject,
        customBody: body.customBody ?? body.custom_body,
        fromEmail: body.fromEmail ?? body.from_email,
      });
      return NextResponse.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Send failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Simple send: just a count
  const count =
    typeof body.count === "number" && body.count > 0
      ? Math.min(body.count, 100)
      : undefined;

  try {
    const result = await sendWarmUpEmails(id, { manual: true, count });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
