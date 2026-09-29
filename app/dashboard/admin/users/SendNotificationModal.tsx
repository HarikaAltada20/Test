"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import {
  CONTEST_TEMPLATE_VARIABLES,
  TEMPLATE_VARIABLES,
  resolveNotificationTemplate,
} from "@/lib/admin-notifications/template";
import {
  ContestSearchSelect,
  type ContestSearchOption,
} from "@/components/admin/ContestSearchSelect";
import {
  parseDatetimeLocalValue,
  toDatetimeLocalInputValue,
} from "@/lib/admin-notifications/schedule";
import type { RecipientUserRow } from "@/lib/admin-notifications/types";
import type { UserManagementFilterSnapshot } from "@/lib/admin-notifications/types";
import { Loader2 } from "lucide-react";

export type NotificationSelectionState = {
  mode: "selected_user_ids" | "select_all_filtered";
  userIds: string[];
  users: RecipientUserRow[];
  filterSnapshot: UserManagementFilterSnapshot;
  label: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: NotificationSelectionState | null;
  timezone: "UTC" | "local";
  isDark?: boolean;
  onSuccess: (result: {
    campaignId: string;
    recipientCount: number;
    status: string;
    scheduledAt: string | null;
    successCount?: number;
    failureCount?: number;
  }) => void;
};

