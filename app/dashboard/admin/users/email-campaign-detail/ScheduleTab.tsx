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
import { Calendar, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { EmailFormPanelSkeleton } from "../EmailSkeletons";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { CreateScheduleModal } from "./CreateScheduleModal";
import { ScheduleTimePicker } from "./ScheduleTimePicker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

type ScheduleItem = {
  id: string;
  name: string;
  dailyLimit: number;
  fromTime: string;
  toTime: string;
  timezone: string;
  days: number[];
};

type Props = {
  campaignId: string;
  projectId: string;
};

export function ScheduleTab({ campaignId, projectId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<ScheduleItem | null>(null);
  const [deleteScheduleId, setDeleteScheduleId] = useState<string | null>(null);
  const [useProjectDefault, setUseProjectDefault] = useState(true);
  const [activeScheduleId, setActiveScheduleId] = useState("default");
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [dailyLimit, setDailyLimit] = useState("300");
  const [fromTime, setFromTime] = useState("09:00");
  const [toTime, setToTime] = useState("21:00");
  const [timezone, setTimezone] = useState("UTC");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);

  const applyForm = (data: {
    dailyLimit?: number;
    fromTime?: string;
    toTime?: string;
    timezone?: string;
    days?: number[];
  }) => {
    setDailyLimit(String(data.dailyLimit ?? 300));
    setFromTime(data.fromTime ?? "09:00");
    setToTime(data.toTime ?? "21:00");
    setTimezone(data.timezone ?? "UTC");
    setDays(data.days ?? [1, 2, 3, 4, 5, 6, 7]);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/email-campaigns/${campaignId}/schedule`);
      const data = await res.json();
      if (!res.ok) return;

      const useDefault = data.useProjectDefault ?? true;
      setUseProjectDefault(useDefault);
      setActiveScheduleId(data.activeScheduleId ?? "default");
      setSchedules(data.schedules ?? []);
      applyForm(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [campaignId, projectId]);

  const readOnly = useProjectDefault;

  const selectProjectDefault = async () => {
    setActiveScheduleId("default");
    setUseProjectDefault(true);
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/email-campaigns/${campaignId}/schedule`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            useProjectDefault: true,
            activeScheduleId: "default",
          }),
        },
      );
      if (res.ok) await load();
    } finally {
      setSaving(false);
    }
  };

  const selectCustomSchedule = async (schedule: ScheduleItem) => {
    setActiveScheduleId(schedule.id);
    setUseProjectDefault(false);
    applyForm(schedule);
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/email-campaigns/${campaignId}/schedule`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            useProjectDefault: false,
            activeScheduleId: schedule.id,
          }),
        },
      );
      if (!res.ok) {
        const data = await res.json();
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: number, checked: boolean) => {
    setDays((prev) => {
      if (checked) return [...prev, day].sort((a, b) => a - b);
      return prev.filter((d) => d !== day);
    });
  };

  const handleCreateSchedule = async (name: string) => {
    setCreating(true);
    try {
      const res = await fetch(
        `/api/admin/email-campaigns/${campaignId}/schedule`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ createSchedule: { name } }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not create schedule",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      setCreateModalOpen(false);
      await load();
      toast({ title: "Schedule created", description: name });
    } finally {
      setCreating(false);
    }
  };

  const handleRenameSchedule = async (name: string) => {
    if (!editSchedule) return;
    setCreating(true);
    try {
      const res = await fetch(
        `/api/admin/email-campaigns/${campaignId}/schedule`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            updateScheduleName: { id: editSchedule.id, name },
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not rename schedule",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      setEditSchedule(null);
      await load();
      toast({ title: "Schedule updated", description: name });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!deleteScheduleId) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/email-campaigns/${campaignId}/schedule`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deleteScheduleId }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not delete schedule",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      setDeleteScheduleId(null);
      await load();
      toast({ title: "Schedule deleted" });
    } finally {
      setSaving(false);
    }
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
            activeScheduleId,
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
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <EmailFormPanelSkeleton />;
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
        <div className="space-y-2">
          <button
            type="button"
            onClick={selectProjectDefault}
            className={cn(
              "w-full rounded-xl border p-4 text-left transition-colors",
              activeScheduleId === "default" && useProjectDefault
                ? "border-[#662EBD] bg-purple-50"
                : "border-gray-200 bg-white hover:bg-gray-50",
            )}
          >
            <p className="font-medium text-sm">Project Default</p>
            <div className="flex gap-2 mt-2">
              {activeScheduleId === "default" && useProjectDefault && (
                <>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                    Active
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    Preview
                  </span>
                </>
              )}
            </div>
          </button>

          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className={cn(
                "w-full rounded-xl border p-3 transition-colors flex items-center gap-2",
                activeScheduleId === schedule.id && !useProjectDefault
                  ? "border-[#662EBD] bg-purple-50"
                  : "border-gray-200 bg-white hover:bg-gray-50",
              )}
            >
              <button
                type="button"
                onClick={() => selectCustomSchedule(schedule)}
                className="flex-1 min-w-0 text-left flex items-center gap-2"
              >
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-sm truncate">
                  {schedule.name}
                </span>
              </button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0 border-purple-200 text-[#662EBD] hover:bg-purple-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditSchedule(schedule);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0 border-red-200 text-red-600 hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteScheduleId(schedule.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          <Button
            variant="ghost"
            className="w-full text-[#662EBD] hover:text-[#5524a8] hover:bg-purple-50"
            onClick={() => setCreateModalOpen(true)}
          >
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
                  if (v) {
                    selectProjectDefault();
                  } else if (schedules.length === 0) {
                    setCreateModalOpen(true);
                  } else {
                    selectCustomSchedule(
                      schedules.find((s) => s.id === activeScheduleId) ??
                        schedules[0],
                    );
                  }
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
                  <ScheduleTimePicker
                    value={fromTime}
                    onChange={setFromTime}
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">To</Label>
                  <ScheduleTimePicker
                    value={toTime}
                    onChange={setToTime}
                    disabled={readOnly}
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

      <CreateScheduleModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateSchedule}
        submitting={creating}
      />

      <CreateScheduleModal
        open={!!editSchedule}
        onClose={() => setEditSchedule(null)}
        onSubmit={handleRenameSchedule}
        submitting={creating}
        initialName={editSchedule?.name ?? ""}
        title="Edit Schedule"
        submitLabel="Save"
      />

      <AlertDialog
        open={!!deleteScheduleId}
        onOpenChange={() => setDeleteScheduleId(null)}
      >
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this schedule from the campaign. If
              it is active, the project default schedule will be used instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                handleDeleteSchedule();
              }}
            >
              {saving ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
