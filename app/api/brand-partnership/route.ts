import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  formatApplicationEmailSummary,
  submitToGoogleForm,
} from "@/lib/brand-partnership/google-submit";
import { brandPartnershipSchema } from "@/lib/brand-partnership/validation";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = brandPartnershipSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0]?.toString();
        if (key && !fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      });
      return NextResponse.json(
        { success: false, error: "Validation failed", fieldErrors },
        { status: 400 },
      );
    }

    const { ok, status } = await submitToGoogleForm(parsed.data);

    if (!ok) {
      console.error("Google Form submit failed with status:", status);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to submit application. Please try again.",
        },
        { status: 502 },
      );
    }

    if (resend) {
      try {
        await resend.emails.send({
          from: "noreply@gameofcreators.com",
          to: "contact@gameofcreators.com",
          subject: `Brand Partnership Application — ${parsed.data.brandName}`,
          text: formatApplicationEmailSummary(parsed.data),
        });
      } catch (emailErr) {
        console.error("Brand partnership backup email failed:", emailErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Brand partnership API error:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong" },
      { status: 500 },
    );
  }
}
