"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CRYPTO_NETWORKS, type CryptoNetwork } from "@/lib/payout-method-validation";
import { FieldNote, FormField } from "./FormField";
import { PAYOUT_FIELD_IDS, type PayoutMethodFormState } from "./usePayoutMethodForm";
import { payoutDialogTheme } from "./theme";

interface FieldsProps {
  form: PayoutMethodFormState;
  isDark: boolean;
  disabled: boolean;
}

function FriendlyNameField({
  form,
  isDark,
  disabled,
  placeholder,
}: FieldsProps & { placeholder: string }) {
  const t = payoutDialogTheme(isDark);
  return (
    <FormField
      id={PAYOUT_FIELD_IDS.friendlyName}
      label="Friendly name"
      helper="Only you see this, to tell your methods apart."
      error={form.errors.friendlyName}
      isDark={isDark}
    >
      <Input
        value={form.values.friendlyName}
        onChange={(e) => form.setField("friendlyName", e.target.value)}
        onBlur={() => form.markTouched("friendlyName")}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={60}
        className={t.input}
      />
    </FormField>
  );
}

export function UpiFields({ form, isDark, disabled }: FieldsProps) {
  const t = payoutDialogTheme(isDark);
  return (
    <div className="space-y-4">
      <FormField id={PAYOUT_FIELD_IDS.upiId} label="UPI ID" error={form.errors.upiId} isDark={isDark}>
        <Input
          value={form.values.upiId}
          onChange={(e) => form.setField("upiId", e.target.value)}
          onBlur={() => form.markTouched("upiId")}
          placeholder="yourname@bank"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={disabled}
          className={t.input}
        />
      </FormField>
      <FormField
        id={PAYOUT_FIELD_IDS.accountHolder}
        label="Account holder name"
        helper="Name as shown in your UPI app."
        error={form.errors.accountHolder}
        isDark={isDark}
      >
        <Input
          value={form.values.accountHolder}
          onChange={(e) => form.setField("accountHolder", e.target.value)}
          onBlur={() => form.markTouched("accountHolder")}
          placeholder="e.g. Rahul Kumar"
          autoComplete="name"
          disabled={disabled}
          className={t.input}
        />
      </FormField>
      <FriendlyNameField form={form} isDark={isDark} disabled={disabled} placeholder="e.g. My UPI" />
      <FieldNote isDark={isDark}>
        UPI withdrawals take 2–48 hours. You&apos;re responsible for declaring your
        earnings and paying any taxes under Indian law.
      </FieldNote>
    </div>
  );
}

export function BankFields({ form, isDark, disabled }: FieldsProps) {
  const t = payoutDialogTheme(isDark);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          id={PAYOUT_FIELD_IDS.accountHolder}
          label="Account holder name"
          error={form.errors.accountHolder}
          isDark={isDark}
        >
          <Input
            value={form.values.accountHolder}
            onChange={(e) => form.setField("accountHolder", e.target.value)}
            onBlur={() => form.markTouched("accountHolder")}
            autoComplete="name"
            disabled={disabled}
            className={t.input}
          />
        </FormField>
        <FormField
          id={PAYOUT_FIELD_IDS.accountNumber}
          label="Account number"
          error={form.errors.accountNumber}
          isDark={isDark}
        >
          <Input
            value={form.values.accountNumber}
            onChange={(e) => form.setField("accountNumber", e.target.value)}
            onBlur={() => form.markTouched("accountNumber")}
            inputMode="numeric"
            autoComplete="off"
            disabled={disabled}
            className={t.input}
          />
        </FormField>
        <FormField
          id={PAYOUT_FIELD_IDS.ifscCode}
          label="IFSC code"
          helper="11 characters, e.g. HDFC0001234"
          error={form.errors.ifscCode}
          isDark={isDark}
        >
          <Input
            value={form.values.ifscCode}
            onChange={(e) => form.setField("ifscCode", e.target.value)}
            onBlur={() => form.markTouched("ifscCode")}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            className={t.input}
          />
        </FormField>
        <FormField id="payoutBankName" label="Bank name" optional isDark={isDark}>
          <Input
            value={form.values.bankName}
            onChange={(e) => form.setField("bankName", e.target.value)}
            disabled={disabled}
            className={t.input}
          />
        </FormField>
      </div>
      <FriendlyNameField form={form} isDark={isDark} disabled={disabled} placeholder="e.g. Primary savings" />
      <FieldNote isDark={isDark}>
        Bank transfers take 2–48 hours, and your bank may charge a small fee. You&apos;re
        responsible for declaring your earnings and paying any taxes under Indian law.
      </FieldNote>
    </div>
  );
}

