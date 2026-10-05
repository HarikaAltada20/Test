"use client";

import { Check, Copy, Eye, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  getPayoutIdentifier,
  type AdminPayoutMethodRow,
} from "@/lib/admin-payout-methods";
import { SKYDO_STATUSES, SKYDO_STATUS_LABELS } from "@/lib/skydo-payout";
import type { SkydoStatus } from "@/types/earnings";
import { METHOD_LABELS, copyText } from "./shared";

export function RowActions({
  row,
  isDark,
  onOpen,
  onSetStatus,
}: {
  row: AdminPayoutMethodRow;
  isDark: boolean;
  onOpen: () => void;
  onSetStatus: (status: SkydoStatus) => void;
}) {
  const identifier = getPayoutIdentifier(row.method_type, row.details, { maskBank: false });
  const isSkydo = row.method_type === "skydo";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Row actions"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "rounded-md p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC]",
            isDark ? "hover:bg-white/10" : "hover:bg-gray-100"
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn("w-56", isDark && "border-gray-700 bg-[#0B0629] text-white")}
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem onSelect={onOpen}>
          <Eye className="mr-2 h-4 w-4" />
          View details
        </DropdownMenuItem>
        {row.email && (
          <DropdownMenuItem onSelect={() => copyText(row.email!, "Account email")}>
            <Copy className="mr-2 h-4 w-4" />
            Copy account email
          </DropdownMenuItem>
        )}
        {identifier && (
          <DropdownMenuItem
            onSelect={() =>
              copyText(identifier, isSkydo ? "Skydo email" : `${METHOD_LABELS[row.method_type] ?? "Payout"} details`)
            }
          >
            <Copy className="mr-2 h-4 w-4" />
            {isSkydo ? "Copy Skydo email" : "Copy payout details"}
          </DropdownMenuItem>
        )}
        {isSkydo && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal opacity-70">
              Set Skydo status
            </DropdownMenuLabel>
            {SKYDO_STATUSES.map((s) => (
              <DropdownMenuItem
                key={s}
                disabled={row.skydo_status === s}
                onSelect={() => onSetStatus(s)}
              >
                <Check
                  className={cn("mr-2 h-4 w-4", row.skydo_status === s ? "opacity-100" : "opacity-0")}
                />
                {SKYDO_STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