export function SendNotificationModal({
  open,
  onOpenChange,
  selection,
  timezone,
  isDark = false,
  onSuccess,
}: Props) {
  const [messageBody, setMessageBody] = useState("");
  const [selectedContest, setSelectedContest] =
    useState<ContestSearchOption | null>(null);
  const [sendTiming, setSendTiming] = useState<"immediate" | "scheduled">(
    "immediate",
  );
  const [scheduleDatetime, setScheduleDatetime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeCounts = useMemo(() => {
    if (!selection) return { creator: 0, advertiser: 0, admin: 0 };
    return selection.users.reduce(
      (acc, u) => {
        if (u.user_type === "creator") acc.creator += 1;
        else if (u.user_type === "advertiser") acc.advertiser += 1;
        else if (u.user_type === "admin") acc.admin += 1;
        return acc;
      },
      { creator: 0, advertiser: 0, admin: 0 },
    );
  }, [selection]);

  const previewUser = selection?.users[0] ?? null;
  const contestContext = useMemo(() => {
    if (!selectedContest) return null;
    return {
      id: selectedContest.id,
      title: selectedContest.title,
    };
  }, [selectedContest]);

  const templateVariables = useMemo(
    () =>
      selectedContest
        ? [...TEMPLATE_VARIABLES, ...CONTEST_TEMPLATE_VARIABLES]
        : [...TEMPLATE_VARIABLES],
    [selectedContest],
  );

  const previewText = useMemo(() => {
    if (!previewUser || !messageBody.trim()) return "";
    return resolveNotificationTemplate(messageBody, previewUser, timezone, {
      contest: contestContext,
    });
  }, [messageBody, previewUser, timezone, contestContext]);

  const minScheduleDatetime = useMemo(
    () => toDatetimeLocalInputValue(new Date(Date.now() + 5 * 60 * 1000)),
    [],
  );

  const scheduledInstant = useMemo(() => {
    if (sendTiming !== "scheduled" || !scheduleDatetime) return null;
    return parseDatetimeLocalValue(scheduleDatetime);
  }, [sendTiming, scheduleDatetime]);

  const scheduleSummary = useMemo(() => {
    if (!scheduledInstant) return null;
    const local = scheduledInstant.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      hour12: true,
    });
    const utc = scheduledInstant.toLocaleString("en-US", {
      timeZone: "UTC",
      dateStyle: "medium",
      timeStyle: "short",
      hour12: true,
    });
    return { local, utc };
  }, [scheduledInstant]);

  const scheduledAtIso = scheduledInstant?.toISOString() ?? null;

  const handleSubmit = async () => {
    if (!selection || selection.userIds.length === 0) {
      setError("No recipients selected");
      return;
    }
    const trimmed = messageBody.trim();
    if (!trimmed) {
      setError("Message is required");
      return;
    }
    if (sendTiming === "scheduled" && !scheduledAtIso) {
      setError("Pick a date and time.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationType: "public",
          messageBody: trimmed,
          recipientMode: selection.mode,
          userIds: selection.userIds,
          filters: selection.filterSnapshot,
          sendTiming,
          scheduledAt: scheduledAtIso,
          timezoneLabel: "local",
          contestId: selectedContest?.id ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send");
        return;
      }
      onSuccess({
        campaignId: data.campaignId,
        recipientCount: data.recipientCount,
        status: data.status,
        scheduledAt: data.scheduledAt,
        successCount: data.successCount,
        failureCount: data.failureCount,
      });
      setMessageBody("");
      setSelectedContest(null);
      setSendTiming("immediate");
      setScheduleDatetime("");
      onOpenChange(false);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const recipientSummary = selection
    ? `Sending to ${selection.userIds.length} user(s)${
        typeCounts.creator > 0 ? ` (${typeCounts.creator} creators` : ""
      }${
        typeCounts.advertiser > 0
          ? `${typeCounts.creator > 0 ? "," : " ("}${typeCounts.advertiser} brands`
          : ""
      }${
        typeCounts.admin > 0
          ? `, ${typeCounts.admin} admins`
          : ""
      }${typeCounts.creator > 0 || typeCounts.advertiser > 0 || typeCounts.admin > 0 ? ")" : ""}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send notification</DialogTitle>
          <DialogDescription>
            Compose a public announcement for selected users.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border p-3 text-sm space-y-1">
            <p className="font-medium">Recipients</p>
            {selection ? (
              <>
                <p className="text-muted-foreground">{recipientSummary}</p>
                <p className="text-xs text-muted-foreground">{selection.label}</p>
              </>
            ) : (
              <p className="text-destructive text-sm">No recipients selected</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Notification type</Label>
            <Select value="public" disabled>
              <SelectTrigger>
                <SelectValue placeholder="Public" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ContestSearchSelect
            value={selectedContest}
            onChange={setSelectedContest}
            isDark={isDark}
          />

          <div className="space-y-2">
            <Label htmlFor="notif-message">Message</Label>
            <Textarea
              id="notif-message"
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="Hi {full_name}, ..."
              rows={5}
              maxLength={2000}
              className={cn(isDark && "bg-slate-900 border-slate-700")}
            />
            <p className="text-xs text-muted-foreground">
              Use {"{variable_name}"} for per-user values. Variables:{" "}
              {templateVariables.map((v) => `{${v.key}}`).join(", ")}
            </p>
            <div className="flex flex-wrap gap-1">
              {templateVariables.map((v) => (
                <Button
                  key={v.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setMessageBody((prev) => `${prev}{${v.key}}`)
                  }
                >
                  {`{${v.key}}`}
                </Button>
              ))}
            </div>
          </div>

          {previewText && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Preview{previewUser?.full_name ? ` (${previewUser.full_name})` : ""}
              </p>
              <p className="whitespace-pre-wrap">{previewText}</p>
            </div>
          )}

          <div className="space-y-3">
            <Label>When to send</Label>
            <RadioGroup
              value={sendTiming}
              onValueChange={(v) =>
                setSendTiming(v as "immediate" | "scheduled")
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="immediate" id="send-now" />
                <Label htmlFor="send-now" className="font-normal cursor-pointer">
                  Send now
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="scheduled" id="send-later" />
                <Label
                  htmlFor="send-later"
                  className="font-normal cursor-pointer"
                >
                  Schedule for later
                </Label>
              </div>
            </RadioGroup>
            {sendTiming === "scheduled" && (
              <div className="space-y-2 pl-6">
                <div>
                  <Label htmlFor="sched-datetime" className="text-xs">
                    Date & time (your local timezone)
                  </Label>
                  <input
                    id="sched-datetime"
                    type="datetime-local"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={scheduleDatetime}
                    min={minScheduleDatetime}
                    onChange={(e) => setScheduleDatetime(e.target.value)}
                  />
                </div>
                {scheduleSummary && (
                  <p className="text-xs text-muted-foreground">
                    Will send at <strong>{scheduleSummary.local}</strong> (your
                    time) · {scheduleSummary.utc} UTC
                  </p>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              !selection ||
              selection.userIds.length === 0 ||
              !messageBody.trim()
            }
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {sendTiming === "scheduled"
              ? "Schedule notification"
              : "Send notification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
