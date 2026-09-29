import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";

const BUCKET = "withdrawal-payment-proofs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: requestId } = await params;
  const supabase = createAdminClient();

  const { data: row, error } = await supabase
    .from("withdrawal_requests")
    .select("payment_proof_storage_path")
    .eq("id", requestId)
    .maybeSingle();

  if (error || !row?.payment_proof_storage_path) {
    return NextResponse.json({ error: "No file proof on record" }, { status: 404 });
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.payment_proof_storage_path, 3600);

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signErr?.message || "Could not sign URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: signed.signedUrl });
}
