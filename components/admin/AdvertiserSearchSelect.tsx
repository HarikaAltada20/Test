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
import { formatCurrencyFromCents } from "@/lib/currency-utils";

export type AdvertiserSearchOption = {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  available_deposit_balance: number;
};

type Props = {
  value: AdvertiserSearchOption | null;
  onChange: (advertiser: AdvertiserSearchOption | null) => void;
  isDark?: boolean;
  label?: string;
  className?: string;
};

export function AdvertiserSearchSelect({
  value,
  onChange,
  isDark = false,
  label = "Brand",
  className,
}: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [advertisers, setAdvertisers] = useState<AdvertiserSearchOption[]>([]);
  const [searching, setSearching] = useState(false);

  const searchAdvertisers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setAdvertisers([]);
      return;
    }
    try {
      setSearching(true);
      const res = await fetch(
        `/api/admin/search-advertisers?q=${encodeURIComponent(query.trim())}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Search failed");
      setAdvertisers(json.advertisers ?? []);
    } catch {
      setAdvertisers([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (value) return;
    const timeoutId = setTimeout(() => {
      searchAdvertisers(search);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [search, value, searchAdvertisers]);

  const handleSelect = (advertiser: AdvertiserSearchOption) => {
    onChange(advertiser);
    setSearch("");
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setSearch("");
    setOpen(false);
  };

  const displayLabel = (advertiser: AdvertiserSearchOption) =>
    advertiser.company_name ||
    advertiser.full_name ||
    advertiser.email ||
    advertiser.id;

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
          placeholder="Search by company, email, or name..."
          value={value ? displayLabel(value) : search}
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
            "h-11 rounded-xl border-purple-200/80 shadow-sm focus-visible:ring-[#7F39EC]/30",
            isDark && "bg-slate-900 border-slate-700 text-white",
          )}
        />
        {open && !value && search.trim() && (
          <div
            className={cn(
              "absolute z-50 w-full mt-2 border rounded-xl shadow-lg max-h-[260px] overflow-y-auto",
              isDark
                ? "bg-slate-900 border-slate-700"
                : "bg-white border-purple-100",
            )}
          >
            <Command shouldFilter={false}>
              <CommandList>
                <CommandEmpty>
                  {searching ? "Searching..." : "No brands found."}
                </CommandEmpty>
                <CommandGroup>
                  {advertisers.map((advertiser) => (
                    <CommandItem
                      key={advertiser.id}
                      value={`${advertiser.id} ${displayLabel(advertiser)}`}
                      onSelect={() => handleSelect(advertiser)}
                      className="cursor-pointer rounded-lg mx-1 my-0.5 aria-selected:bg-[#7F39EC]/10"
                    >
                      <Check className="mr-2 h-4 w-4 shrink-0 opacity-0" />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-medium truncate">
                          {displayLabel(advertiser)}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {advertiser.email}
                          {" · "}
                          Wallet:{" "}
                          {formatCurrencyFromCents(
                            advertiser.available_deposit_balance,
                          )}
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
      {value && (
        <p className="text-xs text-muted-foreground">
          Selected:{" "}
          <span className="font-medium">{displayLabel(value)}</span>
          {" · "}
          Wallet:{" "}
          {formatCurrencyFromCents(value.available_deposit_balance)}
        </p>
      )}
    </div>
  );
}
