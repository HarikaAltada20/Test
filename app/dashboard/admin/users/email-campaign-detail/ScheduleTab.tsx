"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "Asia/Kolkata", label: "IST - India Standard Time" },
  { value: "America/New_York", label: "EST - Eastern Time" },
  { value: "America/Los_Angeles", label: "PST - Pacific Time" },
];

type Props = {
  campaignId: string;
  projectId: string;
};

export function ScheduleTab({ campaignId, projectId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [useProjectDefault, setUseProjectDefault] = useState(true);
  const [dailyLimit, setDailyLimit] = useState("300");
  const [fromTime, setFromTime] = useState("09:00");
  const [toTime, setToTime] = useState("21:00");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [activeSchedule, setActiveSchedule] = useState<"default" | "custom">(
    "default",
  );

  const load = async () => {
    setLoading(true);
    try {
      const [scheduleRes, projectRes] = await Promise.all([
        fetch(`/api/admin/email-campaigns/${campaignId}/schedule`),
        fetch(`/api/admin/email-projects/${projectId}`),
      ]);
      const scheduleData = await scheduleRes.json();
      const projectData = await projectRes.json();

      const useDefault = scheduleData.useProjectDefault ?? true;
      setUseProjectDefault(useDefault);
      setActiveSchedule(useDefault ? "default" : "custom");

      const project = projectRes.ok ? projectData.project : null;
      const source = useDefault && project ? project : scheduleData;

      setDailyLimit(String(source.daily_limit ?? source.dailyLimit ?? 300));
      setFromTime(source.schedule_from_time ?? source.fromTime ?? "09:00");
      setToTime(source.schedule_to_time ?? source.toTime ?? "21:00");
      setTimezone(source.schedule_timezone ?? source.timezone ?? "UTC");
      setDays(source.schedule_days ?? source.days ?? [1, 2, 3, 4, 5, 6, 7]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [campaignId, projectId]);

  const readOnly = useProjectDefault;

  const toggleDay = (day: number, checked: boolean) => {
    setDays((prev) => {
      if (checked) return [...prev, day].sort((a, b) => a - b);
      return prev.filter((d) => d !== day);
    });
  };

  const saveSchedule = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/email-campaigns/${campaignId}/schedule`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            useProjectDefault,
            dailyLimit: parseInt(dailyLimit, 10) || 300,
            fromTime,
            toTime,
            timezone,
            days,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Schedule saved" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => {
            setActiveSchedule("default");
            setUseProjectDefault(true);
            load();
          }}
          className={cn(
            "w-full rounded-xl border p-4 text-left transition-colors",
            activeSchedule === "default"
              ? "border-[#662EBD] bg-purple-50"
              : "border-gray-200 bg-white hover:bg-gray-50",
          )}
        >
          <p className="font-medium text-sm">Project Default</p>
          <div className="flex gap-2 mt-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
              Active
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              Preview
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSchedule("custom");
            setUseProjectDefault(false);
          }}
          className={cn(
            "w-full rounded-xl border p-4 text-left flex items-center gap-2 transition-colors",
            activeSchedule === "custom"
              ? "border-[#662EBD] bg-purple-50"
              : "border-gray-200 bg-white hover:bg-gray-50",
          )}
        >
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">New Schedule</span>
        </button>

        <Button variant="ghost" className="w-full text-[#662EBD]" disabled>
          <Plus className="h-4 w-4 mr-1" />
          Add Schedule
        </Button>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-900">
          <strong>Note:</strong> Toggle &quot;Use project default schedule&quot; to
          modify the schedule. By default settings are read-only. Changing this
          affects campaign sending only.
        </div>

        <Card className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <Label className="text-gray-800 font-medium">
              Use project default schedule
            </Label>
            <Switch
              checked={useProjectDefault}
              onCheckedChange={(v) => {
                setUseProjectDefault(v);
                setActiveSchedule(v ? "default" : "custom");
                if (v) load();
              }}
              variant="theme-aware"
              theme="light"
            />
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <CardContent className="p-5 space-y-3">
            <Label className="text-gray-800 font-medium">Daily Limit</Label>
            <Input
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              disabled={readOnly}
              className="bg-white border-gray-300 max-w-xs"
            />
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <CardContent className="p-5 space-y-4">
            <Label className="text-gray-800 font-medium">Timings</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">From</Label>
                <Input
                  value={fromTime}
                  onChange={(e) => setFromTime(e.target.value)}
                  disabled={readOnly}
                  className="bg-white border-gray-300"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">To</Label>
                <Input
                  value={toTime}
                  onChange={(e) => setToTime(e.target.value)}
                  disabled={readOnly}
                  className="bg-white border-gray-300"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Timezone</Label>
                <Select
                  value={timezone}
                  onValueChange={setTimezone}
                  disabled={readOnly}
                >
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <CardContent className="p-5 space-y-3">
            <Label className="text-gray-800 font-medium">Days</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DAYS.map((d) => (
                <label
                  key={d.value}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={days.includes(d.value)}
                    onCheckedChange={(v) => toggleDay(d.value, !!v)}
                    disabled={readOnly}
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {!readOnly && (
          <div className="flex justify-end">
            <Button
              className="bg-[#662EBD] hover:bg-[#5524a8]"
              onClick={saveSchedule}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Schedule
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
