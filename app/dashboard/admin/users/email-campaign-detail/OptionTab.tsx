"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Sender = { id: string; email: string; is_default: boolean };

type Props = {
  campaignId: string;
  onSaved: () => void;
};

export function OptionTab({ campaignId, onSaved }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [senderId, setSenderId] = useState("");
  const [stopOnReply, setStopOnReply] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/email-campaigns/${campaignId}/options`)
      .then((r) => r.json())
      .then((d) => {
        setSenders(d.senders ?? []);
        if (d.fromSenderId) setSenderId(d.fromSenderId);
        setStopOnReply(!!d.stopOnReply);
      })
      .finally(() => setLoading(false));
  }, [campaignId]);

  const saveOptions = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/email-campaigns/${campaignId}/options`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromSenderId: senderId || null,
            stopOnReply,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Options saved" });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const resetAutoselect = () => {
    const defaultSender = senders.find((s) => s.is_default);
    setSenderId(defaultSender?.id ?? "");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <CardContent className="p-5 space-y-3">
          <div>
            <Label className="text-gray-900 font-semibold">Accounts to use</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Select one or more accounts to send emails from
            </p>
          </div>
          <Select value={senderId} onValueChange={setSenderId}>
            <SelectTrigger className="bg-white border-gray-300 h-11">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {senders.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.email}
                  {s.is_default ? " (default)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Autoselect will be used if no accounts or tags are selected
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Label className="text-gray-900 font-semibold">
              Stop sending emails on reply
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Stop sending emails to a lead if a response has been received
            </p>
          </div>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setStopOnReply(false)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors",
                !stopOnReply
                  ? "bg-white text-gray-900 shadow-sm"
                  : "bg-gray-100 text-gray-500",
              )}
            >
              Disable
            </button>
            <button
              type="button"
              onClick={() => setStopOnReply(true)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-l border-gray-300 transition-colors",
                stopOnReply
                  ? "bg-white text-gray-900 shadow-sm"
                  : "bg-gray-100 text-gray-500",
              )}
            >
              Enable
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          className="border-[#662EBD] text-[#662EBD] hover:bg-purple-50"
          onClick={resetAutoselect}
        >
          Reset to Autoselect
        </Button>
        <Button
          className="bg-[#662EBD] hover:bg-[#5524a8]"
          onClick={saveOptions}
          disabled={saving}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}
