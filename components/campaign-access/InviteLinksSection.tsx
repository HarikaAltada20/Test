"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CircleCheck, Copy, Link2, Loader2, Plus, RotateCcw, Share2, Users } from "lucide-react";
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
import { RelativeTime } from "./RelativeTime";
import { InviteLinksSkeleton } from "./Skeletons";

const fieldClass = "text-gray-900 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500";
const outlineDark = "text-gray-900 dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";

const LABEL_SUGGESTIONS = ["Instagram bio", "Instagram story", "Email", "Discord"];

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

function whoCanJoin(link: Pick<InviteLink, "max_uses">): string {
  return link.max_uses != null
    ? `First ${link.max_uses.toLocaleString()} creator${link.max_uses === 1 ? "" : "s"}`
    : "Anyone with the link";
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

function canShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

async function shareLink(url: string, label: string | null) {
  try {
    await navigator.share({ title: label || "Campaign invite", url });
  } catch {
    // Closing the share sheet rejects too; nothing to report.
  }
}

type CreateTemplate = { label: string; maxUses: number | null };

type Props = {
  contestId: string;
  /** Opens the create dialog each time this number increases. */
  openCreateSignal?: number;
  /** Shows the creators who joined through a link, e.g. by filtering the roster. */
  onViewJoined?: (linkId: string) => void;
  /** Drops the section's own border when it sits inside another card. */
  embedded?: boolean;
};

export function InviteLinksSection({
  contestId,
  openCreateSignal = 0,
  onViewJoined,
  embedded,
}: Props) {
  const isDark = useDashboardDark();
  const [links, setLinks] = useState<InviteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [template, setTemplate] = useState<CreateTemplate | null>(null);
  const [created, setCreated] = useState<{ link: InviteLink; copied: boolean } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<InviteLink | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [shareSupported, setShareSupported] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const now = new Date();

  useEffect(() => setShareSupported(canShare()), []);

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

  const openCreate = (from: CreateTemplate | null = null) => {
    setTemplate(from);
    setCreateOpen(true);
  };

  useEffect(() => {
    if (openCreateSignal > 0) openCreate();
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
    const copied = await copyText(buildInviteUrl(link.token, origin));
    setCreated({ link, copied });
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

  const renderCard = (link: InviteLink) => {
    const status = getInviteLinkStatus(link, now);
    const isActive = status === "active";
    const url = buildInviteUrl(link.token, origin);
    const name = link.label || "Untitled link";
    const pct =
      link.max_uses != null && link.max_uses > 0
        ? Math.min(100, Math.round((link.use_count / link.max_uses) * 100))
        : null;
    return (
      <li
        key={link.id}
        className={cn(
          "space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/5",
          !isActive && "bg-gray-50 opacity-70 dark:bg-transparent",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium text-gray-900 dark:text-white">{name}</span>
              <InviteLinkStatusBadge status={status} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Created <RelativeTime value={link.created_at} /> · {formatExpiry(link, now)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 dark:bg-black/20">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-600 dark:text-gray-300" title={url}>
            {url}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {link.max_uses != null
                ? `${link.use_count} / ${link.max_uses.toLocaleString()} joined`
                : `${link.use_count} joined`}
            </span>
            <span>{whoCanJoin(link)}</span>
          </div>
          {pct !== null && (
            <div
              className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"
              role="progressbar"
              aria-label={`${name}: ${link.use_count} of ${link.max_uses} places used`}
              aria-valuemin={0}
              aria-valuemax={link.max_uses ?? 0}
              aria-valuenow={link.use_count}
            >
              <div className="h-full rounded-full bg-[#7F39EC]" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isActive ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className={outlineDark}
                aria-label={`Copy link ${name}`}
                onClick={() => handleCopy(link)}
              >
                {copiedId === link.id ? (
                  <Check className="mr-1.5 h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="mr-1.5 h-4 w-4" />
                )}
                Copy
              </Button>
              {shareSupported && (
                <Button
                  size="sm"
                  variant="outline"
                  className={outlineDark}
                  aria-label={`Share link ${name}`}
                  onClick={() => shareLink(url, link.label)}
                >
                  <Share2 className="mr-1.5 h-4 w-4" /> Share
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10"
                onClick={() => setRevokeTarget(link)}
              >
                Revoke
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className={outlineDark}
              onClick={() => openCreate({ label: link.label ?? "", maxUses: link.max_uses })}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" /> Create a new link like this
            </Button>
          )}
          {onViewJoined && link.use_count > 0 && (
            <button
              type="button"
              className="ml-auto rounded-sm text-xs font-medium text-[#7F39EC] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] dark:text-purple-300"
              onClick={() => onViewJoined(link.id)}
            >
              View {link.use_count} creator{link.use_count === 1 ? "" : "s"} who joined
            </button>
          )}
        </div>
      </li>
    );
  };

  const createdUrl = created ? buildInviteUrl(created.link.token, origin) : "";

  return (
    <div
      className={cn(
        "space-y-3",
        !embedded && "rounded-md border border-gray-200 p-4 dark:border-white/10",
        isDark && "dark",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
            <Link2 className="h-4 w-4" aria-hidden="true" /> Invite links
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Share a link so creators can add themselves to this campaign.
          </p>
        </div>
        <Button size="sm" onClick={() => openCreate()}>
          <Plus className="mr-1.5 h-4 w-4" /> Create invite link
        </Button>
      </div>

      {loading ? (
        <InviteLinksSkeleton />
      ) : links.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500 dark:border-white/15 dark:text-gray-400">
          No invite links yet. Create one for your bio, a story, an email or Discord.
        </p>
      ) : (
        <>
          {active.length > 0 ? (
            <ul className="grid gap-3 lg:grid-cols-2">{active.map(renderCard)}</ul>
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
                {showInactive ? "Hide inactive links" : `Show inactive (${inactive.length})`}
              </button>
              {showInactive && <ul className="grid gap-3 lg:grid-cols-2">{inactive.map(renderCard)}</ul>}
            </div>
          )}
        </>
      )}

      <CreateInviteLinkDialog
        contestId={contestId}
        open={createOpen}
        template={template}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
        isDark={isDark}
      />

      <Dialog isdark={isDark} open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent className={cn("sm:max-w-md", isDark ? "dark text-white" : "text-gray-900")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleCheck className="h-5 w-5 text-emerald-500" aria-hidden="true" /> Invite link ready
            </DialogTitle>
            <DialogDescription>
              {created?.copied ? "It's copied to your clipboard. " : ""}Share it wherever your
              creators are.
            </DialogDescription>
          </DialogHeader>
          {created && (
            <div className="space-y-3">
              <Label htmlFor="created-invite-url" className="sr-only">
                Invite link
              </Label>
              <Input
                id="created-invite-url"
                readOnly
                autoFocus
                value={createdUrl}
                onFocus={(e) => e.currentTarget.select()}
                className={cn("font-mono text-xs", fieldClass)}
              />
              <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">
                {whoCanJoin(created.link)} · {formatExpiry(created.link, new Date())}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            {shareSupported && created && (
              <Button variant="outline" className={outlineDark} onClick={() => shareLink(createdUrl, created.link.label)}>
                <Share2 className="mr-1.5 h-4 w-4" /> Share
              </Button>
            )}
            <Button
              onClick={async () => {
                if (created && (await copyText(createdUrl))) toast({ title: "Link copied" });
              }}
            >
              <Copy className="mr-1.5 h-4 w-4" /> Copy link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent className={cn(isDark ? "dark border-white/10 bg-[#06021D] text-white" : "text-gray-900")}>
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
  /** Prefills the form, e.g. from "Create a new link like this". */
  template: CreateTemplate | null;
  onOpenChange: (open: boolean) => void;
  onCreated: (link: InviteLink) => void;
  isDark: boolean;
};

function CreateInviteLinkDialog({
  contestId,
  open,
  template,
  onOpenChange,
  onCreated,
  isDark,
}: DialogProps) {
  const [label, setLabel] = useState("");
  const [expiry, setExpiry] = useState<InviteExpiryPreset>(DEFAULT_INVITE_EXPIRY);
  const [customDate, setCustomDate] = useState("");
  const [limitMode, setLimitMode] = useState<"unlimited" | "limited">("unlimited");
  const [maxUses, setMaxUses] = useState("50");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setLabel(template?.label ?? "");
      setExpiry(DEFAULT_INVITE_EXPIRY);
      setCustomDate("");
      setLimitMode(template?.maxUses != null ? "limited" : "unlimited");
      setMaxUses(template?.maxUses != null ? String(template.maxUses) : "50");
    }
  }, [open, template]);

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
      <DialogContent className={cn("sm:max-w-md", isDark ? "dark text-white" : "text-gray-900")}>
        <DialogHeader>
          <DialogTitle>{template ? "Create a new link like this" : "Create invite link"}</DialogTitle>
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
              placeholder="Where you'll share it"
              maxLength={MAX_INVITE_LABEL_LENGTH}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <div role="group" aria-label="Suggested labels" className="flex flex-wrap gap-1.5">
              {LABEL_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={label === s}
                  onClick={() => setLabel(s)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC]",
                    label === s
                      ? "border-[#7F39EC] bg-[#7F39EC] text-white"
                      : "border-gray-200 text-gray-600 hover:border-[#7F39EC]/60 dark:border-white/15 dark:text-gray-300",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
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
