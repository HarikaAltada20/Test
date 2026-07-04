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
import { BarChart3, Calendar, Clock, Info, Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  projectId: string | null;
  projectName?: string;
  dailyLimit?: number;
  sentToday?: number;
  sendIntervalSeconds?: number;
  scheduleTimezone?: string;
  scheduleFromTime?: string;
  scheduleToTime?: string;
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
  scheduleFromTime = "09:00",
  scheduleToTime = "17:00",
  onOpenChange,
  onSaved,
}: Props) {
  const [dailyLimitVal, setDailyLimitVal] = useState(String(dailyLimit));
  const [intervalVal, setIntervalVal] = useState(String(sendIntervalSeconds));
  const [fromTime, setFromTime] = useState(scheduleFromTime);
  const [toTime, setToTime] = useState(scheduleToTime);
  const [useIst, setUseIst] = useState(scheduleTimezone === "Asia/Kolkata");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setDailyLimitVal(String(dailyLimit));
      setIntervalVal(String(sendIntervalSeconds));
      setFromTime(scheduleFromTime);
      setToTime(scheduleToTime);
      setUseIst(scheduleTimezone === "Asia/Kolkata");
    }
  }, [
    open,
    dailyLimit,
    sendIntervalSeconds,
    scheduleFromTime,
    scheduleToTime,
    scheduleTimezone,
  ]);

  const limit = Math.min(300, Math.max(1, parseInt(dailyLimitVal, 10) || 300));
  const remaining = Math.max(0, limit - sentToday);
  const progress = limit > 0 ? (sentToday / limit) * 100 : 0;

  const tzLabel = useIst
    ? "IST (Asia/Kolkata, UTC+5:30)"
    : "UTC";

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
          scheduleFromTime: fromTime,
          scheduleToTime: toTime,
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
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-xl max-h-[90vh] overflow-y-auto p-6 bg-white gap-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-gray-900">
            Scheduling Settings{projectName ? ` — ${projectName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <BarChart3 className="h-4 w-4 text-purple-600" />
              Email Limits &amp; Usage
            </h3>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                Daily Email Limit
              </Label>
              <Input
                type="number"
                min={1}
                max={300}
                value={dailyLimitVal}
                onChange={(e) => setDailyLimitVal(e.target.value)}
                className="bg-white border-gray-300"
              />
              <p className="text-xs text-muted-foreground">
                Maximum emails to send per day (1–300)
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Emails Sent Today</span>
                <span className="font-semibold text-gray-900">
                  {sentToday} / {limit}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                Remaining:{" "}
                <span className="font-semibold text-[#662EBD]">{remaining}</span>
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Daily Progress</span>
                  <span>{progress.toFixed(0)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Clock className="h-4 w-4 text-purple-600" />
              Timing Settings
            </h3>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                Time Between Emails (seconds)
              </Label>
              <Input
                type="number"
                min={1}
                max={3600}
                value={intervalVal}
                onChange={(e) => setIntervalVal(e.target.value)}
                className="bg-white border-gray-300"
              />
              <p className="text-xs text-muted-foreground">
                Delay between sending emails (1–3600 seconds)
              </p>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="use-ist"
                checked={useIst}
                onCheckedChange={(c) => setUseIst(!!c)}
                className="mt-0.5 border-gray-400 data-[state=checked]:bg-purple-600"
              />
              <div className="space-y-1">
                <Label
                  htmlFor="use-ist"
                  className="text-sm font-medium text-gray-800 cursor-pointer"
                >
                  Use Indian Standard Time (IST)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Scheduling will follow Asia/Kolkata (UTC+5:30) by default.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Calendar className="h-4 w-4 text-purple-600" />
              Daily Schedule
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Start Time
                </Label>
                <Input
                  type="time"
                  value={fromTime}
                  onChange={(e) => setFromTime(e.target.value)}
                  className="bg-white border-gray-300"
                />
                <p className="text-xs text-muted-foreground">
                  When to start sending emails daily
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  End Time
                </Label>
                <Input
                  type="time"
                  value={toTime}
                  onChange={(e) => setToTime(e.target.value)}
                  className="bg-white border-gray-300"
                />
                <p className="text-xs text-muted-foreground">
                  When to stop sending emails daily
                </p>
              </div>
            </div>

            <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
              <p>
                Emails will only be sent between{" "}
                <strong>{fromTime}</strong> and <strong>{toTime}</strong> in{" "}
                <strong>{tzLabel}</strong>
              </p>
            </div>
          </section>
        </div>

        <DialogFooter className="border-t border-gray-200 pt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto border-[#662EBD] text-[#662EBD] hover:bg-purple-50 hover:text-[#662EBD]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={submitting}
            className="w-full sm:w-auto bg-[#662EBD] hover:bg-[#5524a8] text-white"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
