"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { SKYDO_MIN_BALANCE_CENTS, canRemoveSkydo } from "@/lib/skydo-payout";
import {
  PAYOUT_TYPES_BY_COUNTRY,
  type PayoutCountry,
  type PayoutMethodDraft,
} from "@/lib/payout-method-validation";
import {
  SKYDO_CONVERSION_NOTE,
  formatFeePercent,
  formatUsdInrRate,
  payoutCurrencyFor,
  type PayoutFeeSettings,
} from "@/lib/payout-fees";
import { SkydoPayoutForm } from "@/components/payouts/SkydoPayoutForm";
import { ProcessingFeeInfo } from "@/components/payouts/ProcessingFeeInfo";
import type { PayoutMethod } from "@/types/earnings";
import { MethodPicker, type MethodPickerOption } from "./MethodPicker";
import { BankFields, CryptoFields, UpiFields } from "./MethodFields";
import { DeletePayoutMethodDialog, SavedMethodsView } from "./SavedMethodsView";
import { getPayoutMethodMeta } from "./methodMeta";
import { payoutDialogTheme } from "./theme";
import { usePayoutMethodForm } from "./usePayoutMethodForm";

export type PayoutSaveResult = { ok: true } | { ok: false; message: string };

export interface PayoutMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "list" falls back to the form when the user has no saved methods. */
  initialView: "list" | "add";
  isDark: boolean;
  payoutMethods: PayoutMethod[];
  withdrawableBalanceCents: number;
  pausedMethodTypes: string[];
  feeSettings: PayoutFeeSettings;
  /** Persists the method (the page adds user_id). Shows its own success toast. */
  onSave: (draft: PayoutMethodDraft) => Promise<PayoutSaveResult>;
  onDelete: (method: PayoutMethod) => Promise<boolean>;
  onSetDefault: (method: PayoutMethod) => Promise<boolean>;
}

const METHOD_NAMES_IN_SENTENCE: Record<string, string> = {
  upi: "UPI",
  bank_transfer: "bank transfer",
  crypto: "crypto",
  skydo: "Skydo",
};

/** Lists only the methods that are switched on, e.g. "Available in India: UPI, crypto and Skydo." */
function countryHelper(country: PayoutCountry, pausedMethodTypes: string[]): string {
  const names = PAYOUT_TYPES_BY_COUNTRY[country]
    .filter((type) => !pausedMethodTypes.includes(type))
    .map((type) => METHOD_NAMES_IN_SENTENCE[type] ?? type);
  if (names.length === 0) return "Payouts are paused for now. Please check back soon.";
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return country === "IN"
    ? `Available in India: ${list}.`
    : `Outside India, payouts are available in ${list} only.`;
}

