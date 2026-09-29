import { NextResponse } from "next/server";

export function isQueueWorkerRequest(request: Request): boolean {
  return (
    request.headers.get("X-From-Queue") === "1" ||
    request.headers.get("x-from-queue") === "1"
  );
}

export function unauthorizedQueueWorkerResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Queue workers send X-From-Queue + Bearer CRON_SECRET. */
export function authorizeQueueWorker(request: Request): {
  fromQueue: boolean;
  authorized: boolean;
  response?: NextResponse;
} {
  if (!isQueueWorkerRequest(request)) {
    return { fromQueue: false, authorized: false };
  }
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("Authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return {
      fromQueue: true,
      authorized: false,
      response: unauthorizedQueueWorkerResponse(),
    };
  }
  return { fromQueue: true, authorized: true };
}

export function readQueuedActorUserId(body: {
  admin_user_id?: unknown;
  actor_user_id?: unknown;
}): string {
  const adminId =
    typeof body.admin_user_id === "string" ? body.admin_user_id.trim() : "";
  if (adminId) return adminId;
  return typeof body.actor_user_id === "string" ? body.actor_user_id.trim() : "";
}
