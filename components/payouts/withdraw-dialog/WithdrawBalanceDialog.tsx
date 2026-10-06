"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { AlertCircle, Check, Plus, Settings2, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { getSkydoStatus } from "@/lib/skydo-payout";
import {
  centsToAmountInput,
  sanitizeAmountInput,
  validateWithdrawAmount,
} from "@/lib/withdraw-amount";
import { SkydoStatusBadge } from "@/components/payouts/SkydoStatusBadge";
import { FormField } from "@/components/payouts/payout-method-dialog/FormField";
import {
  describeSavedMethod,
  getPayoutMethodMeta,
} from "@/components/payouts/payout-method-dialog/methodMeta";
import { payoutDialogTheme } from "@/components/payouts/payout-method-dialog/theme";
import type { PayoutMethod } from "@/types/earnings";

export interface WithdrawRequest {
  amountCents: number;
  payoutMethodId: string;
  notes: string;
}

export type WithdrawSubmitResult = { ok: true } | { ok: false; message: string };

export interface WithdrawBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDark: boolean;
  availableBalanceCents: number;
  minWithdrawalCents: number;
  payoutMethods: PayoutMethod[];
  /** Methods that can receive a withdrawal right now. */
  availableMethodIds: string[];
  pausedMethodTypes: string[];
  onManageMethods: () => void;
  /** Creates the request. Shows its own success toast; returns the error message on failure. */
  onSubmit: (request: WithdrawRequest) => Promise<WithdrawSubmitResult>;
}

const AMOUNT_ID = "withdrawAmount";
const NOTES_ID = "withdrawNotes";
const METHOD_LABEL_ID = "withdrawMethodLabel";
const METHOD_ERROR_ID = "withdrawMethodError";

