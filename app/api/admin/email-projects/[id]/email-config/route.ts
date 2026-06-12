import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  buildFullDomain,
  verifyDomainWithSes,
} from "@/lib/email/ses-identity";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  let body: { rootDomain?: string; subdomainPrefix?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fullDomain = buildFullDomain(
    body.rootDomain ?? "",
    body.subdomainPrefix ?? "",
  );
  if (!fullDomain) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const { dnsRecords, error: sesError } = await verifyDomainWithSes(fullDomain);
  const db = createAdminClient();

  const { data, error } = await db
    .from("admin_email_projects")
    .update({
      root_domain: body.rootDomain?.trim(),
      subdomain_prefix: body.subdomainPrefix?.trim(),
      full_domain: fullDomain,
      dns_records: dnsRecords,
      ses_verification_status: sesError ? "failed" : "pending",
    })
    .eq("id", id)
    .select("id, full_domain, dns_records, ses_verification_status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    project: data,
    sesError: sesError ?? null,
  });
}
