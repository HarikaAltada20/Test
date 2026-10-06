"use client";

import { useState } from "react";
import { AlertCircle, AlertTriangle, ChevronDown, Lock, Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { SKYDO_MIN_BALANCE_CENTS } from "@/lib/skydo-payout";
import { SkydoStatusBadge } from "@/components/payouts/SkydoStatusBadge";
import { FormField } from "@/components/payouts/payout-method-dialog/FormField";
import { payoutDialogTheme } from "@/components/payouts/payout-method-dialog/theme";
import type { SkydoStatus } from "@/types/earnings";

interface SkydoPayoutFormProps {
  isDark: boolean;
  isLoading: boolean;
  email: string;
  onEmailChange: (value: string) => void;
  onEmailBlur?: () => void;
  emailError?: string;
  confirmed: boolean;
  onConfirmedChange: (value: boolean) => void;
  confirmError?: string;
  balanceCents: number;
  existingEmail: string | null;
  existingStatus?: SkydoStatus | null;
  /** Shown while the existing email is still pending; asks to remove it so a new one can be added. */
  onRemoveExisting?: () => void;
  removingExisting?: boolean;
}

const NEXT_STEPS = [
  <>
    You&apos;ll get an email from <strong>Skydo Payouts</strong>.
  </>,
  <>
    <strong>Within 24 hours</strong>, finish basic KYC with your <strong>PAN or Aadhaar</strong>.
  </>,
  <>
    You must be <strong>16 or older</strong>. If you&apos;re under 16, add your parent or guardian,
    or do the KYC with their help.
  </>,
];

export function SkydoPayoutForm({
  isDark,
  isLoading,
  email,
  onEmailChange,
  onEmailBlur,
  emailError,
  confirmed,
  onConfirmedChange,
  confirmError,
  balanceCents,
  existingEmail,
  existingStatus,
  onRemoveExisting,
  removingExisting,
}: SkydoPayoutFormProps) {
  const t = payoutDialogTheme(isDark);
  const [stepsOpen, setStepsOpen] = useState(true);
  const cardClass = cn("rounded-lg border p-4 text-sm space-y-2", t.border, t.subtle, t.text);

  if (existingEmail) {
    const status = existingStatus ?? "email_pending";
    const removable = status === "email_pending";
    return (
      <div className={cardClass}>
        <p className="flex items-center gap-2 font-semibold">
          <Lock className="h-4 w-4" aria-hidden /> You&apos;ve already added Skydo
        </p>
        <p className={t.muted}>
          Your Skydo payouts go to <strong className={cn("break-all", t.text)}>{existingEmail}</strong>.{" "}
          {removable
            ? "Wrong email? You can remove it and add a different one until Skydo emails you."
            : "Skydo has already emailed you, so this email can no longer be changed or removed."}
        </p>
        <SkydoStatusBadge status={status} showDescription />
        {removable && onRemoveExisting && (
          <Button
            type="button"
            variant="outline"
            onClick={onRemoveExisting}
            loading={removingExisting}
            loadingText="Removing..."
            disabled={isLoading || removingExisting}
            className={cn(
              "mt-1 h-11 gap-1.5 sm:h-9",
              isDark
                ? "border-red-800/70 bg-transparent text-red-300 hover:bg-red-950/40"
                : "border-red-200 text-red-700 hover:bg-red-50"
            )}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Remove and use a different email
          </Button>
        )}
      </div>
    );
  }

  if (balanceCents < SKYDO_MIN_BALANCE_CENTS) {
    const progress = Math.min(100, Math.round((balanceCents / SKYDO_MIN_BALANCE_CENTS) * 100));
    return (
      <div className={cardClass}>
        <p className="flex items-center gap-2 font-semibold">
          <Lock className="h-4 w-4" aria-hidden /> Skydo unlocks at{" "}
          {formatCurrencyFromCents(SKYDO_MIN_BALANCE_CENTS)}
        </p>
        <p className={t.muted}>
          You need at least {formatCurrencyFromCents(SKYDO_MIN_BALANCE_CENTS)} in your withdrawable
          balance to add Skydo as a payout method.
        </p>
        <div
          role="progressbar"
          aria-label="Withdrawable balance towards the Skydo minimum"
          aria-valuemin={0}
          aria-valuemax={SKYDO_MIN_BALANCE_CENTS}
          aria-valuenow={Math.min(balanceCents, SKYDO_MIN_BALANCE_CENTS)}
          className={cn("h-1.5 w-full overflow-hidden rounded-full", isDark ? "bg-white/10" : "bg-gray-200")}
        >
          <div className="h-full rounded-full bg-[#7F39EC]" style={{ width: `${progress}%` }} />
        </div>
        <p className={cn("text-xs", t.muted)}>
          {formatCurrencyFromCents(balanceCents)} of {formatCurrencyFromCents(SKYDO_MIN_BALANCE_CENTS)}
        </p>
      </div>
    );
  }

  const trimmedEmail = email.trim();

  return (
    <div className="space-y-4">
      <FormField
        id="skydoEmail"
        label="Email address"
        helper="Use an email you'll keep for life. No temporary or disposable addresses."
        error={emailError}
        isDark={isDark}
      >
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          onBlur={onEmailBlur}
          placeholder="yourname@example.com"
          disabled={isLoading}
          className={t.input}
        />
      </FormField>

      <div role="note" className={cn("flex gap-2.5 rounded-lg border p-3 text-sm", t.warning)}>
        <AlertTriangle aria-hidden className={cn("mt-0.5 h-4 w-4 shrink-0", t.warningIcon)} />
        <p>
          <strong>This email becomes permanent once Skydo emails you.</strong> All Skydo payment,
          verification and KYC messages go here. You can add only one Skydo email. Until Skydo emails
          you, you can remove it and add a different one; after that it can&apos;t be changed or removed.
        </p>
      </div>

      <Collapsible
        open={stepsOpen}
        onOpenChange={setStepsOpen}
        className={cn("rounded-lg border", t.border)}
      >
        <CollapsibleTrigger
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC]",
            t.text
          )}
        >
          <Mail className={cn("h-4 w-4", t.muted)} aria-hidden />
          What happens next
          <ChevronDown
            aria-hidden
            className={cn("ml-auto h-4 w-4 transition-transform", t.muted, stepsOpen && "rotate-180")}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ol className={cn("space-y-2 px-3 pb-3 text-sm", t.text)}>
            {NEXT_STEPS.map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span
                  aria-hidden
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    isDark ? "bg-[#7F39EC]/25 text-[#C9A7FF]" : "bg-[#7F39EC]/10 text-[#4A00BE]"
                  )}
                >
                  {i + 1}
                </span>
                <span className="leading-5">{step}</span>
              </li>
            ))}
          </ol>
        </CollapsibleContent>
      </Collapsible>

      <div
        className={cn(
          "rounded-lg border p-3",
          confirmError ? "border-red-500" : confirmed ? "border-[#7F39EC]" : t.border,
          confirmed && (isDark ? "bg-[#7F39EC]/10" : "bg-[#7F39EC]/5")
        )}
      >
        <label htmlFor="skydoConfirm" className={cn("flex cursor-pointer items-start gap-3 text-sm", t.text)}>
          <Checkbox
            id="skydoConfirm"
            checked={confirmed}
            onCheckedChange={(v) => onConfirmedChange(v === true)}
            disabled={isLoading}
            aria-invalid={confirmError ? true : undefined}
            aria-describedby={confirmError ? "skydoConfirm-error" : undefined}
            className="mt-0.5 h-5 w-5"
          />
          <span>
            I confirm{" "}
            {trimmedEmail ? <strong className="break-all">{trimmedEmail}</strong> : "this email"} is my
            email for Skydo payouts, and that it becomes permanent once Skydo emails me.
          </span>
        </label>
        {confirmError && (
          <p id="skydoConfirm-error" role="alert" className={cn("mt-2 flex items-center gap-1.5 text-sm", t.error)}>
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            {confirmError}
          </p>
        )}
      </div>
    </div>
  );
}
