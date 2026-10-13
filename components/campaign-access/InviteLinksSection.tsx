"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "@/hooks/use-toast";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";
import {
  DEFAULT_INVITE_EXPIRY,
  INVITE_EXPIRY_PRESETS,
  MAX_INVITE_LABEL_LENGTH,
  MAX_INVITE_USES,
  buildInviteUrl,
  earliestInviteExpiryDate,
  getInviteLinkStatus,
  resolveInviteExpiry,
  type InviteCustomExpiry,
  type InviteExpiryPreset,
  type InviteLink,
} from "@/lib/campaign-access";
import { inviteLinkApi } from "./api";
import { InviteLinkStatusBadge } from "./AccessBadge";
import { InviteLinksSkeleton } from "./Skeletons";

const fieldClass = "dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500";
const outlineDark = "dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

function formatExpiry(link: InviteLink, now: Date): string {
  if (!link.expires_at) return "Never expires";
  const expires = new Date(link.expires_at);
  const diffMs = expires.getTime() - now.getTime();
  if (diffMs <= 0) return `Expired ${dateFormatter.format(expires)}`;
  const hours = Math.ceil(diffMs / (60 * 60 * 1000));
  if (hours < 24) return `Expires in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.ceil(hours / 24);
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}

function formatUses(link: InviteLink): string {
  return link.max_uses != null
    ? `${link.use_count} / ${link.max_uses} joined`
    : `${link.use_count} joined`;
}

/** Local end-of-day for a yyyy-mm-dd input value. */
function customExpiry(dateValue: string): InviteCustomExpiry | null {
  if (!dateValue) return null;
  return { date: dateValue, tzOffsetMinutes: new Date().getTimezoneOffset() };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

type Props = {
  contestId: string;
  /** Opens the create dialog each time this number increases. */
  openCreateSignal?: number;
};

export function InviteLinksSection({ contestId, openCreateSignal = 0 }: Props) {
  const isDark = useDashboardDark();
  const [links, setLinks] = useState<InviteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<InviteLink | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const now = new Date();

  const load = useCallback(async () => {
    try {
      const res = await inviteLinkApi.list(contestId);
      setLinks(res.links);
    } catch (e: any) {
      toast({ title: "Could not load invite links", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [contestId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (openCreateSignal > 0) setCreateOpen(true);
  }, [openCreateSignal]);

  const { active, inactive } = useMemo(() => {
    const a: InviteLink[] = [];
    const i: InviteLink[] = [];
    for (const l of links) (getInviteLinkStatus(l) === "active" ? a : i).push(l);
    return { active: a, inactive: i };
  }, [links]);

  const handleCopy = async (link: InviteLink) => {
    const ok = await copyText(buildInviteUrl(link.token, origin));
    if (ok) {
      setCopiedId(link.id);
      setTimeout(() => setCopiedId((id) => (id === link.id ? null : id)), 2000);
      toast({ title: "Link copied" });
    } else {
      toast({ title: "Couldn't copy the link", description: "Select it and copy manually.", variant: "destructive" });
    }
  };

  const handleCreated = async (link: InviteLink) => {
    setLinks((prev) => [link, ...prev]);
    const ok = await copyText(buildInviteUrl(link.token, origin));
    toast({
      title: ok ? "Invite link created and copied" : "Invite link created",
      description: ok ? "Paste it anywhere to share." : "Use the Copy button to share it.",
    });
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await inviteLinkApi.revoke(contestId, revokeTarget.id);
      setLinks((prev) =>
        prev.map((l) =>
          l.id === revokeTarget.id ? { ...l, revoked_at: new Date().toISOString() } : l,
        ),
      );
      toast({ title: "Invite link revoked" });
      setRevokeTarget(null);
    } catch (e: any) {
      toast({ title: "Could not revoke the link", description: e.message, variant: "destructive" });
    } finally {
      setRevoking(false);
    }
  };

  const renderRow = (link: InviteLink) => {
    const status = getInviteLinkStatus(link, now);
    const url = buildInviteUrl(link.token, origin);
    return (
      <li
        key={link.id}
        className={cn(
          "flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between",
          status !== "active" && "opacity-70",
        )}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-white">{link.label || "Untitled link"}</span>
            <InviteLinkStatusBadge status={status} />
          </div>
          <div className="truncate font-mono text-xs text-gray-500 dark:text-gray-400" title={url}>
            {url}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {formatUses(link)} · {formatExpiry(link, now)}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant="outline"
            className={outlineDark}
            aria-label={`Copy link ${link.label || "Untitled link"}`}
            onClick={() => handleCopy(link)}
          >
            {copiedId === link.id ? (
              <Check className="mr-1.5 h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="mr-1.5 h-4 w-4" />
            )}
            Copy
          </Button>
          {status === "active" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10"
              onClick={() => setRevokeTarget(link)}
            >
              Revoke
            </Button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className={cn("space-y-3 rounded-md border border-gray-200 p-4 dark:border-white/10", isDark && "dark")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
            <Link2 className="h-4 w-4" aria-hidden="true" /> Invite links
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Share a link so creators can add themselves to this campaign.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Create invite link
        </Button>
      </div>

      {loading ? (
        <InviteLinksSkeleton />
      ) : links.length === 0 ? null : (
        <>
          {active.length > 0 ? (
            <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-white/10 dark:border-white/10">
              {active.map(renderRow)}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No active links.</p>
          )}
          {inactive.length > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                aria-expanded={showInactive}
                className="rounded-sm text-sm font-medium text-[#7F39EC] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] dark:text-purple-300"
                onClick={() => setShowInactive((v) => !v)}
              >
                {showInactive
                  ? "Hide inactive links"
                  : `Show ${inactive.length} inactive link${inactive.length === 1 ? "" : "s"}`}
              </button>
              {showInactive && (
                <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-white/10 dark:border-white/10">
                  {inactive.map(renderRow)}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      <CreateInviteLinkDialog
        contestId={contestId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
        isDark={isDark}
      />

      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent className={cn(isDark && "dark border-white/10 bg-[#06021D] text-white")}>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this invite link?</AlertDialogTitle>
            <AlertDialogDescription>
              Nobody new can join with “{revokeTarget?.label || "Untitled link"}”. People who
              already joined keep access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking} className={outlineDark}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={revoking}
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                handleRevoke();
              }}
            >
              {revoking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Revoke link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type DialogProps = {
  contestId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (link: InviteLink) => void;
  isDark: boolean;
};

function CreateInviteLinkDialog({ contestId, open, onOpenChange, onCreated, isDark }: DialogProps) {
  const [label, setLabel] = useState("");
  const [expiry, setExpiry] = useState<InviteExpiryPreset>(DEFAULT_INVITE_EXPIRY);
  const [customDate, setCustomDate] = useState("");
  const [limitMode, setLimitMode] = useState<"unlimited" | "limited">("unlimited");
  const [maxUses, setMaxUses] = useState("50");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setLabel("");
      setExpiry(DEFAULT_INVITE_EXPIRY);
      setCustomDate("");
      setLimitMode("unlimited");
      setMaxUses("50");
    }
  }, [open]);

  const maxUsesNumber = Number(maxUses);
  const maxUsesValid =
    limitMode === "unlimited" ||
    (Number.isInteger(maxUsesNumber) && maxUsesNumber >= 1 && maxUsesNumber <= MAX_INVITE_USES);

  const expiryResult = resolveInviteExpiry(
    expiry,
    expiry === "custom" ? customExpiry(customDate) : null,
  );
  const expiryError = expiry === "custom" && customDate && "error" in expiryResult
    ? expiryResult.error
    : null;
  const canSubmit =
    !submitting && maxUsesValid && !("error" in expiryResult);

  const summary = [
    "expiresAt" in expiryResult
      ? expiryResult.expiresAt
        ? `Expires ${new Date(expiryResult.expiresAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}`
        : "Never expires"
      : "Choose an expiry date",
    limitMode === "limited" && maxUsesValid
      ? `Up to ${maxUsesNumber.toLocaleString()} creator${maxUsesNumber === 1 ? "" : "s"}`
      : limitMode === "unlimited"
        ? "Anyone with the link"
        : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await inviteLinkApi.create(contestId, {
        label: label.trim() || undefined,
        expiry,
        customExpiresDate: expiry === "custom" ? customDate : null,
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
        maxUses: limitMode === "limited" ? maxUsesNumber : null,
      });
      onCreated(res.link);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not create the link", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} isdark={isDark}>
      <DialogContent className={cn("sm:max-w-md", isDark && "dark text-white")}>
        <DialogHeader>
          <DialogTitle>Create invite link</DialogTitle>
          <DialogDescription>
            Creators who open this link and sign in are added to the access list.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="invite-label">
              Label <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
            </Label>
            <Input
              id="invite-label"
              className={fieldClass}
              placeholder="e.g. Instagram story"
              maxLength={MAX_INVITE_LABEL_LENGTH}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-expiry">Expires</Label>
            <Select value={expiry} onValueChange={(v) => setExpiry(v as InviteExpiryPreset)}>
              <SelectTrigger id="invite-expiry" isDark={isDark}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent isDark={isDark}>
                {INVITE_EXPIRY_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value} isDark={isDark}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {expiry === "custom" && (
              <Input
                type="date"
                aria-label="Expiry date"
                className={fieldClass}
                min={earliestInviteExpiryDate()}
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            )}
            {expiryError && <p className="text-xs text-red-600 dark:text-red-400">{expiryError}</p>}
          </div>

          <div className="space-y-2">
            <Label>Who can join</Label>
            <RadioGroup
              value={limitMode}
              onValueChange={(v) => setLimitMode(v as "unlimited" | "limited")}
              className="space-y-2"
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="unlimited" id="invite-unlimited" />
                Anyone with the link
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="limited" id="invite-limited" />
                First
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_INVITE_USES}
                  className={cn("h-8 w-24", fieldClass)}
                  value={maxUses}
                  onFocus={() => setLimitMode("limited")}
                  onChange={(e) => setMaxUses(e.target.value)}
                  aria-label="Maximum creators"
                />
                creators
              </label>
            </RadioGroup>
            {!maxUsesValid && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Enter a whole number between 1 and {MAX_INVITE_USES.toLocaleString()}.
              </p>
            )}
          </div>

          <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">{summary}</p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className={outlineDark}
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
