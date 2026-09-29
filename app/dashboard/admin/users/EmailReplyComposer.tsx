"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmailRichTextEditor } from "./email-campaign-detail/sequence/email-rich-text-editor";

type Props = {
  toEmail: string;
  toName?: string | null;
  fromEmail: string;
  subject: string;
  value: string;
  onChange: (html: string) => void;
  onClose: () => void;
  onSend: () => void;
  sending?: boolean;
  className?: string;
};

function formatRecipient(email: string, name?: string | null): string {
  const trimmed = email.trim();
  if (!name?.trim()) return trimmed;
  return `${name.trim()} <${trimmed}>`;
}

export function EmailReplyComposer({
  toEmail,
  toName,
  fromEmail,
  subject,
  value,
  onChange,
  onClose,
  onSend,
  sending = false,
  className,
}: Props) {
  const recipientLabel = formatRecipient(toEmail, toName);
  const canSend = value.replace(/<[^>]*>/g, "").trim().length > 0;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden bg-white",
        className,
      )}
    >
      <div className="shrink-0 flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <h4 className="text-base font-semibold text-gray-900">Reply</h4>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-500 hover:text-gray-700"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="shrink-0 border-b border-gray-100">
        <div className="flex items-center gap-3 px-5 py-2.5 text-sm">
          <span className="w-14 shrink-0 text-gray-500">To:</span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-gray-100 px-2.5 py-1 text-sm text-gray-800">
              <span className="truncate">{recipientLabel}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-gray-50 px-5 py-2.5 text-sm">
          <span className="w-14 shrink-0 text-gray-500">From:</span>
          <span className="truncate text-gray-800">{fromEmail}</span>
        </div>

        <div className="flex items-center gap-3 border-t border-gray-50 px-5 py-2.5 text-sm">
          <span className="w-14 shrink-0 text-gray-500">Subject:</span>
          <span className="truncate font-medium text-gray-900">{subject}</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2">
        <EmailRichTextEditor
          value={value}
          onChange={onChange}
          onSend={onSend}
          sending={sending}
          sendDisabled={!canSend}
          layout="reply"
          placeholder="Type your reply here..."
        />
      </div>
    </div>
  );
}
