"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ContestSearchOption = {
  id: string;
  title: string;
  start_date: string | null;
};

type Props = {
  value: ContestSearchOption | null;
  onChange: (contest: ContestSearchOption | null) => void;
  isDark?: boolean;
  label?: string;
  optionalHint?: string;
  className?: string;
};

export function ContestSearchSelect({
  value,
  onChange,
  isDark = false,
  label = "Contest (optional)",
  optionalHint = "Link this announcement to a contest to use {contest_title} and open the contest when tapped.",
  className,
}: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [contests, setContests] = useState<ContestSearchOption[]>([]);
  const [searching, setSearching] = useState(false);

  const searchContests = useCallback(async (query: string) => {
    if (!query.trim()) {
      setContests([]);
      return;
    }
    try {
      setSearching(true);
      const res = await fetch(
        `/api/admin/affiliate/contests/search?q=${encodeURIComponent(query.trim())}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Search failed");
      setContests(json.contests ?? []);
    } catch {
      setContests([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (value) return;
    const timeoutId = setTimeout(() => {
      searchContests(search);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [search, value, searchContests]);

  const handleSelect = (contest: ContestSearchOption) => {
    onChange(contest);
    setSearch("");
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setSearch("");
    setOpen(false);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleClear}
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>
      <div className="relative">
        <Input
          placeholder="Search contest by title or ID..."
          value={value ? value.title : search}
          onChange={(e) => {
            const next = e.target.value;
            setSearch(next);
            if (value) onChange(null);
            setOpen(!!next.trim());
          }}
          onFocus={() => {
            if (!value && search.trim()) setOpen(true);
          }}
          className={cn(
            isDark && "bg-slate-900 border-slate-700 text-white",
          )}
        />
        {open && !value && search.trim() && (
          <div
            className={cn(
              "absolute z-50 w-full mt-1 border rounded-md shadow-md max-h-[240px] overflow-y-auto",
              isDark
                ? "bg-slate-900 border-slate-700"
                : "bg-popover border-border",
            )}
          >
            <Command shouldFilter={false}>
              <CommandList>
                <CommandEmpty>
                  {searching ? "Searching..." : "No contests found."}
                </CommandEmpty>
                <CommandGroup>
                  {contests.map((contest) => (
                    <CommandItem
                      key={contest.id}
                      value={`${contest.id} ${contest.title}`}
                      onSelect={() => handleSelect(contest)}
                    >
                      <Check className="mr-2 h-4 w-4 shrink-0 opacity-0" />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-medium truncate">
                          {contest.title}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {contest.id}
                          {contest.start_date
                            ? ` · ${new Date(contest.start_date).toLocaleDateString()}`
                            : ""}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        )}
      </div>
      {value ? (
        <p className="text-xs text-muted-foreground">
          Selected: <span className="font-medium">{value.title}</span>
        </p>
      ) : (
        optionalHint && (
          <p className="text-xs text-muted-foreground">{optionalHint}</p>
        )
      )}
    </div>
  );
}