export function CryptoFields({ form, isDark, disabled }: FieldsProps) {
  const t = payoutDialogTheme(isDark);
  const network = CRYPTO_NETWORKS[form.values.cryptoNetwork as CryptoNetwork] ?? CRYPTO_NETWORKS.BNB_SMART_CHAIN;
  const status = form.walletStatus;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          id={PAYOUT_FIELD_IDS.cryptoNetwork}
          label="Network"
          error={form.errors.cryptoNetwork}
          isDark={isDark}
        >
          {({ errorClassName, ...control }) => (
            <Select
              value={form.values.cryptoNetwork}
              onValueChange={(v) => form.setField("cryptoNetwork", v)}
              disabled={disabled}
            >
              <SelectTrigger
                {...control}
                isDark={isDark}
                className={cn("h-11", !isDark && "border-gray-300", errorClassName)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent isDark={isDark}>
                {(Object.keys(CRYPTO_NETWORKS) as CryptoNetwork[]).map((key) => (
                  <SelectItem key={key} isDark={isDark} value={key}>
                    {CRYPTO_NETWORKS[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField id="payoutCryptoCurrency" label="Currency" isDark={isDark}>
          {({ errorClassName, ...control }) => (
            <Select
              value={form.values.cryptoCurrency}
              onValueChange={(v) => form.setField("cryptoCurrency", v)}
              disabled={disabled}
            >
              <SelectTrigger
                {...control}
                isDark={isDark}
                className={cn("h-11", !isDark && "border-gray-300", errorClassName)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent isDark={isDark}>
                {network.currencies.map((c) => (
                  <SelectItem key={c.value} isDark={isDark} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      </div>

      <div role="note" className={cn("flex gap-2.5 rounded-lg border p-3 text-sm", t.warning)}>
        <AlertTriangle aria-hidden className={cn("mt-0.5 h-4 w-4 shrink-0", t.warningIcon)} />
        <p>
          Only enter a <strong>{network.shortLabel}</strong> address. We check the format, not the
          address itself, so double-check it. Sending to a wrong address means the funds are lost.
        </p>
      </div>

      <FormField
        id={PAYOUT_FIELD_IDS.cryptoAddress}
        label="Wallet address"
        helper={
          status === "valid" ? undefined : "Paste your address, then check its format before saving."
        }
        error={form.errors.cryptoAddress}
        isDark={isDark}
        trailing={
          <Button
            type="button"
            variant="outline"
            onClick={form.checkWallet}
            disabled={disabled || !form.values.cryptoAddress.trim() || status === "validating"}
            className={cn("h-11 shrink-0", t.outlineButton)}
          >
            {status === "validating" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : status === "valid" ? (
              <CheckCircle2 className={cn("h-4 w-4", t.success)} aria-hidden />
            ) : null}
            {status === "valid" ? "Format OK" : "Check format"}
          </Button>
        }
      >
        <Input
          value={form.values.cryptoAddress}
          onChange={(e) => form.setField("cryptoAddress", e.target.value)}
          onBlur={() => form.markTouched("cryptoAddress")}
          placeholder={`Your ${form.values.cryptoCurrency} address`}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={disabled}
          className={cn(t.input, "font-mono text-sm")}
        />
      </FormField>
      {status === "valid" && (
        <p role="status" className={cn("-mt-2 flex items-center gap-1.5 text-sm", t.success)}>
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          Address format looks correct for {network.shortLabel}.
        </p>
      )}

      <FriendlyNameField form={form} isDark={isDark} disabled={disabled} placeholder="e.g. My Binance USDT" />
      <FieldNote isDark={isDark}>
        Crypto payouts are optional digital rewards. By choosing this method, you accept
        responsibility for declaring and paying taxes under your country&apos;s laws.
      </FieldNote>
    </div>
  );
}
