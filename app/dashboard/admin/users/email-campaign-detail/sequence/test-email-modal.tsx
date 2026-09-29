"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

type Sender = { id: string; email: string; display_name?: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSend: (
    emails: string[],
    fromEmail?: string,
    processedSubject?: string,
    processedBody?: string,
  ) => Promise<void>;
  subject: string;
  body: string;
  stepNumber: number;
  senders: Sender[];
  campaignId: string;
};

export function TestEmailModal({
  isOpen,
  onClose,
  onSend,
  subject,
  body,
  stepNumber,
  senders,
}: Props) {
  const [emails, setEmails] = useState("");
  const [fromEmail, setFromEmail] = useState(senders[0]?.email ?? "");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const list = emails
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (!list.length) return;
    setSending(true);
    try {
      await onSend(list, fromEmail || undefined, subject, body);
      onClose();
      setEmails("");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle>Send test email — Step {stepNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Recipient emails</Label>
            <Input
              placeholder="you@example.com, teammate@example.com"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
            />
          </div>
          {senders.length > 0 && (
            <div className="space-y-2">
              <Label>From</Label>
              <Select value={fromEmail} onValueChange={setFromEmail}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sender" />
                </SelectTrigger>
                <SelectContent>
                  {senders.map((s) => (
                    <SelectItem key={s.id} value={s.email}>
                      {s.display_name ? `${s.display_name} <${s.email}>` : s.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="rounded-lg bg-gray-50 border p-3 text-sm">
            <p className="font-medium text-gray-700 truncate">{subject || "(no subject)"}</p>
            <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
              {body.replace(/<[^>]+>/g, " ").slice(0, 200)}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-[#662EBD] hover:bg-[#5524a8]"
            onClick={handleSend}
            disabled={sending || !emails.trim()}
          >
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
