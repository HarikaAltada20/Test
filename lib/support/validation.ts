import { SUPPORT_MESSAGE_MAX_LENGTH } from "@/lib/constants/support";

export function normalizeSupportBody(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > SUPPORT_MESSAGE_MAX_LENGTH) {
    return trimmed.slice(0, SUPPORT_MESSAGE_MAX_LENGTH);
  }
  return trimmed;
}

export function previewMessage(body: string, maxLen = 200): string {
  if (body.length <= maxLen) return body;
  return `${body.slice(0, maxLen)}...`;
}
