"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Crown,
  Loader2,
  Rocket,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  CALENDLY_FOUNDER_URL,
  IMPORTANT_PLATFORMS,
  MARKETING_BUDGET_CHANNELS,
  MONTHLY_MARKETING_SPEND_OPTIONS,
  PROMOTE_CATEGORIES,
  SCALING_POTENTIAL_OPTIONS,
  TARGET_DEMOGRAPHICS,
  VIRALITY_SCALE_OPTIONS,
} from "@/constants/brandPartnershipForm";
import type { BrandPartnershipFormData } from "@/lib/brand-partnership/validation";
import {
  brandPartnershipSchema,
  STEP_SCHEMAS,
} from "@/lib/brand-partnership/validation";

const INITIAL_FORM: BrandPartnershipFormData = {
  brandName: "",
  websiteOrSocial: "",
  category: "",
  categoryOther: "",
  targetRegion: "",
  campaignExpectations: "",
  marketingBudgetChannels: [],
  marketingBudgetOther: "",
  monthlyMarketingSpend: "",
  monthlyMarketingSpendOther: "",
  scalingPotential: "",
  scalingPotentialOther: "",
  email: "",
  whatsappNumber: "",
  targetDemographic: "",
  targetDemographicOther: "",
  platforms: [],
  platformsOther: "",
  viralityVsConversion: "3",
  additionalNotes: "",
  companyWebsite: "",
};

const STEPS = [
  { id: 1, label: "Your brand" },
  { id: 2, label: "Goals & budget" },
  { id: 3, label: "Audience & contact" },
];

function fieldError(
  errors: Record<string, string>,
  key: string,
): string | undefined {
  return errors[key];
}

