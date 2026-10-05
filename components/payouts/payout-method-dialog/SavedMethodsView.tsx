"use client";

import { useState } from "react";
import { Loader2, Pencil, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { canRemoveSkydo, getSkydoStatus } from "@/lib/skydo-payout";
import { SkydoStatusBadge } from "@/components/payouts/SkydoStatusBadge";
import type { PayoutMethod } from "@/types/earnings";
import { describeSavedMethod, getPayoutMethodMeta } from "./methodMeta";
import { payoutDialogTheme } from "./theme";

export function SavedMethodsView({
  methods,
  isDark,
  busyId,
  pausedMethodTypes,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  methods: PayoutMethod[];
  isDark: boolean;
  /** Id of the method with an action in flight. */
  busyId: string | null;
  pausedMethodTypes: string[];
  onEdit: (method: PayoutMethod) => void;
  onDelete: (method: PayoutMethod) => void;
  onSetDefault: (method: PayoutMethod) => void;
}) {
  const t = payoutDialogTheme(isDark);
  const [pendingDelete, setPendingDelete] = useState<PayoutMethod | null>(null);
  const anyBusy = busyId !== null;

  return (
    <>
      <ul className="space-y-2">
        {methods.map((method) => {
          const meta = getPayoutMethodMeta(method.method_type);
          const Icon = meta.icon;
          const { title, detail } = describeSavedMethod(method);
          const isSkydo = method.method_type === "skydo";
          const removable = !isSkydo || canRemoveSkydo(method);
          const busy = busyId === method.id;
          return (
            <li
              key={method.id}
              className={cn(
                "flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center",
                method.is_default
                  ? isDark
                    ? "border-[#9B6BF2]/70 bg-[#7F39EC]/10"
                    : "border-[#7F39EC]/50 bg-[#7F39EC]/5"
                  : t.border
              )}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    isDark ? "bg-white/10 text-[#C9A7FF]" : "bg-[#7F39EC]/10 text-[#4A00BE]"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn("truncate text-sm font-semibold", t.text)}>{title}</span>
                    <span className={cn("text-xs", t.muted)}>{meta.label}</span>
                    {method.is_default && (
                      <span className="rounded-full bg-[#7F39EC] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Default
                      </span>
                    )}
                    {isSkydo && !removable && (
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          isDark ? "border-gray-600 text-gray-300" : "border-gray-300 text-gray-600"
                        )}
                      >
                        Permanent
                      </span>
                    )}
                    {pausedMethodTypes.includes(method.method_type) && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          isDark ? "bg-amber-950/60 text-amber-200" : "bg-amber-100 text-amber-900"
                        )}
                      >
                        Paused
                      </span>
                    )}
                  </div>
                  <p className={cn("break-all text-sm", t.muted)}>{detail}</p>
                  {isSkydo && <SkydoStatusBadge status={getSkydoStatus(method)} size="sm" showDescription />}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
                {busy && <Loader2 className={cn("mr-1 h-4 w-4 animate-spin", t.muted)} aria-label="Working" />}
                {!method.is_default && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onSetDefault(method)}
                    disabled={anyBusy}
                    className={cn("h-9 gap-1.5", t.ghostButton)}
                  >
                    <Star className="h-4 w-4" aria-hidden />
                    Set default
                  </Button>
                )}
                {!isSkydo && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => onEdit(method)}
                    disabled={anyBusy}
                    aria-label={`Edit ${title}`}
                    className={cn("h-9 w-9", t.ghostButton)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {removable && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setPendingDelete(method)}
                    disabled={anyBusy}
                    aria-label={isSkydo ? "Remove Skydo email" : `Delete ${title}`}
                    className={cn("h-9 w-9", isDark ? "text-red-400 hover:bg-red-950/40" : "text-red-600 hover:bg-red-50")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <DeletePayoutMethodDialog
        method={pendingDelete}
        isDark={isDark}
        onCancel={() => setPendingDelete(null)}
        onConfirm={(method) => {
          setPendingDelete(null);
          onDelete(method);
        }}
      />
    </>
  );
}

/** Confirmation before deleting a saved method; Skydo gets its own wording. */
export function DeletePayoutMethodDialog({
  method,
  isDark,
  onCancel,
  onConfirm,
}: {
  method: PayoutMethod | null;
  isDark: boolean;
  onCancel: () => void;
  onConfirm: (method: PayoutMethod) => void;
}) {
  const isSkydo = method?.method_type === "skydo";
  const summary = method ? describeSavedMethod(method) : null;

  return (
    <AlertDialog open={method !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className={cn(isDark && "border-gray-700 bg-[#0B0629] text-white")}>
        <AlertDialogHeader>
          <AlertDialogTitle>{isSkydo ? "Remove this Skydo email?" : "Delete this payout method?"}</AlertDialogTitle>
          <AlertDialogDescription className={cn(isDark && "text-gray-400")}>
            {summary
              ? isSkydo
                ? `${summary.detail} will be removed, and you can add a different Skydo email right after.`
                : `${summary.title} (${summary.detail}) will be removed. You can add it again later.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className={cn(isDark && "border-gray-700 bg-transparent text-white hover:bg-white/10")}>
            Keep it
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={() => method && onConfirm(method)}
          >
            {isSkydo ? "Remove email" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
