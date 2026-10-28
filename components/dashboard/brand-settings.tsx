"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { getSubscriptionPlanById } from "@/lib/subscription-utils-client";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { sanitizeFullNameInput, validateName } from "@/lib/name-utils";

type ReferralLinks = {
  general: string;
  creators: string;
  brands: string;
};

type BrandTab =
  | "account"
  | "team"
  | "security"
  | "billing"
  | "referrals"
  | "preferences"
  | "legal";

const TABS: { id: BrandTab; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "team", label: "Team" },
  { id: "security", label: "Security" },
  { id: "billing", label: "Subscription & billing" },
  { id: "referrals", label: "Referrals" },
  { id: "preferences", label: "Preferences" },
  { id: "legal", label: "Legal" },
];

function planTitle(name?: string | null) {
  if (!name) return "—";
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function moneyLabel(cents: number) {
  if (cents % 100 === 0) return `$${cents / 100}`;
  return formatCurrencyFromCents(cents);
}

function providerLabel(provider: string) {
  if (provider === "email") return "Email and password";
  if (provider === "google") return "Google";
  const cleaned = provider.replace(/_/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function supportLabel(support?: string) {
  if (support === "basic") return "Standard support";
  if (support === "priority") return "Priority support";
  if (support === "premium") return "Premium support";
  if (!support) return null;
  return `${support.charAt(0).toUpperCase()}${support.slice(1)} support`;
}

function avatarPath(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const pathParts = new URL(url).pathname.split("/");
    const bucketIndex = pathParts.indexOf("profile-images");
    if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
      return pathParts.slice(bucketIndex + 1).join("/");
    }
  } catch {
    return null;
  }
  return null;
}

type ThemePreference = "light" | "dark";
type SidebarPreference = "expanded" | "collapsed";

function resolvedTheme(preference: ThemePreference): "light" | "dark" {
  return preference;
}

function applyThemePreference(preference: ThemePreference) {
  const mode = resolvedTheme(preference);
  localStorage.setItem("dashboard-theme-preference", preference);
  localStorage.setItem("dashboard-mode", mode);
  localStorage.removeItem("dashboard-preset");
  document.cookie = `dashboard-mode=${mode}; path=/; max-age=31536000`;
  document.cookie = "dashboard-preset=; path=/; max-age=0";
  window.dispatchEvent(
    new CustomEvent("theme-change", {
      detail: { mode, preference, scope: "dashboard" },
    }),
  );
}

function applySidebarPreference(preference: SidebarPreference) {
  localStorage.setItem("dashboard-sidebar", preference);
  window.dispatchEvent(
    new CustomEvent("sidebar-preference-change", {
      detail: { preference },
    }),
  );
}

export default function BrandSettings({
  user,
  companyName,
  websiteUrl,
  productId,
  priceId,
  username,
  campaignsRun,
  totalMoneySpentCents,
  withdrawableBalanceCents,
  availableDepositBalanceCents,
  referralCode,
  referralLinks,
  coins,
  creatorsReferred,
  brandsReferred,
  referredBy,
  hasPassword,
  providers,
  billingData,
  billingLoading,
  isDark,
  onChangePassword,
  onSignOut,
  onManagePlan,
  onCopy,
  onOpenLegal,
  onLoadBilling,
}: {
  user: User;
  companyName: string | null;
  websiteUrl: string | null;
  productId: string;
  priceId: string;
  username: string | null;
  campaignsRun: number;
  totalMoneySpentCents: number;
  withdrawableBalanceCents: number;
  availableDepositBalanceCents: number;
  referralCode: string | null;
  referralLinks: ReferralLinks | null;
  coins: number;
  creatorsReferred: number;
  brandsReferred: number;
  referredBy: string | null;
  hasPassword: boolean;
  providers: string[];
  billingData: any;
  billingLoading: boolean;
  isDark: boolean;
  onChangePassword: () => void;
  onSignOut: () => void;
  onManagePlan: () => void;
  onCopy: (text: string, description?: string) => void;
  onOpenLegal: (href: string) => void;
  onLoadBilling: () => void;
}) {
  const { toast } = useToast();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<BrandTab>("account");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [company, setCompany] = useState(companyName || "");
  const [website, setWebsite] = useState(websiteUrl || "");
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const billingRequested = useRef(false);

  useEffect(() => {
    if (billingRequested.current) return;
    billingRequested.current = true;
    onLoadBilling();
  }, [onLoadBilling]);

  useEffect(() => {
    let cancelled = false;
    const loadIdentity = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("users")
        .select("full_name, profile_picture_url")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      setFullName(data.full_name || "");
      setAvatarUrl(data.profile_picture_url || null);
    };
    loadIdentity();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  useEffect(() => {
    setCompany(companyName || "");
  }, [companyName]);

  useEffect(() => {
    setWebsite(websiteUrl || "");
  }, [websiteUrl]);

  const saveFullName = async (next: string) => {
    const trimmed = sanitizeFullNameInput(next).trim();
    const validation = validateName(trimmed, "full");
    if (!validation.isValid) {
      throw new Error(validation.error || "Invalid name");
    }
    if (trimmed === fullName) return;
    const { error } = await supabase
      .from("users")
      .update({ full_name: trimmed })
      .eq("id", user.id);
    if (error) throw error;
    setFullName(trimmed);
    window.dispatchEvent(new CustomEvent("profile-updated"));
    toast({
      title: "Profile Updated",
      description: "Your full name has been successfully updated.",
    });
  };

  const saveCompany = async (next: string) => {
    const value = next.trim();
    if (value === company) return;
    const { error } = await supabase
      .from("advertiser_profiles")
      .update({ company_name: value || null })
      .eq("id", user.id);
    if (error) throw error;
    setCompany(value);
    toast({ title: "Company Name Updated" });
  };

  const saveWebsite = async (next: string) => {
    let urlToSave = next.trim();
    if (
      urlToSave &&
      !urlToSave.startsWith("http://") &&
      !urlToSave.startsWith("https://")
    ) {
      urlToSave = `https://${urlToSave}`;
    }
    if (urlToSave === website) return;
    const { error } = await supabase
      .from("advertiser_profiles")
      .update({ website_url: urlToSave || null })
      .eq("id", user.id);
    if (error) throw error;
    setWebsite(urlToSave);
    toast({ title: "Website URL Updated" });
  };

  const uploadPicture = async (file: File) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Invalid File Type",
        description: "Please select a valid image file (PNG, JPG, or WEBP).",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File Too Large",
        description: "Please select an image smaller than 5MB.",
      });
      return;
    }

    setUploadingPicture(true);
    const fileExt = file.name.split(".").pop();
    const newPath = `${user.id}/avatar-${Date.now()}.${fileExt}`;
    try {
      const currentPath = avatarPath(avatarUrl);
      if (currentPath) {
        await supabase.storage.from("profile-images").remove([currentPath]);
      }
      const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(newPath, file, { cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from("profile-images")
        .getPublicUrl(newPath);
      const newPublicUrl = urlData?.publicUrl;
      if (!newPublicUrl) {
        throw new Error("Could not get public URL for new avatar.");
      }
      const { error: updateError } = await supabase
        .from("users")
        .update({ profile_picture_url: newPublicUrl })
        .eq("id", user.id);
      if (updateError) throw updateError;
      setAvatarUrl(newPublicUrl);
      window.dispatchEvent(new CustomEvent("profile-updated"));
      toast({
        title: "Avatar Updated",
        description: "Your profile picture has been successfully updated.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message || "Could not update your avatar. Please try again.",
      });
    } finally {
      setUploadingPicture(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const initials =
    (fullName || user.email || "U")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U";

  const plan = productId ? getSubscriptionPlanById(productId) : null;
  const isYearly = Boolean(
    plan?.prices?.yearly?.id && priceId === plan.prices.yearly.id,
  );
  const priceCents = isYearly
    ? plan?.prices?.yearly?.amount || plan?.price || 0
    : plan?.price || 0;
  const billingDetails = billingData?.billingDetails;
  const nextBilling = billingDetails?.nextBillingDate
    ? new Date(billingDetails.nextBillingDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const signInWith =
    providers.length > 0
      ? providers.map(providerLabel).join(" · ")
      : hasPassword
        ? "Email and password"
        : "—";
  const [themePreference, setThemePreference] =
    useState<ThemePreference>("light");
  const [sidebarPreference, setSidebarPreference] =
    useState<SidebarPreference>("expanded");

  useEffect(() => {
    const savedTheme = localStorage.getItem("dashboard-theme-preference");
    const savedMode = localStorage.getItem("dashboard-mode");
    const theme: ThemePreference =
      savedTheme === "light" || savedTheme === "dark"
        ? savedTheme
        : savedMode === "dark"
          ? "dark"
          : "light";
    setThemePreference(theme);
    if (savedTheme === "system") applyThemePreference(theme);

    const savedSidebar = localStorage.getItem("dashboard-sidebar");
    const sidebar: SidebarPreference =
      savedSidebar === "expanded" || savedSidebar === "collapsed"
        ? savedSidebar
        : window.innerWidth < 1280
          ? "collapsed"
          : "expanded";
    setSidebarPreference(sidebar);
    if (savedSidebar === "automatic") applySidebarPreference(sidebar);

    const onSidebar = (event: Event) => {
      const next = (event as CustomEvent<{ preference?: string }>).detail
        ?.preference;
      if (next === "expanded" || next === "collapsed") {
        setSidebarPreference(next);
      }
    };
    window.addEventListener("sidebar-preference-change", onSidebar);
    return () =>
      window.removeEventListener("sidebar-preference-change", onSidebar);
  }, []);

  const cardClass = cn(
    "overflow-hidden rounded-2xl border",
    isDark ? "border-white/10 bg-[#161616]" : "border-[#ececef] bg-white",
  );
  const muted = isDark ? "text-white/50" : "text-[#8d8d95]";
  const ink = isDark ? "text-white" : "text-[#1a1a1a]";
  const labelClass = cn("text-base", ink);
  const valueClass = cn("text-base", ink);
  const outlineButton = cn(
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border px-4 py-1.5 text-[15px] font-medium transition-colors",
    isDark
      ? "border-white/15 bg-transparent text-white hover:bg-white/5"
      : "border-[#d5d5db] bg-white text-[#1a1a1a] hover:bg-[#f6f6f7]",
  );
  const saveButton =
    "inline-flex shrink-0 items-center justify-center rounded-full goc-btn-primary px-4 py-1.5 text-[15px] font-medium disabled:opacity-60";

  return (
    <div className="w-full max-w-[820px] space-y-6">
      <div className="space-y-1">
        <h1
          className={cn(
            "text-[34px] font-bold tracking-tight",
            ink,
          )}
        >
          Settings
        </h1>
        <p className={cn("text-base", isDark ? "text-white/55" : "text-[#55555E]")}>
          Your account, team, sign-in, plan and preferences.
        </p>
      </div>

      <div
        className={cn(
          "flex flex-wrap gap-x-6 gap-y-1 border-b",
          isDark ? "border-white/15" : "border-[#d9d9de]",
        )}
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-0.5 pb-3 text-base transition-colors",
                active
                  ? isDark
                    ? "border-white font-semibold text-white"
                    : "border-[#1a1a1a] font-semibold text-[#1a1a1a]"
                  : cn("border-transparent font-medium", ink),
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "account" && (
        <div className="space-y-4">
          <section className={cardClass}>
            <div className="px-5 pb-1 pt-5">
              <h2
                className={cn(
                  "text-[17px] font-semibold",
                  isDark ? "text-white" : "text-[#1a1a1a]",
                )}
              >
                Profile{" "}
                {/* <span className={cn("font-normal", muted)}>
                  Creators see this too.
                </span> */}
              </h2>
            </div>
            <div className={cn("divide-y", isDark ? "divide-white/10" : "divide-[#eeeef1]")}>
              <div className="grid items-center gap-3 px-5 py-5 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:gap-6">
                <div>
                  <p className={labelClass}>Picture</p>
                  <p className={cn("mt-1 text-sm leading-snug", muted)}>
                    PNG, JPG or WEBP, up to 5 MB.
                  </p>
                </div>
                <span
                  className={cn(
                    "flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border text-base font-medium",
                    isDark
                      ? "border-white/15 text-white"
                      : "border-[#d9d9de] text-[#1a1a1a]",
                  )}
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt={fullName || "Profile"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </span>
                <button
                  type="button"
                  className={outlineButton}
                  disabled={uploadingPicture}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingPicture ? "Uploading..." : "Change picture"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadPicture(file);
                  }}
                />
              </div>
              <EditableRow
                label="Full name"
                value={fullName}
                onSave={saveFullName}
                sanitize={sanitizeFullNameInput}
                labelClass={labelClass}
                valueClass={valueClass}
                outlineButton={outlineButton}
                saveButton={saveButton}
                isDark={isDark}
                muted={muted}
              />
              <EditableRow
                label="Company"
                value={company}
                onSave={saveCompany}
                labelClass={labelClass}
                valueClass={valueClass}
                outlineButton={outlineButton}
                saveButton={saveButton}
                isDark={isDark}
                muted={muted}
              />
              <EditableRow
                label="Website"
                value={website}
                onSave={saveWebsite}
                labelClass={labelClass}
                valueClass={valueClass}
                outlineButton={outlineButton}
                saveButton={saveButton}
                isDark={isDark}
                muted={muted}
              />
            </div>
          </section>

          <section className={cardClass}>
            <div className="px-5 pb-1 pt-5">
              <h2
                className={cn(
                  "text-[17px] font-semibold",
                  isDark ? "text-white" : "text-[#1a1a1a]",
                )}
              >
                Account{" "}
                {/* <span className={cn("font-normal", muted)}>
                  These can&apos;t be changed here.
                </span> */}
              </h2>
            </div>
            <div className={cn("divide-y", isDark ? "divide-white/10" : "divide-[#eeeef1]")}>
              <ValueRow
                label="Email"
                value={user.email || "Not set"}
                labelClass={labelClass}
                valueClass={valueClass}
                buttonClass={outlineButton}
                muted={muted}
              />
              <ValueRow
                label="Username"
                value={username || "Not set"}
                labelClass={labelClass}
                valueClass={valueClass}
                buttonClass={outlineButton}
                empty={!username}
                muted={muted}
              />
              <ValueRow
                label="Campaigns Run"
                value={campaignsRun.toLocaleString()}
                labelClass={labelClass}
                valueClass={valueClass}
                buttonClass={outlineButton}
                muted={muted}
              />
              <ValueRow
                label="Total Money Spent"
                value={formatCurrencyFromCents(totalMoneySpentCents)}
                labelClass={labelClass}
                valueClass={valueClass}
                buttonClass={outlineButton}
                muted={muted}
              />
              <ValueRow
                label="Withdrawable Balance"
                value={formatCurrencyFromCents(withdrawableBalanceCents)}
                labelClass={labelClass}
                valueClass={valueClass}
                buttonClass={outlineButton}
                muted={muted}
              />
              <ValueRow
                label="Available Deposit Balance"
                value={formatCurrencyFromCents(availableDepositBalanceCents)}
                labelClass={labelClass}
                valueClass={valueClass}
                buttonClass={outlineButton}
                muted={muted}
              />
            </div>
          </section>
        </div>
      )}

      {tab === "team" && (
        <section className={cardClass}>
          <div className="px-5 pb-1 pt-5">
            <h2
              className={cn(
                "text-[17px] font-semibold",
                isDark ? "text-white" : "text-[#1a1a1a]",
              )}
            >
              Members{" "}
              {/* <span className={cn("font-normal", muted)}>
                People with access to this brand.
              </span> */}
            </h2>
          </div>
          <div className={cn("border-t px-5 py-4", isDark ? "border-white/10" : "border-[#eeeef1]")}>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border text-sm font-medium",
                  isDark
                    ? "border-white/15 text-white"
                    : "border-[#d9d9de] text-[#1a1a1a]",
                )}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-base font-medium", valueClass)}>
                  {fullName || user.email || "You"}
                </p>
                <p className={cn("truncate text-base", muted)}>{user.email}</p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  isDark
                    ? "bg-white/10 text-white"
                    : "bg-[#f3f3f5] text-[#3a3a40]",
                )}
              >
                Owner
              </span>
            </div>
          </div>
        </section>
      )}

      {tab === "security" && (
        <div className="space-y-4">
          <section className={cardClass}>
            <div className="px-5 pb-1 pt-5">
              <h2 className={cn("text-[17px] font-semibold", ink)}>
                Sign in
              </h2>
            </div>
            <div className={cn("divide-y", isDark ? "divide-white/10" : "divide-[#eeeef1]")}>
              <ValueRow
                label="Sign in with"
                value={signInWith}
                labelClass={labelClass}
                valueClass={valueClass}
                buttonClass={outlineButton}
                muted={muted}
              />
              <ValueRow
                label="Password"
                value={hasPassword ? "••••••••" : "Not set"}
                action={hasPassword ? "Change password" : "Set password"}
                onAction={onChangePassword}
                labelClass={labelClass}
                valueClass={cn(valueClass, hasPassword && "tracking-[0.2em]")}
                buttonClass={outlineButton}
                empty={!hasPassword}
                muted={muted}
              />
            </div>
          </section>
          <section className={cardClass}>
            <div className="px-5 pb-1 pt-5">
              <h2 className={cn("text-[17px] font-semibold", ink)}>
                This device
              </h2>
            </div>
            <div className={cn("border-t", isDark ? "border-white/10" : "border-[#eeeef1]")}>
              <ValueRow
                label="Sign out"
                value={
                  user.email ? `Signed in as ${user.email}` : "Signed in"
                }
                action="Sign out"
                onAction={onSignOut}
                labelClass={labelClass}
                valueClass={valueClass}
                buttonClass={outlineButton}
                muted={muted}
              />
            </div>
          </section>
        </div>
      )}

      {tab === "billing" && (
        <div className="space-y-4">
          <section className={cardClass}>
            <div className="flex items-center justify-between px-5 pb-1 pt-5">
              <h2 className={cn("text-[17px] font-semibold", ink)}>
                Your plan
              </h2>
              {billingDetails?.status === "active" &&
                !billingDetails?.cancelAtPeriodEnd && (
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      isDark
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-[#e7f6ee] text-[#178a45]",
                    )}
                  >
                    Active
                  </span>
                )}
              {billingDetails?.status === "active" &&
                billingDetails?.cancelAtPeriodEnd && (
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      isDark
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-amber-100 text-amber-800",
                    )}
                  >
                    Canceling
                  </span>
                )}
            </div>
            {billingLoading && !billingDetails ? (
              <div className="flex justify-center py-8">
                <PageLoadingSpinner mode={isDark ? "dark" : "light"} />
              </div>
            ) : (
              <div className={cn("divide-y", isDark ? "divide-white/10" : "divide-[#eeeef1]")}>
                <ValueRow
                  label="Plan"
                  value={planTitle(plan?.name)}
                  labelClass={labelClass}
                  valueClass={valueClass}
                  buttonClass={outlineButton}
                  muted={muted}
                />
                <ValueRow
                  label="Price"
                  value={
                    plan
                      ? `${moneyLabel(priceCents)} ${isYearly ? "per year" : "per month"}`
                      : "—"
                  }
                  labelClass={labelClass}
                  valueClass={valueClass}
                  buttonClass={outlineButton}
                  muted={muted}
                />
                <ValueRow
                  label="Billed"
                  value={plan ? (isYearly ? "Yearly" : "Monthly") : "—"}
                  labelClass={labelClass}
                  valueClass={valueClass}
                  buttonClass={outlineButton}
                  muted={muted}
                />
                <ValueRow
                  label="Next billing date"
                  value={
                    nextBilling
                      ? `${nextBilling}${
                          typeof billingDetails?.daysUntilNextBilling === "number"
                            ? ` · in ${billingDetails.daysUntilNextBilling} days`
                            : ""
                        }`
                      : "—"
                  }
                  labelClass={labelClass}
                  valueClass={valueClass}
                  buttonClass={outlineButton}
                  muted={muted}
                />
              </div>
            )}
            <div className="flex flex-wrap gap-2 px-5 py-4">
              <button
                type="button"
                onClick={onManagePlan}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium",
                  isDark
                    ? "border border-white/20 bg-transparent text-white hover:bg-white/10"
                    : "bg-black text-white",
                )}
              >
                Manage plan
              </button>
              {billingDetails?.latestInvoiceUrl && plan?.name !== "EXPLORER" && (
                <button
                  type="button"
                  className={outlineButton}
                  onClick={() =>
                    window.open(billingDetails.latestInvoiceUrl, "_blank")
                  }
                >
                  View latest invoice
                </button>
              )}
            </div>
            {billingDetails?.cancelAtPeriodEnd && nextBilling && (
              <p className={cn("px-5 pb-4 text-sm", muted)}>
                This subscription ends on {nextBilling}.
              </p>
            )}
          </section>

          {plan && (
            <section className={cardClass}>
              <div className="px-5 pb-3 pt-5">
                <h2 className={cn("text-[17px] font-semibold", ink)}>
                  What it includes
                </h2>
              </div>
              <ul className="space-y-2.5 px-5 pb-5">
                {[
                  `${plan.features.maxActiveContests} live campaigns at a time`,
                  `Up to ${plan.features.maxWinnersPerContest} winners per campaign`,
                  `${plan.features.commissionPercentage}% commission on campaign budgets`,
                  supportLabel(plan.features.support),
                  plan.features.analytics
                    ? `${plan.features.analytics} analytics`
                    : null,
                ]
                  .filter(Boolean)
                  .map((item) => (
                    <li
                      key={item}
                      className={cn("flex items-center gap-2 text-sm", valueClass)}
                    >
                      <Check className="h-4 w-4 text-[#7c3aed]" />
                      {item}
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {tab === "referrals" && (
        <div className="space-y-4">
          <section className={cn(cardClass, "px-5 py-5")}>
            <h2 className={cn("text-[17px] font-semibold", ink)}>
              Your referrals
            </h2>
            <div
              className={cn(
                "mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 sm:gap-0",
                isDark
                  ? "sm:divide-x sm:divide-white/10"
                  : "sm:divide-x sm:divide-[#ececef]",
              )}
            >
              <div className="sm:pr-5">
                <p
                  className={cn(
                    "text-sm",
                    isDark ? "text-white/70" : "text-[#55555E]",
                  )}
                >
                  Referred by
                </p>
                <p
                  className={cn(
                    "mt-1 truncate text-base font-medium",
                    ink,
                  )}
                  title={referredBy || "No one"}
                >
                  {referredBy || "No one"}
                </p>
              </div>
              <div className="sm:px-5">
                <p
                  className={cn(
                    "text-sm",
                    isDark ? "text-white/70" : "text-[#55555E]",
                  )}
                >
                  Creators referred
                </p>
                <p className={cn("mt-1 text-base font-semibold", ink)}>
                  {creatorsReferred.toLocaleString()}
                </p>
              </div>
              <div className="sm:px-5">
                <p
                  className={cn(
                    "text-sm",
                    isDark ? "text-white/70" : "text-[#55555E]",
                  )}
                >
                  Brands referred
                </p>
                <p className={cn("mt-1 text-base font-semibold", ink)}>
                  {brandsReferred.toLocaleString()}
                </p>
              </div>
              <div className="sm:pl-5">
                <p
                  className={cn(
                    "text-sm",
                    isDark ? "text-white/70" : "text-[#55555E]",
                  )}
                >
                  Available Coins
                </p>
                <p className={cn("mt-1 text-base font-semibold", ink)}>
                  {coins.toLocaleString()}
                </p>
              </div>
            </div>
          </section>

          <section className={cn(cardClass, "px-5 py-5")}>
            <h2 className={cn("text-[17px] font-semibold", ink)}>
              Refer and earn 30% commission
            </h2>
            <p className={cn("mt-2 max-w-xl text-md text-[#55555E]")}>
              If any brand signs up and pays through your referral, you earn
              30% commission on subscription fees every time they pay, up to
              $2000.
            </p>
          </section>
          <section className={cardClass}>
            <div className="px-5 pb-1 pt-5">
              <h2 className={cn("text-[17px] font-semibold", ink)}>
                Your links
              </h2>
            </div>
            {referralCode && referralLinks ? (
              <div className={cn("divide-y", isDark ? "divide-white/10" : "divide-[#eeeef1]")}>
                <CopyRow
                  label="Referral code"
                  value={referralCode}
                  onCopy={() =>
                    onCopy(referralCode, "Referral code copied to clipboard.")
                  }
                  labelClass={labelClass}
                  isDark={isDark}
                  buttonClass={outlineButton}
                />
                <CopyRow
                  label="Brands link"
                  value={referralLinks.brands}
                  onCopy={() => onCopy(referralLinks.brands)}
                  labelClass={labelClass}
                  isDark={isDark}
                  buttonClass={outlineButton}
                />
                <CopyRow
                  label="Creators link"
                  value={referralLinks.creators}
                  onCopy={() => onCopy(referralLinks.creators)}
                  labelClass={labelClass}
                  isDark={isDark}
                  buttonClass={outlineButton}
                />
                <CopyRow
                  label="General link"
                  value={referralLinks.general}
                  onCopy={() => onCopy(referralLinks.general)}
                  labelClass={labelClass}
                  isDark={isDark}
                  buttonClass={outlineButton}
                />
              </div>
            ) : (
              <p className={cn("px-5 py-4 text-sm", muted)}>
                Set a username on your profile to generate referral links.
              </p>
            )}
          </section>
        </div>
      )}

      {tab === "preferences" && (
        <section className={cardClass}>
          <div className="px-5 pb-1 pt-5">
            <h2 className={cn("text-[17px] font-semibold", ink)}>
              Display{" "}
              {/* <span className={cn("font-normal", muted)}>
                Saved on this device.
              </span> */}
            </h2>
          </div>
          <div
            className={cn(
              "divide-y",
              isDark ? "divide-white/10" : "divide-[#eeeef1]",
            )}
          >
            <PreferenceRow
              label="Theme"
              hint="Light or dark for this device."
              labelClass={labelClass}
              muted={muted}
            >
              <SegmentedControl
                value={themePreference}
                options={[
                  { id: "light", label: "Light" },
                  { id: "dark", label: "Dark" },
                ]}
                isDark={isDark}
                onChange={(next) => {
                  const preference = next as ThemePreference;
                  setThemePreference(preference);
                  applyThemePreference(preference);
                }}
              />
            </PreferenceRow>
            <PreferenceRow
              label="Sidebar"
              hint="Expanded or collapsed for this device."
              labelClass={labelClass}
              muted={muted}
            >
              <SegmentedControl
                value={sidebarPreference}
                options={[
                  { id: "expanded", label: "Expanded" },
                  { id: "collapsed", label: "Collapsed" },
                ]}
                isDark={isDark}
                onChange={(next) => {
                  const preference = next as SidebarPreference;
                  setSidebarPreference(preference);
                  applySidebarPreference(preference);
                }}
              />
            </PreferenceRow>
          </div>
        </section>
      )}

      {tab === "legal" && (
        <section className={cardClass}>
          <div className="px-5 pb-1 pt-5">
            <h2 className={cn("text-[17px] font-semibold", ink)}>
              Terms and policies
            </h2>
          </div>
          <div className={cn("divide-y", isDark ? "divide-white/10" : "divide-[#eeeef1]")}>
            <ValueRow
              label="Terms of Use"
              value="The rules for using Game of Creators."
              action="Read"
              onAction={() => onOpenLegal("/terms-of-service")}
              labelClass={labelClass}
              valueClass={valueClass}
              buttonClass={outlineButton}
              muted={muted}
            />
            <ValueRow
              label="Privacy Policy"
              value="What we collect, why, and how it is protected."
              action="Read"
              onAction={() => onOpenLegal("/privacy-policy")}
              labelClass={labelClass}
              valueClass={valueClass}
              buttonClass={outlineButton}
              muted={muted}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function PreferenceRow({
  label,
  hint,
  labelClass,
  muted,
  children,
}: {
  label: string;
  hint: string;
  labelClass: string;
  muted: string;
  children: ReactNode;
}) {
  return (
    <div className="grid items-center gap-4 px-5 py-5 sm:grid-cols-[240px_auto] sm:justify-start">
      <div>
        <p className={labelClass}>{label}</p>
        <p className={cn("mt-1 max-w-[200px] text-sm leading-snug", muted)}>
          {hint}
        </p>
      </div>
      {children}
    </div>
  );
}

function SegmentedControl({
  value,
  options,
  isDark,
  onChange,
}: {
  value: string;
  options: { id: string; label: string }[];
  isDark: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-full p-1",
        isDark ? "bg-white/10" : "bg-[#efeff1]",
      )}
    >
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              selected
                ? isDark
                  ? "bg-white/20 text-white"
                  : "bg-[#e3e3e7] text-[#1a1a1a]"
                : isDark
                  ? "text-white/80"
                  : "text-[#1a1a1a]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function EditableRow({
  label,
  value,
  onSave,
  sanitize,
  labelClass,
  valueClass,
  outlineButton,
  saveButton,
  isDark,
  muted,
}: {
  label: string;
  value: string;
  onSave: (next: string) => Promise<void>;
  sanitize?: (value: string) => string;
  labelClass: string;
  valueClass: string;
  outlineButton: string;
  saveButton: string;
  isDark: boolean;
  muted: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setDraft(value);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(value);
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (err: any) {
      setError(err?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid items-center gap-3 px-5 py-5 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:gap-6">
      <p className={labelClass}>{label}</p>
      {editing ? (
        <div className="min-w-0">
          <input
            value={draft}
            onChange={(event) =>
              setDraft(
                sanitize ? sanitize(event.target.value) : event.target.value,
              )
            }
            className={cn(
              "w-full rounded-lg border border-transparent px-3 py-2 text-base outline-none focus:border-[#c4b5fd] focus:ring-2 focus:ring-[#7c3aed]/30",
              isDark
                ? "bg-white/10 text-white"
                : "bg-[#f3f3f5] text-[#1a1a1a]",
            )}
          />
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
      ) : (
        <p className={cn("min-w-0 truncate", value ? valueClass : muted)}>
          {value || "Not set"}
        </p>
      )}
      {editing ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={saveButton}
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            className={outlineButton}
            onClick={cancel}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className={outlineButton} onClick={startEditing}>
          Edit
        </button>
      )}
    </div>
  );
}

function ValueRow({
  label,
  value,
  action,
  onAction,
  labelClass,
  valueClass,
  buttonClass,
  empty,
  muted,
}: {
  label: string;
  value: string;
  action?: string;
  onAction?: () => void;
  labelClass: string;
  valueClass: string;
  buttonClass: string;
  empty?: boolean;
  muted: string;
}) {
  return (
    <div className="grid items-center gap-3 px-5 py-5 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:gap-6">
      <p className={labelClass}>{label}</p>
      <p className={cn("min-w-0 truncate", empty ? muted : valueClass)}>{value}</p>
      {action && onAction ? (
        <button type="button" className={buttonClass} onClick={onAction}>
          {action}
        </button>
      ) : (
        <span className="hidden sm:block" />
      )}
    </div>
  );
}

function CopyRow({
  label,
  value,
  onCopy,
  labelClass,
  isDark,
  buttonClass,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  labelClass: string;
  isDark: boolean;
  buttonClass: string;
}) {
  return (
    <div className="grid items-center gap-3 px-5 py-5 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:gap-6">
      <p className={labelClass}>{label}</p>
      <p
        className={cn(
          "min-w-0 truncate rounded-lg px-3 py-2 text-base",
          isDark ? "bg-white/5 text-white/80" : "bg-[#f3f3f5] text-[#3a3a40]",
        )}
        title={value}
      >
        {value}
      </p>
      <button type="button" className={buttonClass} onClick={onCopy}>
        <Copy className="h-3.5 w-3.5" />
        Copy
      </button>
    </div>
  );
}
