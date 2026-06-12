"use client";

import { useEffect, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  projectId: string | null;
  projectName?: string;
  dailyLimit?: number;
  sentToday?: number;
  sendIntervalSeconds?: number;
  scheduleTimezone?: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function EmailSchedulingDialog({
  open,
  projectId,
  projectName,
  dailyLimit = 300,
  sentToday = 0,
  sendIntervalSeconds = 60,
  scheduleTimezone = "UTC",
  onOpenChange,
  onSaved,
}: Props) {
  const [dailyLimitVal, setDailyLimitVal] = useState(String(dailyLimit));
  const [intervalVal, setIntervalVal] = useState(String(sendIntervalSeconds));
  const [useIst, setUseIst] = useState(scheduleTimezone === "Asia/Kolkata");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setDailyLimitVal(String(dailyLimit));
      setIntervalVal(String(sendIntervalSeconds));
      setUseIst(scheduleTimezone === "Asia/Kolkata");
    }
  }, [open, dailyLimit, sendIntervalSeconds, scheduleTimezone]);

  const limit = parseInt(dailyLimitVal, 10) || 300;
  const remaining = Math.max(0, limit - sentToday);
  const progress = limit > 0 ? (sentToday / limit) * 100 : 0;

  const handleSave = async () => {
    if (!projectId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/email-projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyLimit: limit,
          sendIntervalSeconds: parseInt(intervalVal, 10) || 60,
          scheduleTimezone: useIst ? "Asia/Kolkata" : "UTC",
        }),
      });
      if (res.ok) {
        onSaved();
        onOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="bg-purple-50 -mx-6 -mt-6 px-6 py-4 rounded-t-lg">
          <DialogTitle>
            Scheduling Settings{projectName ? ` — ${projectName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Email Limits & Usage</h4>
            <div className="space-y-2">
              <Label>Daily Email Limit</Label>
              <Input
                type="number"
                min={1}
                max={300}
                value={dailyLimitVal}
                onChange={(e) => setDailyLimitVal(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Maximum emails to send per day (1–300)
              </p>
            </div>
            <div className="rounded-lg border p-3 bg-purple-50/50">
              <div className="flex justify-between text-sm">
                <span>Emails Sent Today</span>
                <span className="font-semibold text-purple-700">
                  {sentToday} / {limit}
                </span>
              </div>
              <p className="text-xs text-purple-600 mt-1">
                Remaining: {remaining}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Progress value={progress} className="flex-1 h-2" />
                <span className="text-xs text-muted-foreground">
                  {progress.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Timing Settings</h4>
            <div className="space-y-2">
              <Label>Time Between Emails (seconds)</Label>
              <Input
                type="number"
                min={1}
                max={3600}
                value={intervalVal}
                onChange={(e) => setIntervalVal(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Delay between sending emails (1–3600 seconds)
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="use-ist"
                checked={useIst}
                onCheckedChange={(c) => setUseIst(!!c)}
              />
              <div>
                <Label htmlFor="use-ist" className="font-normal cursor-pointer">
                  Use Indian Standard Time (IST)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Scheduling will follow Asia/Kolkata (UTC+5:30) by default.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={submitting}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
