"use client";

import type { ReactElement, ReactNode } from "react";
import { cloneElement } from "react";
import { AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { payoutDialogTheme } from "./theme";

export interface FieldControlProps {
  id: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  errorClassName?: string;
}

/**
 * Label + control + helper + error. Wires aria-invalid / aria-describedby onto
 * the single child control.
 */
export function FormField({
  id,
  label,
  optional,
  helper,
  error,
  isDark,
  trailing,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  optional?: boolean;
  helper?: ReactNode;
  error?: string;
  isDark: boolean;
  /** Rendered beside the control, e.g. a "Check format" button. */
  trailing?: ReactNode;
  className?: string;
  /** A single input element, or a render function for composite controls like Select. */
  children: ReactElement<Record<string, unknown>> | ((control: FieldControlProps) => ReactNode);
}) {
  const t = payoutDialogTheme(isDark);
  const helperId = helper && !error ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(" ") || undefined;
  const controlProps: FieldControlProps = {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    errorClassName: error ? t.inputError : undefined,
  };

  const control =
    typeof children === "function"
      ? children(controlProps)
      : cloneElement(children, {
          id,
          "aria-invalid": controlProps["aria-invalid"],
          "aria-describedby": describedBy,
          className: cn(children.props.className as string | undefined, controlProps.errorClassName),
        });

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className={cn("text-sm font-medium", t.text)}>
        {label}
        {optional && <span className={cn("ml-1 font-normal", t.muted)}>(optional)</span>}
      </Label>
      {trailing ? (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">{control}</div>
          {trailing}
        </div>
      ) : (
        control
      )}
      {error && (
        <p id={errorId} role="alert" className={cn("flex items-start gap-1.5 text-sm", t.error)}>
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      {helper && !error && (
        <p id={helperId} className={cn("text-xs", t.muted)}>
          {helper}
        </p>
      )}
    </div>
  );
}

/** A single compact note under a method's fields. */
export function FieldNote({ isDark, children }: { isDark: boolean; children: ReactNode }) {
  return <p className={cn("text-xs leading-relaxed", payoutDialogTheme(isDark).muted)}>{children}</p>;
}
