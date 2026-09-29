"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0"),
);
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
);

function parseTime(value: string): { hour: string; minute: string } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return { hour: "09", minute: "00" };
  const hour = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const minute = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  return {
    hour: String(hour).padStart(2, "0"),
    minute: String(minute).padStart(2, "0"),
  };
}

function formatTime(hour: string, minute: string) {
  return `${hour}:${minute}`;
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

function TimeColumn({
  items,
  selected,
  onSelect,
  listRef,
  selectedRef,
}: {
  items: string[];
  selected: string;
  onSelect: (item: string) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
  selectedRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div
      ref={listRef}
      className="h-[220px] w-[72px] overflow-y-auto overscroll-contain border-r border-gray-100 last:border-r-0"
    >
      {items.map((item) => {
        const isSelected = item === selected;
        return (
          <button
            key={item}
            ref={isSelected ? selectedRef : undefined}
            type="button"
            onClick={() => onSelect(item)}
            className={cn(
              "w-full px-3 py-2 text-center text-sm transition-colors",
              isSelected
                ? "bg-sky-200 text-gray-900 font-medium border-y border-white shadow-sm"
                : "text-gray-700 hover:bg-gray-50",
            )}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

export function ScheduleTimePicker({
  value,
  onChange,
  disabled = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const { hour, minute } = parseTime(value);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);
  const hourSelectedRef = useRef<HTMLButtonElement>(null);
  const minuteSelectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const scrollToSelected = (
      listRef: React.RefObject<HTMLDivElement | null>,
      selectedRef: React.RefObject<HTMLButtonElement | null>,
    ) => {
      const list = listRef.current;
      const selectedEl = selectedRef.current;
      if (!list || !selectedEl) return;
      const offset =
        selectedEl.offsetTop -
        list.clientHeight / 2 +
        selectedEl.clientHeight / 2;
      list.scrollTop = Math.max(0, offset);
    };
    requestAnimationFrame(() => {
      scrollToSelected(hourListRef, hourSelectedRef);
      scrollToSelected(minuteListRef, minuteSelectedRef);
    });
  }, [open, hour, minute]);

  const selectHour = (nextHour: string) => {
    onChange(formatTime(nextHour, minute));
  };

  const selectMinute = (nextMinute: string) => {
    onChange(formatTime(hour, nextMinute));
  };

  const handleInputChange = (raw: string) => {
    if (/^\d{0,2}:?\d{0,2}$/.test(raw) || raw === "") {
      onChange(raw);
    }
  };

  const handleInputBlur = () => {
    const parsed = parseTime(value);
    onChange(formatTime(parsed.hour, parsed.minute));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={handleInputBlur}
          onClick={() => !disabled && setOpen(true)}
          onFocus={() => !disabled && setOpen(true)}
          disabled={disabled}
          placeholder="HH:MM"
          className={cn(
            "bg-white border-gray-300 cursor-pointer",
            open && "border-[#662EBD] ring-1 ring-[#662EBD]",
            className,
          )}
        />
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-auto p-0 bg-white border border-gray-200 shadow-lg rounded-lg overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex">
          <TimeColumn
            items={HOURS}
            selected={hour}
            onSelect={selectHour}
            listRef={hourListRef}
            selectedRef={hourSelectedRef}
          />
          <TimeColumn
            items={MINUTES}
            selected={minute}
            onSelect={selectMinute}
            listRef={minuteListRef}
            selectedRef={minuteSelectedRef}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