export default function BrandPartnershipForm() {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [form, setForm] = useState<BrandPartnershipFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const inputCls = (err?: string) =>
    cn(
      "w-full rounded-xl bg-white/5 border text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 transition-colors",
      err ? "border-red-500/60" : "border-white/10",
    );

  const checkboxCls =
    "h-5 w-5 rounded border-amber-400/80 bg-white/10 text-white data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-400 data-[state=checked]:text-white";

  const radioCls =
    "h-5 w-5 border-amber-400/80 bg-white/10 text-amber-500 data-[state=checked]:border-amber-400";

  const setField = <K extends keyof BrandPartnershipFormData>(
    key: K,
    value: BrandPartnershipFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const toggleArrayField = (
    key: "marketingBudgetChannels" | "platforms",
    value: string,
    checked: boolean,
  ) => {
    setForm((prev) => {
      const current = prev[key];
      const next = checked
        ? [...current, value]
        : current.filter((v) => v !== value);
      return { ...prev, [key]: next };
    });
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const validateStep = (currentStep: 1 | 2 | 3): boolean => {
    const schema = STEP_SCHEMAS[currentStep];
    const result = schema.safeParse(form);

    if (result.success) {
      setErrors({});
      return true;
    }

    const stepErrors: Record<string, string> = {};
    result.error.issues.forEach((issue) => {
      const key = issue.path[0]?.toString();
      if (key && !stepErrors[key]) stepErrors[key] = issue.message;
    });

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step as 1 | 2 | 3)) {
      setStep((s) => Math.min(s + 1, 3) as 1 | 2 | 3 | 4);
    }
  };

  const handleBack = () =>
    setStep((s) => Math.max(s - 1, 1) as 1 | 2 | 3 | 4);

  const handleSubmit = async () => {
    if (!validateStep(3)) return;

    const result = brandPartnershipSchema.safeParse(form);
    if (!result.success) {
      const allErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0]?.toString();
        if (key && !allErrors[key]) allErrors[key] = issue.message;
      });
      setErrors(allErrors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/brand-partnership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitted(true);
        setStep(4);
      } else {
        if (data.fieldErrors) setErrors(data.fieldErrors);
        toast({
          title: "Submission failed",
          description: data.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderRadioWithOther = (
    name: keyof BrandPartnershipFormData,
    otherName: keyof BrandPartnershipFormData,
    options: readonly string[],
    value: string,
    otherValue: string,
  ) => (
    <RadioGroup
      value={value}
      onValueChange={(v) => setField(name, v)}
      className="space-y-2"
    >
      {options.map((opt) => (
        <label
          key={opt}
          className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5 cursor-pointer hover:border-amber-500/30 transition-colors"
        >
          <RadioGroupItem
            value={opt}
            id={`${String(name)}-${opt}`}
            className={radioCls}
          />
          <span className="text-sm text-slate-200">{opt}</span>
        </label>
      ))}
      <label className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5 cursor-pointer hover:border-amber-500/30 transition-colors">
        <RadioGroupItem value="Other" id={`${String(name)}-other`} className={radioCls} />
        <span className="text-sm text-slate-200">Other</span>
      </label>
      {value === "Other" && (
        <Input
          value={otherValue}
          onChange={(e) => setField(otherName, e.target.value)}
          placeholder="Please specify"
          className={inputCls(fieldError(errors, String(otherName)))}
        />
      )}
    </RadioGroup>
  );

  const renderCheckboxGroup = (
    name: "marketingBudgetChannels" | "platforms",
    otherName: "marketingBudgetOther" | "platformsOther",
    options: readonly string[],
    selected: string[],
    otherValue: string,
  ) => (
    <div className="space-y-2">
      {options.map((opt) => (
        <label
          key={opt}
          className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5 cursor-pointer hover:border-amber-500/30 transition-colors"
        >
          <Checkbox
            checked={selected.includes(opt)}
            onCheckedChange={(checked) =>
              toggleArrayField(name, opt, checked === true)
            }
            className={checkboxCls}
          />
          <span className="text-sm text-slate-200">{opt}</span>
        </label>
      ))}
      <label className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5 cursor-pointer hover:border-amber-500/30 transition-colors">
        <Checkbox
          checked={selected.includes("Other")}
          onCheckedChange={(checked) =>
            toggleArrayField(name, "Other", checked === true)
          }
          className={checkboxCls}
        />
        <span className="text-sm text-slate-200">Other</span>
      </label>
      {selected.includes("Other") && (
        <Input
          value={otherValue}
          onChange={(e) => setField(otherName, e.target.value)}
          placeholder="Please specify"
          className={inputCls(fieldError(errors, otherName))}
        />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#000825] text-white">
      <div className="max-w-2xl mx-auto px-6 sm:px-10 pt-20 pb-24">
        <Link
          href="/get-started"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Get Started
        </Link>

        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2.5 rounded-full px-1 py-1 pr-4 mb-5 border border-amber-500/30 bg-amber-500/5">
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shrink-0 shadow-[0_0_10px_rgba(251,191,36,0.4)]">
              <Crown className="h-3 w-3 text-white" />
            </span>
            <span className="text-sm font-semibold text-amber-300 tracking-wide">
              Brand Partnership Application
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            Apply for a free campaign trial
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            We have{" "}
            <span className="text-amber-300 font-semibold">8,000+ creators</span>{" "}
            ready to compete to make your brand go viral. We review every
            application to ensure we can guarantee results.
          </p>
        </div>

        {step <= 3 && (
          <div className="mb-8">
            <div className="grid grid-cols-3 gap-2 mb-3">
              {STEPS.map((s) => (
                <div key={s.id} className="text-center">
                  <span
                    className={cn(
                      "text-xs sm:text-sm block transition-colors",
                      step === s.id
                        ? "text-amber-300 font-semibold"
                        : step > s.id
                          ? "text-slate-300"
                          : "text-slate-500",
                    )}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2.5 text-center">
              Step {step} of 3
            </p>
          </div>
        )}

        <div
          className="rounded-2xl border border-amber-500/20 p-6 sm:p-8 shadow-[0_0_40px_rgba(245,158,11,0.06)]"
          style={{
            background:
              "linear-gradient(135deg, rgba(180,83,9,0.1) 0%, rgba(0,8,37,0.8) 60%)",
          }}
        >
          {step === 1 && (
            <div className="space-y-5">
              <Field label="Brand or Product Name *" error={errors.brandName}>
                <Input
                  value={form.brandName}
                  onChange={(e) => setField("brandName", e.target.value)}
                  className={inputCls(errors.brandName)}
                  placeholder="Your brand name"
                />
              </Field>
              <Field
                label="Website or App Link or Social Media handle *"
                error={errors.websiteOrSocial}
              >
                <Input
                  value={form.websiteOrSocial}
                  onChange={(e) => setField("websiteOrSocial", e.target.value)}
                  className={inputCls(errors.websiteOrSocial)}
                  placeholder="https:// or @handle"
                />
              </Field>
              <Field
                label="What do you want to promote? (Category) *"
                error={errors.category || errors.categoryOther}
              >
                {renderRadioWithOther(
                  "category",
                  "categoryOther",
                  PROMOTE_CATEGORIES,
                  form.category,
                  form.categoryOther || "",
                )}
              </Field>
              <Field label="Target Country/Region *" error={errors.targetRegion}>
                <Input
                  value={form.targetRegion}
                  onChange={(e) => setField("targetRegion", e.target.value)}
                  className={inputCls(errors.targetRegion)}
                  placeholder="e.g. United States, India, Global"
                />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <Field
                label="What are your main expectations from this campaign? *"
                error={errors.campaignExpectations}
              >
                <Textarea
                  value={form.campaignExpectations}
                  onChange={(e) =>
                    setField("campaignExpectations", e.target.value)
                  }
                  className={cn(inputCls(errors.campaignExpectations), "min-h-[100px]")}
                  placeholder="e.g. viral reach, CPA targets, brand awareness"
                />
              </Field>
              <Field
                label="Where do you currently spend your marketing budget? *"
                error={
                  errors.marketingBudgetChannels || errors.marketingBudgetOther
                }
              >
                {renderCheckboxGroup(
                  "marketingBudgetChannels",
                  "marketingBudgetOther",
                  MARKETING_BUDGET_CHANNELS,
                  form.marketingBudgetChannels,
                  form.marketingBudgetOther || "",
                )}
              </Field>
              <Field
                label="What is your current monthly marketing spend? *"
                error={
                  errors.monthlyMarketingSpend ||
                  errors.monthlyMarketingSpendOther
                }
              >
                {renderRadioWithOther(
                  "monthlyMarketingSpend",
                  "monthlyMarketingSpendOther",
                  MONTHLY_MARKETING_SPEND_OPTIONS,
                  form.monthlyMarketingSpend,
                  form.monthlyMarketingSpendOther || "",
                )}
              </Field>
              <Field
                label="If we prove this is profitable, how big can you go? *"
                error={errors.scalingPotential || errors.scalingPotentialOther}
              >
                {renderRadioWithOther(
                  "scalingPotential",
                  "scalingPotentialOther",
                  SCALING_POTENTIAL_OPTIONS,
                  form.scalingPotential,
                  form.scalingPotentialOther || "",
                )}
              </Field>
            </div>
          )}

          {step === 3 && !submitted && (
            <div className="space-y-5">
              <Field label="Email *" error={errors.email}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  className={inputCls(errors.email)}
                  placeholder="you@company.com"
                />
              </Field>
              <Field label="WhatsApp Number for contact *" error={errors.whatsappNumber}>
                <Input
                  value={form.whatsappNumber}
                  onChange={(e) => setField("whatsappNumber", e.target.value)}
                  className={inputCls(errors.whatsappNumber)}
                  placeholder="+1 555 000 0000"
                />
              </Field>
              <Field
                label="Primary target demographic *"
                error={errors.targetDemographic || errors.targetDemographicOther}
              >
                {renderRadioWithOther(
                  "targetDemographic",
                  "targetDemographicOther",
                  TARGET_DEMOGRAPHICS,
                  form.targetDemographic,
                  form.targetDemographicOther || "",
                )}
              </Field>
              <Field
                label="Most important social media platforms *"
                error={errors.platforms || errors.platformsOther}
              >
                {renderCheckboxGroup(
                  "platforms",
                  "platformsOther",
                  IMPORTANT_PLATFORMS,
                  form.platforms,
                  form.platformsOther || "",
                )}
              </Field>
              <Field
                label="Virality vs conversion importance (1–5) *"
                error={errors.viralityVsConversion}
              >
                <p className="text-xs text-slate-500 mb-2">
                  1 = conversion/CPA focus · 5 = virality/mass reach focus
                </p>
                <RadioGroup
                  value={form.viralityVsConversion}
                  onValueChange={(v) =>
                    setField(
                      "viralityVsConversion",
                      v as BrandPartnershipFormData["viralityVsConversion"],
                    )
                  }
                  className="flex gap-2 flex-wrap"
                >
                  {VIRALITY_SCALE_OPTIONS.map((n) => (
                    <label
                      key={n}
                      className="flex items-center justify-center w-11 h-11 rounded-xl border border-white/10 cursor-pointer hover:border-amber-500/40 has-[[data-state=checked]]:border-amber-500 has-[[data-state=checked]]:bg-amber-500/20"
                    >
                      <RadioGroupItem value={n} id={`virality-${n}`} className="sr-only" />
                      <span className="text-sm font-semibold">{n}</span>
                    </label>
                  ))}
                </RadioGroup>
              </Field>
              <Field label="Anything else you want to share?" error={undefined}>
                <Textarea
                  value={form.additionalNotes || ""}
                  onChange={(e) => setField("additionalNotes", e.target.value)}
                  className={cn(inputCls(), "min-h-[80px]")}
                  placeholder="Optional"
                />
              </Field>
              <input
                type="text"
                name="companyWebsite"
                value={form.companyWebsite || ""}
                onChange={(e) => setField("companyWebsite", e.target.value)}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
              />
            </div>
          )}

          {step === 4 && submitted && (
            <div className="text-center py-4 space-y-6">
              <CheckCircle2 className="h-14 w-14 text-green-400 mx-auto" />
              <div>
                <h2 className="text-2xl font-bold mb-2">Application received!</h2>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  We&apos;ll review your application and reach out within 48 hours
                  if we&apos;re a fit. In the meantime, choose your next step:
                </p>
              </div>
              <div className="flex flex-col gap-3 max-w-sm mx-auto">
                <a
                  href={CALENDLY_FOUNDER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-black text-white font-semibold text-sm hover:bg-gray-800 transition-colors"
                >
                  <Calendar className="h-4 w-4" />
                  Book a call with the founder
                </a>
                <Link
                  href="/auth/signup?role=brand"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm hover:from-amber-400 hover:to-orange-400 transition-all"
                >
                  <Rocket className="h-4 w-4" />
                  Sign up as a brand & create campaign
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}

          {step <= 3 && (
            <div className="flex gap-3 mt-8 pt-6 border-t border-white/10">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-5 py-3 rounded-xl border border-white/15 text-sm text-slate-300 hover:bg-white/5 transition-colors"
                >
                  Back
                </button>
              )}
              <div className="flex-1" />
              {step < 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm hover:from-amber-400 hover:to-orange-400 transition-all"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit application
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-sm font-medium text-slate-200 mb-2 block">
        {label}
      </Label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
    </div>
  );
}
