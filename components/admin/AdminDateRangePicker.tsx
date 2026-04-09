"use client";

import { useEffect, useMemo, useState } from "react";
import { subDays, subMonths, format } from "date-fns";
import { Calendar as CalendarIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type AdminDateRangeValue = { from: Date; to: Date };

export type AdminDateRangePickerProps = {
  isDark: boolean;
  /** Current range (controlled). */
  value: AdminDateRangeValue;
  /** Label shown on trigger (e.g. "Last 30 Days"). */
  presetLabel: string;
  /** Called when user applies a preset or clicks Apply on custom range. */
  onChange: (next: AdminDateRangeValue, presetLabel: string) => void;
  triggerClassName?: string;
  align?: "start" | "center" | "end";
  /** Days in the past users may select (default 730). */
  maxHistoryDays?: number;
};

const KOLKATA_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function getDateStrInTz(date: Date, tz: "utc" | "local"): string {
  if (tz === "utc") {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const kolkata = new Date(date.getTime() + KOLKATA_OFFSET_MS);
  const y = kolkata.getUTCFullYear();
  const mo = String(kolkata.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kolkata.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function getTimeStrInTz(date: Date, tz: "utc" | "local"): string {
  if (tz === "utc") {
    const h = date.getUTCHours();
    const m = date.getUTCMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  }
  const kolkata = new Date(date.getTime() + KOLKATA_OFFSET_MS);
  const h = kolkata.getUTCHours();
  const m = kolkata.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function parseTime12To24(timeStr: string): { h: number; m: number } | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

function setTimeInTz(
  existing: Date,
  dateStr: string,
  timeStr: string,
  tz: "utc" | "local",
): Date | null {
  const parsed = parseTime12To24(timeStr);
  if (!parsed) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  if (!y || !mo || !d) return null;
  if (tz === "utc") {
    return new Date(Date.UTC(y, mo - 1, d, parsed.h, parsed.m, 0, 0));
  }
  const localKolkata = new Date(
    Date.UTC(y, mo - 1, d, parsed.h, parsed.m, 0, 0),
  );
  return new Date(localKolkata.getTime() - KOLKATA_OFFSET_MS);
}

/**
 * Presets + custom calendar + timezone controls, matching admin dashboard UX.
 */
export function AdminDateRangePicker({
  isDark,
  value,
  presetLabel,
  onChange,
  triggerClassName,
  align = "end",
  maxHistoryDays = 730,
}: AdminDateRangePickerProps) {
  const now = useMemo(() => new Date(), []);
  const [open, setOpen] = useState(false);
  const [internalRange, setInternalRange] = useState<AdminDateRangeValue>(value);
  const [calendarRange, setCalendarRange] = useState<
    { from?: Date; to?: Date } | undefined
  >(undefined);
  const [rangeTimezone, setRangeTimezone] = useState<"utc" | "local">("local");
  const [startTimeInput, setStartTimeInput] = useState<string | null>(null);
  const [endTimeInput, setEndTimeInput] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setInternalRange(value);
      setCalendarRange(undefined);
    }
  }, [open, value.from, value.to]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          type="button"
          className={cn(
            "min-w-[180px] max-w-[220px] justify-start text-left font-normal shrink-0",
            isDark ? "border-white/20 bg-white/5 hover:bg-white/10" : "",
            triggerClassName,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {presetLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-auto p-0",
          isDark ? "border-white/20 bg-[#170337]" : "",
        )}
        align={align}
      >
        <div className="flex flex-col sm:flex-row max-h-[420px] overflow-y-auto">
          <div className="flex flex-col gap-1 p-3 border-b sm:border-b-0 sm:border-r sm:h-full sm:min-h-[580px]">
            <p
              className={cn(
                "text-sm font-medium",
                isDark ? "text-gray-300" : "text-muted-foreground",
              )}
            >
              Presets
            </p>
            {(
              [
                {
                  label: "Last 7 Days",
                  get: () => ({ from: subDays(now, 6), to: now }),
                },
                {
                  label: "Last 30 Days",
                  get: () => ({ from: subDays(now, 29), to: now }),
                },
                {
                  label: "Last 3 Months",
                  get: () => ({ from: subMonths(now, 3), to: now }),
                },
                {
                  label: "Last 12 Months",
                  get: () => ({ from: subMonths(now, 12), to: now }),
                },
              ] as const
            ).map(({ label: presetLabelItem, get }) => (
              <Button
                key={presetLabelItem}
                variant="ghost"
                size="sm"
                type="button"
                className={cn(
                  "justify-start font-normal",
                  presetLabel === presetLabelItem
                    ? isDark
                      ? "bg-white/10 text-white"
                      : "bg-accent"
                    : isDark
                      ? "text-gray-300 hover:bg-white/10"
                      : "",
                )}
                onClick={() => {
                  const { from, to } = get();
                  const next = { from, to };
                  setInternalRange(next);
                  onChange(next, presetLabelItem);
                  setOpen(false);
                  setCalendarRange(undefined);
                }}
              >
                {presetLabelItem}
              </Button>
            ))}
          </div>
          <div className="p-3">
            <p
              className={cn(
                "text-sm font-medium mb-2",
                isDark ? "text-gray-300" : "text-muted-foreground",
              )}
            >
              Custom range
            </p>
            <Calendar
              mode="range"
              defaultMonth={internalRange.from}
              selected={
                calendarRange?.from != null
                  ? {
                      from: calendarRange.from,
                      to: calendarRange.to ?? calendarRange.from,
                    }
                  : { from: internalRange.from, to: internalRange.to }
              }
              onSelect={(range) => {
                setCalendarRange(
                  range
                    ? { from: range.from, to: range.to }
                    : undefined,
                );
                if (range?.from && range?.to) {
                  const next = { from: range.from, to: range.to };
                  setInternalRange(next);
                }
              }}
              numberOfMonths={1}
              disabled={(date) =>
                date > now || date < subDays(now, maxHistoryDays)
              }
              className={isDark ? "rounded-md border-0 bg-transparent" : ""}
            />
            <div
              className={cn(
                "space-y-3 border-t pt-3 mt-3",
                isDark ? "border-white/10" : "border-border",
              )}
            >
              <div className="space-y-2">
                <Label
                  className={cn(
                    "text-xs font-medium",
                    isDark ? "text-gray-400" : "text-muted-foreground",
                  )}
                >
                  Start
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={getDateStrInTz(internalRange.from, rangeTimezone)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      const timeStr = getTimeStrInTz(
                        internalRange.from,
                        rangeTimezone,
                      );
                      const newFrom = setTimeInTz(
                        internalRange.from,
                        v,
                        timeStr,
                        rangeTimezone,
                      );
                      if (newFrom) {
                        setInternalRange((prev) => ({ ...prev, from: newFrom }));
                        setCalendarRange((prev) =>
                          prev
                            ? { from: newFrom, to: prev.to ?? newFrom }
                            : { from: newFrom, to: internalRange.to },
                        );
                      }
                    }}
                    className={cn(
                      "h-9 text-sm",
                      isDark
                        ? "border-white/20 bg-white/5 text-white"
                        : "",
                    )}
                  />
                  <Input
                    type="text"
                    placeholder="02:30 PM"
                    value={
                      startTimeInput ??
                      getTimeStrInTz(internalRange.from, rangeTimezone)
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      setStartTimeInput(v || null);
                      const dateStr = getDateStrInTz(
                        internalRange.from,
                        rangeTimezone,
                      );
                      const newFrom = setTimeInTz(
                        internalRange.from,
                        dateStr,
                        v,
                        rangeTimezone,
                      );
                      if (newFrom) {
                        setInternalRange((prev) => ({ ...prev, from: newFrom }));
                        if (parseTime12To24(v)) setStartTimeInput(null);
                      }
                    }}
                    onBlur={() => setStartTimeInput(null)}
                    className={cn(
                      "h-9 text-sm w-[100px]",
                      isDark
                        ? "border-white/20 bg-white/5 text-white"
                        : "",
                    )}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label
                  className={cn(
                    "text-xs font-medium",
                    isDark ? "text-gray-400" : "text-muted-foreground",
                  )}
                >
                  End
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={getDateStrInTz(internalRange.to, rangeTimezone)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      const timeStr = getTimeStrInTz(
                        internalRange.to,
                        rangeTimezone,
                      );
                      const newTo = setTimeInTz(
                        internalRange.to,
                        v,
                        timeStr,
                        rangeTimezone,
                      );
                      if (newTo) {
                        setInternalRange((prev) => ({ ...prev, to: newTo }));
                        setCalendarRange((prev) =>
                          prev
                            ? { from: prev.from ?? internalRange.from, to: newTo }
                            : { from: internalRange.from, to: newTo },
                        );
                      }
                    }}
                    className={cn(
                      "h-9 text-sm",
                      isDark
                        ? "border-white/20 bg-white/5 text-white"
                        : "",
                    )}
                  />
                  <Input
                    type="text"
                    placeholder="03:29 PM"
                    value={
                      endTimeInput ??
                      getTimeStrInTz(internalRange.to, rangeTimezone)
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      setEndTimeInput(v || null);
                      const dateStr = getDateStrInTz(
                        internalRange.to,
                        rangeTimezone,
                      );
                      const newTo = setTimeInTz(
                        internalRange.to,
                        dateStr,
                        v,
                        rangeTimezone,
                      );
                      if (newTo) {
                        setInternalRange((prev) => ({ ...prev, to: newTo }));
                        if (parseTime12To24(v)) setEndTimeInput(null);
                      }
                    }}
                    onBlur={() => setEndTimeInput(null)}
                    className={cn(
                      "h-9 text-sm w-[100px]",
                      isDark
                        ? "border-white/20 bg-white/5 text-white"
                        : "",
                    )}
                  />
                </div>
              </div>
            </div>
            <div
              className={cn(
                "space-y-2 border-t pt-3 mt-3",
                isDark ? "border-white/10" : "border-border",
              )}
            >
              <Label
                className={cn(
                  "text-xs font-medium",
                  isDark ? "text-gray-400" : "text-muted-foreground",
                )}
              >
                Timezone
              </Label>
              <Select
                value={rangeTimezone}
                onValueChange={(v: "utc" | "local") => {
                  setRangeTimezone(v);
                  setStartTimeInput(null);
                  setEndTimeInput(null);
                }}
              >
                <SelectTrigger
                  className={cn(
                    "h-9 text-sm",
                    isDark ? "border-white/20 bg-white/5 text-white" : "",
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  className={isDark ? "border-white/20 bg-[#170337]" : ""}
                >
                  <SelectItem value="utc">UTC</SelectItem>
                  <SelectItem value="local">Local (Asia/Calcutta)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 p-2 border-t mt-3">
              <Button
                size="sm"
                type="button"
                className="w-full"
                onClick={() => {
                  const appliedLabel = `${format(internalRange.from, "MMM d, yyyy")} – ${format(internalRange.to, "MMM d, yyyy")}`;
                  onChange(internalRange, appliedLabel);
                  setOpen(false);
                  setCalendarRange(undefined);
                }}
              >
                <Check className="mr-1 h-4 w-4" />
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
