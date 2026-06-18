"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Loader2, Mail, X } from "lucide-react";
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
  const [selectedSenderIds, setSelectedSenderIds] = useState<string[]>([]);
  const [stopOnReply, setStopOnReply] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/email-campaigns/${campaignId}/options`)
      .then((r) => r.json())
      .then((d) => {
        setSenders(d.senders ?? []);
        if (Array.isArray(d.fromSenderIds) && d.fromSenderIds.length > 0) {
          setSelectedSenderIds(d.fromSenderIds);
        } else if (d.fromSenderId) {
          setSelectedSenderIds([d.fromSenderId]);
        } else {
          setSelectedSenderIds([]);
        }
        setStopOnReply(!!d.stopOnReply);
      })
      .finally(() => setLoading(false));
  }, [campaignId]);

  const availableSenders = useMemo(
    () => senders.filter((sender) => !selectedSenderIds.includes(sender.id)),
    [senders, selectedSenderIds],
  );

  const selectedSenders = useMemo(
    () =>
      selectedSenderIds
        .map((id) => senders.find((sender) => sender.id === id))
        .filter((sender): sender is Sender => !!sender),
    [selectedSenderIds, senders],
  );

  const addSender = (senderId: string) => {
    if (!senderId || selectedSenderIds.includes(senderId)) return;
    setSelectedSenderIds((prev) => [...prev, senderId]);
  };

  const removeSender = (senderId: string) => {
    setSelectedSenderIds((prev) => prev.filter((id) => id !== senderId));
  };

  const saveOptions = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/email-campaigns/${campaignId}/options`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromSenderIds: selectedSenderIds,
            stopOnReply,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Options saved" });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const resetAutoselect = () => {
    setSelectedSenderIds([]);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      <Card className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <CardContent className="p-5 space-y-3">
          <div>
            <Label className="text-gray-900 font-semibold">
              Accounts to use
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Select one or more accounts to send emails from
            </p>
          </div>

          <Select
            value=""
            onValueChange={addSender}
            disabled={availableSenders.length === 0}
          >
            <SelectTrigger className="w-full bg-white border-gray-300 h-11">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {availableSenders.map((sender) => (
                <SelectItem key={sender.id} value={sender.id}>
                  {sender.email}
                  {sender.is_default ? " (default)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedSenders.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedSenders.map((sender) => (
                <div
                  key={sender.id}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800"
                >
                  <Mail className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                  <span className="truncate max-w-[280px]">{sender.email}</span>
                  <button
                    type="button"
                    onClick={() => removeSender(sender.id)}
                    className="rounded-full p-0.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200/80"
                    aria-label={`Remove ${sender.email}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No accounts selected — autoselect will choose senders for this
              project.
            </p>
          )}

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