export function PayoutMethodDialog({
  open,
  onOpenChange,
  initialView,
  isDark,
  payoutMethods,
  withdrawableBalanceCents,
  pausedMethodTypes,
  feeSettings,
  onSave,
  onDelete,
  onSetDefault,
}: PayoutMethodDialogProps) {
  const t = payoutDialogTheme(isDark);
  const existingSkydo = payoutMethods.find((m) => m.method_type === "skydo") ?? null;
  const skydoEligible = withdrawableBalanceCents >= SKYDO_MIN_BALANCE_CENTS;
  const minLabel = formatCurrencyFromCents(SKYDO_MIN_BALANCE_CENTS);

  const form = usePayoutMethodForm({
    isEditing: false,
    hasExistingSkydo: !!existingSkydo,
    skydoEligible,
    skydoMinBalanceLabel: minLabel,
  });

  const [view, setView] = useState<"list" | "form">("form");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingSkydoRemoval, setPendingSkydoRemoval] = useState<PayoutMethod | null>(null);
  const wasOpen = useRef(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      form.reset();
      setServerError(null);
      setView(initialView === "list" && payoutMethods.length > 0 ? "list" : "form");
    }
    wasOpen.current = open;
    // Only react to the dialog opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setServerError(null);
  }, [form.values, form.type, form.country]);

  const isEditing = !!form.editingMethod;
  const isSkydo = form.type === "skydo";
  const skydoBlocked = isSkydo && !isEditing && (!!existingSkydo || !skydoEligible);
  const hasSavedMethods = payoutMethods.length > 0;

  const pickerOptions: MethodPickerOption[] = useMemo(
    () =>
      PAYOUT_TYPES_BY_COUNTRY[form.country].map((type) => {
        const paused = pausedMethodTypes.includes(type);
        const feeBps = feeSettings.feeBpsByMethod[type] ?? 0;
        const option: MethodPickerOption = {
          type,
          paused,
          feeLabel: paused ? undefined : feeBps > 0 ? `${formatFeePercent(feeBps)} fee` : "No fee",
        };
        if (type === "skydo") {
          if (existingSkydo) option.descriptor = "Already added";
          else if (!skydoEligible) {
            option.descriptor = `Unlocks at ${minLabel}`;
            option.locked = true;
          }
        }
        return option;
      }),
    [existingSkydo, feeSettings.feeBpsByMethod, form.country, minLabel, pausedMethodTypes, skydoEligible]
  );

  const requestClose = () => {
    if (submittingRef.current) return;
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (submittingRef.current || skydoBlocked) return;
    const draft = form.prepareSubmit();
    if (!draft) return;
    submittingRef.current = true;
    setSubmitting(true);
    setServerError(null);
    try {
      const result = await onSave(draft);
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

  const runRowAction = async (method: PayoutMethod, action: (m: PayoutMethod) => Promise<boolean>) => {
    setBusyId(method.id);
    try {
      await action(method);
    } finally {
      setBusyId(null);
    }
  };

  const openAddForm = () => {
    form.reset();
    setServerError(null);
    setView("form");
  };

  const openEditForm = (method: PayoutMethod) => {
    form.loadForEdit(method);
    setServerError(null);
    setView("form");
  };

  const backToList = () => {
    if (submitting) return;
    form.reset();
    setServerError(null);
    setView("list");
  };

  const title =
    view === "list" ? "Payout methods" : isEditing ? "Edit payout method" : "Add payout method";
  const description =
    view === "list"
      ? "Your default method is pre-selected when you withdraw."
      : isEditing
        ? "Update the details for this payout method."
        : "Choose where we send your withdrawals.";

  const primaryLabel = isEditing ? "Save changes" : "Add payout method";
  const primaryDisabled =
    submitting || skydoBlocked || (isSkydo && !isEditing && !form.values.skydoConfirmed);
  const formLevelError = serverError ?? form.formError;
  const editingMeta = form.editingMethod ? getPayoutMethodMeta(form.editingMethod.method_type) : null;

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
          "sm:h-auto sm:max-h-[min(90vh,760px)] sm:w-[calc(100vw-2rem)] sm:max-w-[600px] sm:rounded-xl",
          isDark ? "border-gray-800" : "border-gray-200"
        )}
      >
        {/* Header */}
        <div className={cn("flex shrink-0 items-start gap-3 border-b px-4 py-4 sm:px-6", t.border)}>
          {view === "form" && hasSavedMethods && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={backToList}
              disabled={submitting}
              aria-label="Back to your payout methods"
              className={cn("-ml-2 h-11 w-11 shrink-0 sm:h-9 sm:w-9", t.ghostButton)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <DialogTitle className={cn("text-lg font-semibold leading-tight", t.text)}>{title}</DialogTitle>
            <DialogDescription className={cn("text-sm", t.muted)}>{description}</DialogDescription>
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
        <div
          key={view}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
        >
          {view === "list" ? (
            <SavedMethodsView
              methods={payoutMethods}
              isDark={isDark}
              busyId={busyId}
              pausedMethodTypes={pausedMethodTypes}
              feeBpsByMethod={feeSettings.feeBpsByMethod}
              onEdit={openEditForm}
              onDelete={(m) => void runRowAction(m, onDelete)}
              onSetDefault={(m) => void runRowAction(m, onSetDefault)}
            />
          ) : (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
              id="payout-method-form"
              className="space-y-6"
            >
              {isEditing && editingMeta ? (
                <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm", t.border, t.subtle)}>
                  <editingMeta.icon className={cn("h-4 w-4", t.muted)} aria-hidden />
                  <span className={cn("font-medium", t.text)}>{editingMeta.label}</span>
                  <span className={t.muted}>· The method type can&apos;t be changed.</span>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="payoutCountry" className={cn("text-sm font-medium", t.text)}>
                      Country
                    </Label>
                    <Select
                      value={form.country}
                      onValueChange={(v) => form.setCountry(v as PayoutCountry)}
                      disabled={submitting}
                    >
                      <SelectTrigger
                        id="payoutCountry"
                        aria-describedby="payoutCountry-helper"
                        isDark={isDark}
                        className={cn("h-11", !isDark && "border-gray-300")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent isDark={isDark}>
                        <SelectItem isDark={isDark} value="IN">
                          India
                        </SelectItem>
                        <SelectItem isDark={isDark} value="OTHER">
                          Other countries
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p id="payoutCountry-helper" className={cn("text-xs", t.muted)}>
                      {countryHelper(form.country, pausedMethodTypes)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p id="payoutMethodLabel" className={cn("text-sm font-medium", t.text)}>
                      Payout method
                    </p>
                    <MethodPicker
                      options={pickerOptions}
                      value={form.type}
                      onChange={form.selectType}
                      isDark={isDark}
                      disabled={submitting}
                      labelledBy="payoutMethodLabel"
                    />
                    {!pausedMethodTypes.includes(form.type) && (
                      <MethodFeeLine
                        methodType={form.type}
                        feeBps={feeSettings.feeBpsByMethod[form.type] ?? 0}
                        usdInrRate={feeSettings.usdInrRate}
                        isDark={isDark}
                      />
                    )}
                  </div>
                </>
              )}

              <section aria-label={`${getPayoutMethodMeta(form.type).label} details`}>
                {form.type === "upi" && (
                  <UpiFields
                    form={form}
                    isDark={isDark}
                    disabled={submitting}
                    upiEnabled={!pausedMethodTypes.includes("upi")}
                    usdInrRate={feeSettings.usdInrRate}
                  />
                )}
                {form.type === "bank_transfer" && (
                  <BankFields form={form} isDark={isDark} disabled={submitting} />
                )}
                {form.type === "crypto" && <CryptoFields form={form} isDark={isDark} disabled={submitting} />}
                {form.type === "skydo" && (
                  <SkydoPayoutForm
                    isDark={isDark}
                    isLoading={submitting}
                    email={form.values.skydoEmail}
                    onEmailChange={(v) => form.setField("skydoEmail", v)}
                    onEmailBlur={() => form.markTouched("skydoEmail")}
                    emailError={form.errors.skydoEmail}
                    confirmed={form.values.skydoConfirmed}
                    onConfirmedChange={(v) => {
                      form.setField("skydoConfirmed", v);
                      form.markTouched("skydoConfirmed");
                    }}
                    confirmError={form.errors.skydoConfirmed}
                    balanceCents={withdrawableBalanceCents}
                    existingEmail={existingSkydo?.details?.email ?? null}
                    existingStatus={existingSkydo?.skydo_status ?? null}
                    onRemoveExisting={
                      existingSkydo && canRemoveSkydo(existingSkydo)
                        ? () => setPendingSkydoRemoval(existingSkydo)
                        : undefined
                    }
                    removingExisting={!!existingSkydo && busyId === existingSkydo.id}
                  />
                )}
              </section>

              {formLevelError && !skydoBlocked && (
                <Alert
                  variant="destructive"
                  className={cn(
                    "border-red-500/60 [&>svg]:text-current",
                    isDark ? "bg-red-950/40 text-red-200" : "bg-red-50 text-red-800"
                  )}
                >
                  <AlertCircle className="h-4 w-4" aria-hidden />
                  <AlertDescription>
                    <span className="font-medium">Couldn&apos;t save this payout method.</span>{" "}
                    {formLevelError}
                  </AlertDescription>
                </Alert>
              )}
            </form>
          )}
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
          {view === "list" ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={requestClose}
                className={cn("h-11 sm:h-10", t.ghostButton)}
              >
                Close
              </Button>
              <Button type="button" onClick={openAddForm} className="h-11 gap-1.5 sm:h-10">
                <Plus className="h-4 w-4" aria-hidden />
                Add payout method
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={requestClose}
                disabled={submitting}
                className={cn("h-11 sm:h-10", t.ghostButton)}
              >
                {isSkydo && !!existingSkydo && !isEditing ? "Close" : "Cancel"}
              </Button>
              {!(isSkydo && !!existingSkydo && !isEditing) && (
                <Button
                  type="submit"
                  form="payout-method-form"
                  loading={submitting}
                  loadingText="Saving..."
                  disabled={primaryDisabled}
                  className="h-11 sm:h-10 sm:min-w-[180px]"
                >
                  {isSkydo && !skydoEligible && !isEditing ? `Unlocks at ${minLabel}` : primaryLabel}
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
      <DeletePayoutMethodDialog
        method={pendingSkydoRemoval}
        isDark={isDark}
        onCancel={() => setPendingSkydoRemoval(null)}
        onConfirm={(method) => {
          setPendingSkydoRemoval(null);
          void runRowAction(method, onDelete);
        }}
      />
    </Dialog>
  );
}

/** Fee and payout currency for the selected method; shown only when the method is on. */
function MethodFeeLine({
  methodType,
  feeBps,
  usdInrRate,
  isDark,
}: {
  methodType: string;
  feeBps: number;
  usdInrRate: number;
  isDark: boolean;
}) {
  const t = payoutDialogTheme(isDark);
  const paidIn =
    payoutCurrencyFor(methodType) === "INR"
      ? `Paid in INR at ${formatUsdInrRate(usdInrRate)} per $1.`
      : methodType === "skydo"
        ? `Paid in USD. ${SKYDO_CONVERSION_NOTE}`
        : "Paid in USD.";
  return (
    <p className={cn("flex flex-wrap items-center gap-x-1 text-xs", t.muted)}>
      <span className={cn("inline-flex items-center font-medium", t.text)}>
        {feeBps > 0 ? `Processing fee: ${formatFeePercent(feeBps)}` : "No processing fee"}
        {feeBps > 0 && <ProcessingFeeInfo feeBps={feeBps} isDark={isDark} />}
      </span>
      <span>{paidIn}</span>
    </p>
  );
}
