import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";

const BUCKET = "withdrawal-payment-proofs";
/** Max upload size for payment proof files (images and videos). */
const MAX_PROOF_FILE_BYTES = 5 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "proof";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: requestId } = await params;
  const supabase = createAdminClient();

  const { data: row, error: fetchErr } = await supabase
    .from("withdrawal_requests")
    .select("id")
    .eq("id", requestId)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json(
      { error: fetchErr?.message || "Withdrawal not found" },
      { status: 404 },
    );
  }

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await req.json();
    const link = body?.payment_proof_link;
    if (typeof link !== "string" || !link.trim()) {
      return NextResponse.json(
        { error: "payment_proof_link required" },
        { status: 400 },
      );
    }
    const trimmed = link.trim().slice(0, 2048);
    const { error: upErr } = await supabase
      .from("withdrawal_requests")
      .update({
        payment_proof_link: trimmed,
      })
      .eq("id", requestId);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, payment_proof_link: trimmed });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  const originalName = sanitizeFileName(file.name || "upload");

  const ab = await file.arrayBuffer();
  const buffer = Buffer.from(ab);

  if (!mime.startsWith("video/") && !mime.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image or video uploads are allowed for file proof." },
      { status: 400 },
    );
  }

  if (buffer.length > MAX_PROOF_FILE_BYTES) {
    return NextResponse.json(
      {
        error: `File too large (max ${MAX_PROOF_FILE_BYTES / 1024 / 1024} MB). Use the proof URL field for larger files.`,
      },
      { status: 400 },
    );
  }

  const path = `${requestId}/${Date.now()}-${originalName}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: mime,
      upsert: true,
    });

  if (uploadErr) {
    console.error("Storage upload error", uploadErr);
    return NextResponse.json(
      {
        error:
          uploadErr.message ||
          "Upload failed. Ensure bucket withdrawal-payment-proofs exists.",
      },
      { status: 500 },
    );
  }

  const fileSize = buffer.length;

  const { error: upErr } = await supabase
    .from("withdrawal_requests")
    .update({
      payment_proof_storage_path: path,
      payment_proof_file_size_bytes: fileSize,
    })
    .eq("id", requestId);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    payment_proof_storage_path: path,
    payment_proof_file_size_bytes: fileSize,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: requestId } = await params;
  const supabase = createAdminClient();

  const { data: row, error: fetchErr } = await supabase
    .from("withdrawal_requests")
    .select("payment_proof_storage_path")
    .eq("id", requestId)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json(
      { error: fetchErr?.message || "Withdrawal not found" },
      { status: 404 },
    );
  }

  const path = row.payment_proof_storage_path as string | null;
  if (path) {
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove([path]);
    if (rmErr && !/not found/i.test(rmErr.message ?? "")) {
      console.error("Storage remove error", rmErr);
      return NextResponse.json(
        { error: rmErr.message || "Could not delete file from storage" },
        { status: 500 },
      );
    }
  }

  const { error: upErr } = await supabase
    .from("withdrawal_requests")
    .update({
      payment_proof_storage_path: null,
      payment_proof_file_size_bytes: null,
    })
    .eq("id", requestId);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
