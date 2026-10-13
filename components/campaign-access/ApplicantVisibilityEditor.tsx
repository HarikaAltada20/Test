"use client";

import { useEffect, useState } from "react";
import { EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";
import {
  APPLICANT_FIELDS,
  APPLICANT_FIELD_LABELS,
  parseApplicantVisibility,
  type ApplicantField,
  type ApplicantVisibility,
} from "@/lib/campaign-applicant-profile";
import { applicantVisibilityApi } from "./api";

export const DEFAULT_APPLICANT_VISIBILITY: ApplicantVisibility = parseApplicantVisibility({});

type Props =
  | {
      /** Saved campaign: loads and saves on its own as each switch changes. */
      contestId: string;
      value?: never;
      onChange?: never;
    }
  | {
      /** New campaign: the page keeps the value and saves it after creating the campaign. */
      contestId?: never;
      value: ApplicantVisibility;
      onChange: (next: ApplicantVisibility) => void;
    };

/**
 * Admin-only switches for what the brand can see about applicants. Everything
 * is visible by default. Render it only for admins; the API also refuses
 * changes from anyone else.
 */
export function ApplicantVisibilityEditor(props: Props) {
  const isDark = useDashboardDark();
  const saved = !!props.contestId;
  const [loaded, setLoaded] = useState<ApplicantVisibility | null>(saved ? null : props.value ?? null);
  const [savingField, setSavingField] = useState<ApplicantField | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.contestId) return;
    let cancelled = false;
    applicantVisibilityApi
      .get(props.contestId)
      .then((res) => !cancelled && setLoaded(res.visibility))
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : "Could not load"));
    return () => {
      cancelled = true;
    };
  }, [props.contestId]);

  const visibility = saved ? loaded : props.value;

  const toggle = async (field: ApplicantField, on: boolean) => {
    if (!visibility) return;
    const next = { ...visibility, [field]: on };
    if (!props.contestId) {
      props.onChange?.(next);
      return;
    }
    const previous = visibility;
    setLoaded(next);
    setSavingField(field);
    try {
      const res = await applicantVisibilityApi.save(props.contestId, next);
      setLoaded(res.visibility);
      toast({
        title: on
          ? `Brands can see ${APPLICANT_FIELD_LABELS[field].label.toLowerCase()}`
          : `${APPLICANT_FIELD_LABELS[field].label} hidden from the brand`,
      });
    } catch (e) {
      setLoaded(previous);
      toast({
        title: "Couldn't save",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingField(null);
    }
  };

  const hiddenCount = visibility ? APPLICANT_FIELDS.filter((f) => !visibility[f]).length : 0;

  return (
    <section
      aria-labelledby="applicant-visibility-heading"
      className={cn(
        "space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-500/30 dark:bg-amber-500/5",
        isDark && "dark",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4
            id="applicant-visibility-heading"
            className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"
          >
            <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            What the brand sees about applicants
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Everything is visible by default. Turn a detail off to hide it from the brand when they
            review applications. Only admins can change this.
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
          Admin only
        </span>
      </div>

      {loadError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
      ) : !visibility ? (
        <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
        </p>
      ) : (
        <>
          <ul className="grid gap-2 sm:grid-cols-2">
            {APPLICANT_FIELDS.map((field) => {
              const id = `applicant-visibility-${field}`;
              const on = visibility[field];
              return (
                <li
                  key={field}
                  className="flex items-start gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5"
                >
                  <Switch
                    id={id}
                    variant="theme-aware"
                    theme={isDark ? "dark" : "light"}
                    checked={on}
                    disabled={savingField === field}
                    onCheckedChange={(v) => toggle(field, v)}
                    aria-describedby={`${id}-hint`}
                  />
                  <label htmlFor={id} className="min-w-0 cursor-pointer text-sm">
                    <span className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100">
                      {APPLICANT_FIELD_LABELS[field].label}
                      {!on && <EyeOff className="h-3.5 w-3.5 text-gray-400" aria-label="Hidden" />}
                    </span>
                    <span id={`${id}-hint`} className="block text-xs text-gray-500 dark:text-gray-400">
                      {APPLICANT_FIELD_LABELS[field].hint}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
            {hiddenCount === 0
              ? "The brand sees all applicant details."
              : `${hiddenCount} detail${hiddenCount === 1 ? " is" : "s are"} hidden from the brand.`}
            {!saved && " Saved when you create the campaign."}
          </p>
        </>
      )}
    </section>
  );
}