export function WithdrawBalanceDialog({
  open,
  onOpenChange,
  isDark,
  availableBalanceCents,
  minWithdrawalCents,
  payoutMethods,
  availableMethodIds,
  pausedMethodTypes,
  onManageMethods,
  onSubmit,
}: WithdrawBalanceDialogProps) {
  const t = payoutDialogTheme(isDark);
  const minLabel = formatCurrencyFromCents(minWithdrawalCents);

  const [amount, setAmount] = useState("");
  const [methodId, setMethodId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const wasOpen = useRef(false);

  const sortedMethods = useMemo(
    () => [...payoutMethods].sort((a, b) => Number(!!b.is_default) - Number(!!a.is_default)),
    [payoutMethods]
  );
  const availableMethods = sortedMethods.filter((m) => availableMethodIds.includes(m.id));

  useEffect(() => {
    if (open && !wasOpen.current) {
      setAmount("");
      setNotes("");
      setAmountTouched(false);
      setSubmitted(false);
      setServerError(null);
      const preferred = availableMethods.find((m) => m.is_default) ?? availableMethods[0] ?? null;
      setMethodId(preferred?.id ?? null);
    }
    wasOpen.current = open;
    // Only react to the dialog opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (methodId && !availableMethodIds.includes(methodId)) setMethodId(null);
  }, [availableMethodIds, methodId]);

  useEffect(() => {
    setServerError(null);
  }, [amount, methodId, notes]);

  const amountCheck = validateWithdrawAmount(amount, {
    minCents: minWithdrawalCents,
    availableCents: availableBalanceCents,
    minLabel,
  });
  const amountError = amountTouched || submitted ? (amountCheck.error ?? undefined) : undefined;
  const methodError =
    submitted && !methodId && availableMethods.length > 0 ? "Choose where to send this withdrawal." : undefined;
  const selectedMethod = availableMethods.find((m) => m.id === methodId) ?? null;
  const canWithdraw = availableMethods.length > 0;
  const belowMinimum = availableBalanceCents < minWithdrawalCents;

  const requestClose = () => {
    if (submittingRef.current) return;
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    setSubmitted(true);
    if (amountCheck.cents === null) {
      document.getElementById(AMOUNT_ID)?.focus();
      return;
    }
    if (!methodId) {
      document.querySelector<HTMLElement>(`[aria-labelledby="${METHOD_LABEL_ID}"] [role="radio"]:not([disabled])`)?.focus();
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setServerError(null);
    try {
      const result = await onSubmit({ amountCents: amountCheck.cents, payoutMethodId: methodId, notes });
      if (result.ok) {
        submittingRef.current = false;
        onOpenChange(false);
      } else {
        setServerError(result.message);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const unavailableReason = (method: PayoutMethod) => {
    if (pausedMethodTypes.includes(method.method_type)) return "Paused for withdrawals";
    if (method.method_type === "skydo") return null;
    return "Not available for withdrawals right now";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
        else onOpenChange(true);
      }}
      isdark={isDark}
    >
      <DialogContent
        hideCloseButton
        onEscapeKeyDown={(e) => submittingRef.current && e.preventDefault()}
        onInteractOutside={(e) => submittingRef.current && e.preventDefault()}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          "h-[100dvh] max-h-[100dvh] w-full max-w-none rounded-none",
          "sm:h-auto sm:max-h-[min(90vh,720px)] sm:w-[calc(100vw-2rem)] sm:max-w-[480px] sm:rounded-xl",
          t.border
        )}
      >
        {/* Header */}
        <div className={cn("flex shrink-0 items-start gap-3 border-b px-4 py-4 sm:px-6", t.border)}>
          <div className="min-w-0 flex-1 space-y-1">
            <DialogTitle className={cn("text-lg font-semibold leading-tight", t.text)}>
              Withdraw balance
            </DialogTitle>
            <DialogDescription className={cn("text-sm", t.muted)}>
              Choose an amount and where to send it.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={submitting}
              aria-label="Close"
              className={cn("-mr-2 h-11 w-11 shrink-0 sm:h-9 sm:w-9", t.ghostButton)}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          <form
            id="withdraw-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
            className="space-y-6"
          >
            {/* Balance */}
            <div className={cn("rounded-lg border px-4 py-3", t.border, t.subtle)}>
              <p className={cn("text-xs font-medium uppercase tracking-wide", t.muted)}>
                Available to withdraw
              </p>
              <p className={cn("mt-1 text-2xl font-semibold tabular-nums", t.text)}>
                {formatCurrencyFromCents(availableBalanceCents)}
              </p>
              <p className={cn("mt-0.5 text-xs", t.muted)}>Minimum {minLabel}</p>
            </div>

            {/* Amount */}
            <FormField
              id={AMOUNT_ID}
              label="Amount (USD)"
              isDark={isDark}
              error={amountError}
              helper={belowMinimum ? `You need at least ${minLabel} to withdraw.` : undefined}
            >
              {(control) => (
                <div className="relative">
                  <span
                    aria-hidden
                    className={cn("pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base", t.muted)}
                  >
                    $
                  </span>
                  <Input
                    id={control.id}
                    aria-invalid={control["aria-invalid"]}
                    aria-describedby={control["aria-describedby"]}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
                    onBlur={() => setAmountTouched(true)}
                    disabled={submitting}
                    className={cn(t.input, "pl-7 pr-20 text-base tabular-nums", control.errorClassName)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAmount(centsToAmountInput(availableBalanceCents));
                      setAmountTouched(true);
                    }}
                    disabled={submitting || availableBalanceCents <= 0}
                    className={cn(
                      "absolute right-1 top-1/2 h-9 -translate-y-1/2 px-3 font-semibold",
                      isDark ? "text-[#C9A7FF] hover:bg-white/10" : "text-[#4A00BE] hover:bg-[#7F39EC]/10"
                    )}
                  >
                    Max
                  </Button>
                </div>
              )}
            </FormField>

            {/* Method */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p id={METHOD_LABEL_ID} className={cn("text-sm font-medium", t.text)}>
                  Send to
                </p>
                {payoutMethods.length > 0 && (
                  <Button
                    type="button"
                    variant="link"
                    onClick={onManageMethods}
                    disabled={submitting}
                    className={cn(
                      "h-auto min-h-[44px] gap-1 p-0 text-sm hover:underline sm:min-h-0",
                      isDark ? "text-[#C9A7FF]" : "text-[#4A00BE]"
                    )}
                  >
                    <Settings2 className="h-3.5 w-3.5" aria-hidden />
                    Manage payout methods
                  </Button>
                )}
              </div>

              {payoutMethods.length === 0 ? (
                <div className={cn("rounded-lg border border-dashed px-4 py-6 text-center", t.border)}>
                  <p className={cn("text-sm", t.text)}>Add a payout method to withdraw.</p>
                  <Button type="button" onClick={onManageMethods} className="mt-3 h-11 gap-1.5 sm:h-10">
                    <Plus className="h-4 w-4" aria-hidden />
                    Add payout method
                  </Button>
                </div>
              ) : (
                <>
                  <RadioGroupPrimitive.Root
                    value={methodId ?? ""}
                    onValueChange={setMethodId}
                    disabled={submitting}
                    aria-labelledby={METHOD_LABEL_ID}
                    aria-describedby={methodError ? METHOD_ERROR_ID : undefined}
                    className="space-y-2"
                  >
                    {sortedMethods.map((method) => {
                      const meta = getPayoutMethodMeta(method.method_type);
                      const Icon = meta.icon;
                      const { title, detail } = describeSavedMethod(method);
                      const available = availableMethodIds.includes(method.id);
                      const selected = method.id === methodId;
                      const reason = available ? null : unavailableReason(method);
                      return (
                        <RadioGroupPrimitive.Item
                          key={method.id}
                          value={method.id}
                          disabled={!available}
                          className={cn(
                            "flex min-h-[60px] w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] focus-visible:ring-offset-2",
                            isDark ? "focus-visible:ring-offset-[#06021D]" : "focus-visible:ring-offset-white",
                            "disabled:cursor-not-allowed",
                            !available && "opacity-70",
                            selected
                              ? isDark
                                ? "border-[#9B6BF2] bg-[#7F39EC]/15"
                                : "border-[#7F39EC] bg-[#7F39EC]/5"
                              : isDark
                                ? "border-gray-700 enabled:hover:border-gray-500 enabled:hover:bg-white/5"
                                : "border-gray-200 enabled:hover:border-gray-300 enabled:hover:bg-gray-50"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                              selected
                                ? isDark
                                  ? "bg-[#7F39EC]/30 text-[#C9A7FF]"
                                  : "bg-[#7F39EC]/10 text-[#7F39EC]"
                                : cn(t.subtle, t.muted)
                            )}
                          >
                            <Icon className="h-4 w-4" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className={cn("truncate text-sm font-semibold", t.text)}>{title}</span>
                              {method.is_default && (
                                <span
                                  className={cn(
                                    "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                    isDark ? "bg-[#7F39EC]/25 text-[#E4D4FF]" : "bg-[#7F39EC]/10 text-[#4A00BE]"
                                  )}
                                >
                                  Default
                                </span>
                              )}
                            </span>
                            <span className={cn("block truncate text-xs", t.muted)}>
                              {meta.label}
                              {detail ? ` · ${detail}` : ""}
                            </span>
                            {!available && (
                              <span className="mt-1 block">
                                {reason ? (
                                  <span
                                    className={cn(
                                      "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                      isDark ? "bg-amber-950/60 text-amber-200" : "bg-amber-100 text-amber-900"
                                    )}
                                  >
                                    {reason}
                                  </span>
                                ) : (
                                  <SkydoStatusBadge status={getSkydoStatus(method)} />
                                )}
                              </span>
                            )}
                          </span>
                          <span
                            aria-hidden
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                              selected
                                ? "border-[#7F39EC] bg-[#7F39EC] text-white"
                                : isDark
                                  ? "border-gray-600"
                                  : "border-gray-300"
                            )}
                          >
                            {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                          </span>
                        </RadioGroupPrimitive.Item>
                      );
                    })}
                  </RadioGroupPrimitive.Root>
                  {!canWithdraw && (
                    <p className={cn("text-sm", t.muted)}>
                      None of your payout methods can receive withdrawals right now. Try again later or add
                      another method.
                    </p>
                  )}
                  {methodError && (
                    <p id={METHOD_ERROR_ID} role="alert" className={cn("flex items-start gap-1.5 text-sm", t.error)}>
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      {methodError}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Notes */}
            <FormField id={NOTES_ID} label="Notes" optional isDark={isDark}>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything we should know about this withdrawal?"
                disabled={submitting}
                rows={2}
                className={cn(
                  "min-h-[72px] resize-none",
                  isDark
                    ? "border-gray-600 bg-[#06021D] text-white placeholder:text-gray-500"
                    : "border-gray-300 bg-white text-gray-900"
                )}
              />
            </FormField>

            {/* Summary. TODO: no fee or timing config exists, so none is shown. */}
            {amountCheck.cents !== null && selectedMethod && (
              <div
                aria-live="polite"
                className={cn("rounded-lg border px-4 py-3 text-sm", t.border, t.subtle, t.text)}
              >
                You&apos;ll request{" "}
                <span className="font-semibold tabular-nums">{formatCurrencyFromCents(amountCheck.cents)}</span> to{" "}
                <span className="font-semibold">{describeSavedMethod(selectedMethod).title}</span>.
              </div>
            )}

            {serverError && (
              <Alert
                variant="destructive"
                className={cn(
                  "border-red-500/60 [&>svg]:text-current",
                  isDark ? "bg-red-950/40 text-red-200" : "bg-red-50 text-red-800"
                )}
              >
                <AlertCircle className="h-4 w-4" aria-hidden />
                <AlertDescription>
                  <span className="font-medium">Withdrawal request failed.</span> {serverError}
                </AlertDescription>
              </Alert>
            )}
          </form>
        </div>

        {/* Footer */}
        <div
          className={cn(
            "flex shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6",
            "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
            t.border,
            t.surface
          )}
        >
          <Button
            type="button"
            variant="outline"
            onClick={requestClose}
            disabled={submitting}
            className={cn("h-11 sm:h-10", t.outlineButton)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="withdraw-form"
            loading={submitting}
            loadingText="Processing..."
            disabled={submitting || !canWithdraw}
            className="h-11 sm:h-10 sm:min-w-[180px]"
          >
            Request withdrawal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
