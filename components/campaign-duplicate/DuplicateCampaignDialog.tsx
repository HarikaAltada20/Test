"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  ImageOff,
  Info,
  Loader2,
  Minus,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampaignBadge, type BadgeTone } from "@/components/campaign-access/AccessBadge";
import {
  AdvertiserSearchSelect,
  type AdvertiserSearchOption,
} from "@/components/admin/AdvertiserSearchSelect";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatContestPlatformLabel } from "@/lib/video-platform-campaigns";
import {
  blockedSections,
  DUPLICATE_SECTION_GROUPS,
  DUPLICATE_SECTION_HINTS,
  DUPLICATE_SECTION_LABELS,
  DUPLICATE_SECTIONS_OFF_BY_DEFAULT,
  DUPLICATE_TITLE_MAX_LENGTH,
  duplicateStatusLabel,
  duplicateWizardHref,
  resolveSectionSelection,
  type DuplicatePreview,
  type DuplicateResult,
  type DuplicateSectionKey,
  type DuplicateSourceCard,
} from "@/lib/campaign-duplicate";

export type DuplicateCampaignDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  /** Opens straight on "choose what to copy" for this campaign (Duplicate buttons). */
  sourceContestId?: string | null;
  /**
   * Admin only: brand the copy is for. From "Create campaign for brand" this is
   * the brand picked on the page; otherwise it defaults to the source's brand.
   */
  targetAdvertiserId?: string | null;
  targetBrandName?: string | null;
  /** Admin only: whether the target brand can be changed in the dialog. */
  allowChangeTarget?: boolean;
};

const TYPE_LABELS: Record<string, string> = {
  leaderboard: "Leaderboard",
  cpm: "CPM",
  milestone: "Milestone",
  dual_rewards: "Dual rewards",
};

function statusTone(label: string): BadgeTone {
  if (label === "Live" || label === "Upcoming") return "green";
  if (label === "In review" || label === "Approved") return "amber";
  if (label === "Rejected") return "red";
  if (label === "Ended") return "slate";
  return "gray";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

async function readJson<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string }).error || "Something went wrong. Please try again.");
  }
  return json as T;
}

/** Checkbox that can also show "some selected". */
function TriCheckbox({
  checked,
  onCheckedChange,
  disabled,
  id,
  ariaLabel,
}: {
  checked: boolean | "indeterminate";
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
}) {
  return (
    <CheckboxPrimitive.Root
      id={id}
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      className={cn(
        "peer mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-[#7F39EC] text-white",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] focus-visible:ring-offset-2 dark:ring-offset-[#06021D]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "data-[state=checked]:bg-[#7F39EC] data-[state=indeterminate]:bg-[#7F39EC]",
      )}
    >
      <CheckboxPrimitive.Indicator>
        {checked === "indeterminate" ? (
          <Minus className="h-3 w-3" />
        ) : (
          <Check className="h-3 w-3" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

function SourceThumb({ url, className }: { url: string | null; className?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-purple-100/60 dark:bg-violet-500/15",
        className,
      )}
    >
      {url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <ImageOff className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
}

function SourceMeta({ card, showBrand }: { card: DuplicateSourceCard; showBrand: boolean }) {
  const status = duplicateStatusLabel(card.moderation_status, card.status);
  const platform =
    card.contest_format === "text_image" ? "X (Twitter)" : formatContestPlatformLabel(card.platform);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <CampaignBadge tone={statusTone(status)}>{status}</CampaignBadge>
      {card.contest_type && <span>{TYPE_LABELS[card.contest_type] ?? card.contest_type}</span>}
      {platform && platform !== "N/A" && <span>· {platform}</span>}
      <span>· {formatDate(card.created_at)}</span>
      {showBrand && card.brand_name && (
        <span className="font-medium text-foreground/80">· {card.brand_name}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: pick the campaign
// ---------------------------------------------------------------------------

function SourcePicker({
  isAdmin,
  brandFilterId,
  brandFilterName,
  onPick,
}: {
  isAdmin: boolean;
  brandFilterId: string | null;
  brandFilterName: string | null;
  onPick: (card: DuplicateSourceCard) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [onlyThisBrand, setOnlyThisBrand] = useState(!!brandFilterId);
  const [items, setItems] = useState<DuplicateSourceCard[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(
    async (offset: number) => {
      const requestId = ++requestRef.current;
      const params = new URLSearchParams();
      if (debounced) params.set("q", debounced);
      if (isAdmin && onlyThisBrand && brandFilterId) params.set("advertiserId", brandFilterId);
      if (offset > 0) params.set("offset", String(offset));
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const res = await fetch(`/api/campaigns/duplicate/sources?${params.toString()}`);
        const json = await readJson<{ items: DuplicateSourceCard[]; hasMore: boolean }>(res);
        if (requestId !== requestRef.current) return;
        setItems((prev) => (offset === 0 ? json.items : [...prev, ...json.items]));
        setHasMore(json.hasMore);
      } catch (err) {
        if (requestId !== requestRef.current) return;
        setError(err instanceof Error ? err.message : "Couldn't load campaigns");
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [debounced, isAdmin, onlyThisBrand, brandFilterId],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 border-b border-purple-100/80 px-4 pb-4 dark:border-violet-500/20 sm:px-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isAdmin ? "Search by title, brand or campaign ID" : "Search your campaigns by title"
            }
            aria-label="Search campaigns"
            className="pl-9 dark:border-gray-600 dark:bg-[#180438]"
          />
        </div>
        {isAdmin && brandFilterId && (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Which campaigns">
            {[
              { value: true, label: `${brandFilterName || "This brand"} only` },
              { value: false, label: "All brands" },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                role="radio"
                aria-checked={onlyThisBrand === opt.value}
                onClick={() => setOnlyThisBrand(opt.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC]",
                  onlyThisBrand === opt.value
                    ? "border-[#7F39EC] bg-[#7F39EC] text-white"
                    : "border-purple-200 text-[#7F39EC] hover:bg-purple-50 dark:border-violet-500/30 dark:text-violet-200 dark:hover:bg-violet-500/10",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-[240px] flex-1 overflow-y-auto px-2 py-2 sm:px-4">
        {loading ? (
          <div className="flex h-full min-h-[200px] items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading campaigns…
          </div>
        ) : error ? (
          <div className="m-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              {error}{" "}
              <button type="button" className="font-semibold underline" onClick={() => void load(0)}>
                Try again
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center px-6 text-center">
            <Copy className="h-8 w-8 text-[#7F39EC]/50" />
            <p className="mt-3 text-sm font-medium">
              {debounced
                ? "No campaigns match your search."
                : isAdmin
                  ? "No campaigns yet."
                  : "You haven't created any campaigns yet."}
            </p>
          </div>
        ) : (
          <ul className="space-y-1" aria-label="Campaigns">
            {items.map((card) => (
              <li key={card.id}>
                <button
                  type="button"
                  onClick={() => onPick(card)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] dark:hover:bg-violet-500/10 sm:px-3"
                >
                  <SourceThumb url={card.thumbnail_url} className="h-12 w-12" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {card.title || "Untitled campaign"}
                    </p>
                    <SourceMeta card={card} showBrand={isAdmin} />
                  </div>
                </button>
              </li>
            ))}
            {hasMore && (
              <li className="px-2 py-2">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void load(items.length)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-purple-200 py-2 text-sm font-medium text-[#7F39EC] hover:bg-purple-50 disabled:opacity-60 dark:border-violet-500/30 dark:text-violet-200 dark:hover:bg-violet-500/10"
                >
                  {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                  Load more
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: choose what to copy
// ---------------------------------------------------------------------------

type Selection = {
  sections: Set<DuplicateSectionKey>;
  savedListIds: Set<string>;
  includeManual: boolean;
};

function defaultSelection(preview: DuplicatePreview): Selection {
  const sections = new Set<DuplicateSectionKey>(
    preview.available.filter((k) => !DUPLICATE_SECTIONS_OFF_BY_DEFAULT.includes(k)),
  );
  return {
    sections,
    savedListIds: new Set(preview.savedLists.map((l) => l.id)),
    includeManual: preview.manualInviteCount > 0,
  };
}

function allSelection(preview: DuplicatePreview): Selection {
  return {
    sections: new Set(preview.available),
    savedListIds: new Set(preview.savedLists.map((l) => l.id)),
    includeManual: preview.manualInviteCount > 0,
  };
}

function SectionChooser({
  preview,
  selection,
  setSelection,
  title,
  setTitle,
  disabled,
}: {
  preview: DuplicatePreview;
  selection: Selection;
  setSelection: (next: Selection) => void;
  title: string;
  setTitle: (t: string) => void;
  disabled: boolean;
}) {
  const available = useMemo(() => new Set(preview.available), [preview.available]);
  const blocked = blockedSections(Array.from(selection.sections), preview.facts);
  const isUsable = (k: DuplicateSectionKey) => available.has(k) && !blocked[k];
  const isOn = (k: DuplicateSectionKey) => selection.sections.has(k) && isUsable(k);

  const update = (sections: Set<DuplicateSectionKey>, patch: Partial<Selection> = {}) => {
    // Unticking something another section needs unticks that section too.
    const resolved = new Set(resolveSectionSelection(Array.from(sections), preview.facts));
    setSelection({ ...selection, ...patch, sections: resolved });
  };

  const toggle = (k: DuplicateSectionKey, on: boolean) => {
    const next = new Set(selection.sections);
    if (on) next.add(k);
    else next.delete(k);
    if (k === "invites") {
      update(next, {
        savedListIds: on ? new Set(preview.savedLists.map((l) => l.id)) : new Set(),
        includeManual: on && preview.manualInviteCount > 0,
      });
      return;
    }
    update(next);
  };

  const toggleList = (id: string, on: boolean) => {
    const ids = new Set(selection.savedListIds);
    if (on) ids.add(id);
    else ids.delete(id);
    const next = new Set(selection.sections);
    if (ids.size > 0 || selection.includeManual) next.add("invites");
    else next.delete("invites");
    update(next, { savedListIds: ids });
  };

  const toggleManual = (on: boolean) => {
    const next = new Set(selection.sections);
    if (on || selection.savedListIds.size > 0) next.add("invites");
    else next.delete("invites");
    update(next, { includeManual: on });
  };

  const usableCount = preview.available.filter((k) => !blockedSections(preview.available, preview.facts)[k]).length;
  const selectedCount = preview.available.filter((k) => isOn(k)).length;

  const reasonFor = (k: DuplicateSectionKey): string | null => {
    if (!available.has(k)) {
      if (k === "questions" && preview.facts.accessMode !== "restricted") return "Only for Restricted campaigns";
      if (k === "invites" && preview.facts.accessMode === "public") return "Only for Restricted or Private campaigns";
      if (k === "requirements" && preview.facts.isTextImage) return "Only for video campaigns";
      if (k === "post_requirements" && !preview.facts.isTextImage) return "Only for X campaigns";
      if (k === "review_before_posting") {
        return preview.facts.isTextImage ? "Only for video campaigns" : "Off on this campaign";
      }
      return "Nothing to copy";
    }
    const missing = blocked[k];
    if (missing && missing.length > 0) {
      return `Needs ${missing.map((m) => DUPLICATE_SECTION_LABELS[m].toLowerCase()).join(" and ")}`;
    }
    return null;
  };

  const titleOn = isOn("title");

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="duplicate-title">New campaign name</Label>
        <Input
          id="duplicate-title"
          value={titleOn ? title : ""}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={DUPLICATE_TITLE_MAX_LENGTH}
          disabled={!titleOn || disabled}
          placeholder={titleOn ? "Campaign name" : "Untitled campaign (title isn't copied)"}
          className="dark:border-gray-600 dark:bg-[#180438]"
        />
        {titleOn && (
          <p className="text-right text-xs text-muted-foreground">
            {title.length} / {DUPLICATE_TITLE_MAX_LENGTH}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          What to copy{" "}
          <span className="font-normal text-muted-foreground">
            ({selectedCount} of {usableCount} selected)
          </span>
        </p>
        <div className="flex items-center gap-1 text-sm">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setSelection(allSelection(preview))}
            className="rounded-md px-2 py-1 font-medium text-[#7F39EC] hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] disabled:opacity-50 dark:text-violet-200 dark:hover:bg-violet-500/10"
          >
            Select all
          </button>
          <span className="text-muted-foreground" aria-hidden>
            ·
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              setSelection({ sections: new Set(), savedListIds: new Set(), includeManual: false })
            }
            className="rounded-md px-2 py-1 font-medium text-[#7F39EC] hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] disabled:opacity-50 dark:text-violet-200 dark:hover:bg-violet-500/10"
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {DUPLICATE_SECTION_GROUPS.map((group) => {
          const usable = group.sections.filter((k) => available.has(k));
          const onCount = usable.filter((k) => isOn(k)).length;
          const groupState: boolean | "indeterminate" =
            onCount === 0 ? false : onCount === usable.length ? true : "indeterminate";
          const groupId = `duplicate-group-${group.key}`;
          return (
            <fieldset
              key={group.key}
              className="rounded-xl border border-purple-100/80 dark:border-violet-500/20"
              disabled={disabled}
            >
              <legend className="sr-only">{group.label}</legend>
              <div className="flex items-center gap-3 border-b border-purple-100/80 bg-purple-50/40 px-4 py-2.5 dark:border-violet-500/20 dark:bg-violet-500/5">
                <TriCheckbox
                  id={groupId}
                  checked={groupState}
                  disabled={usable.length === 0 || disabled}
                  onCheckedChange={(on) => {
                    const next = new Set(selection.sections);
                    for (const k of usable) {
                      if (on) next.add(k);
                      else next.delete(k);
                    }
                    const patch: Partial<Selection> = {};
                    if (usable.includes("invites")) {
                      patch.savedListIds = on ? new Set(preview.savedLists.map((l) => l.id)) : new Set();
                      patch.includeManual = on && preview.manualInviteCount > 0;
                    }
                    update(next, patch);
                  }}
                />
                <label htmlFor={groupId} className="text-sm font-semibold">
                  {group.label}
                </label>
              </div>
              <ul className="divide-y divide-purple-100/60 dark:divide-violet-500/10">
                {group.sections.map((k) => {
                  const reason = reasonFor(k);
                  const id = `duplicate-section-${k}`;
                  const hint = DUPLICATE_SECTION_HINTS[k];
                  return (
                    <li key={k} className="px-4 py-2.5">
                      <div className="flex items-start gap-3">
                        <TriCheckbox
                          id={id}
                          checked={isOn(k)}
                          disabled={!!reason || disabled}
                          onCheckedChange={(on) => toggle(k, on)}
                        />
                        <div className="min-w-0 flex-1">
                          <label
                            htmlFor={id}
                            className={cn("text-sm", reason && "text-muted-foreground")}
                          >
                            {DUPLICATE_SECTION_LABELS[k]}
                            {k === "questions" && preview.questionCount > 0 && (
                              <span className="text-muted-foreground"> ({preview.questionCount})</span>
                            )}
                          </label>
                          {reason ? (
                            <p className="text-xs text-muted-foreground">{reason}</p>
                          ) : hint ? (
                            <p className="text-xs text-muted-foreground">{hint}</p>
                          ) : null}

                          {k === "invites" && !reason && (
                            <div className="mt-2 space-y-2">
                              {preview.savedLists.map((list) => {
                                const listId = `duplicate-list-${list.id}`;
                                return (
                                  <div key={list.id} className="flex items-start gap-3">
                                    <TriCheckbox
                                      id={listId}
                                      checked={selection.savedListIds.has(list.id) && isOn("invites")}
                                      disabled={disabled}
                                      onCheckedChange={(on) => toggleList(list.id, on)}
                                    />
                                    <label htmlFor={listId} className="text-sm">
                                      Saved list: {list.name}{" "}
                                      <span className="text-muted-foreground">
                                        ({list.creator_count} creator{list.creator_count === 1 ? "" : "s"})
                                      </span>
                                    </label>
                                  </div>
                                );
                              })}
                              {preview.manualInviteCount > 0 && (
                                <div className="flex items-start gap-3">
                                  <TriCheckbox
                                    id="duplicate-manual-invites"
                                    checked={selection.includeManual && isOn("invites")}
                                    disabled={disabled}
                                    onCheckedChange={toggleManual}
                                  />
                                  <label htmlFor="duplicate-manual-invites" className="text-sm">
                                    {preview.manualInviteCount} creator
                                    {preview.manualInviteCount === 1 ? "" : "s"} added individually
                                  </label>
                                </div>
                              )}
                              {preview.crossBrand && preview.savedLists.length > 0 && (
                                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                  Saved lists stay with {preview.source.brand_name || "the original brand"}. Their
                                  creators will be invited directly on the new campaign.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The dialog
// ---------------------------------------------------------------------------

export function DuplicateCampaignDialog({
  open,
  onOpenChange,
  isAdmin,
  sourceContestId = null,
  targetAdvertiserId = null,
  targetBrandName = null,
  allowChangeTarget = false,
}: DuplicateCampaignDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isDark = useDashboardDark();

  const [sourceId, setSourceId] = useState<string | null>(sourceContestId);
  const [target, setTarget] = useState<{ id: string | null; name: string | null }>({
    id: targetAdvertiserId,
    name: targetBrandName,
  });
  const [changingTarget, setChangingTarget] = useState(false);
  const [preview, setPreview] = useState<DuplicatePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [selection, setSelection] = useState<Selection>({
    sections: new Set(),
    savedListIds: new Set(),
    includeManual: false,
  });
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fresh state every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setSourceId(sourceContestId);
    setTarget({ id: targetAdvertiserId, name: targetBrandName });
    setChangingTarget(false);
    setPreview(null);
    setPreviewError(null);
    setSubmitError(null);
    setSubmitting(false);
  }, [open, sourceContestId, targetAdvertiserId, targetBrandName]);

  const loadPreview = useCallback(async (id: string, targetId: string | null) => {
    setLoadingPreview(true);
    setPreviewError(null);
    setSubmitError(null);
    try {
      const params = new URLSearchParams({ sourceId: id });
      if (targetId) params.set("targetAdvertiserId", targetId);
      const res = await fetch(`/api/campaigns/duplicate/preview?${params.toString()}`);
      const json = await readJson<DuplicatePreview>(res);
      setPreview(json);
      setSelection(defaultSelection(json));
      setTitle(json.defaultTitle);
    } catch (err) {
      setPreview(null);
      setPreviewError(err instanceof Error ? err.message : "Couldn't load this campaign");
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    if (open && sourceId) void loadPreview(sourceId, isAdmin ? target.id : null);
  }, [open, sourceId, target.id, isAdmin, loadPreview]);

  const handleCreate = async () => {
    if (!preview || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const sections = resolveSectionSelection(Array.from(selection.sections), preview.facts);
    try {
      const res = await fetch("/api/campaigns/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceContestId: preview.source.id,
          targetAdvertiserId: isAdmin ? preview.target.advertiser_id : undefined,
          sections,
          title: sections.includes("title") ? title : null,
          savedListIds: sections.includes("invites") ? Array.from(selection.savedListIds) : [],
          includeManualInvites: sections.includes("invites") && selection.includeManual,
        }),
      });
      const result = await readJson<DuplicateResult>(res);
      for (const w of result.warnings) {
        toast({ title: "Heads up", description: w.message });
      }
      router.push(duplicateWizardHref(result, isAdmin));
      // Keep the button busy until the wizard opens.
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't create the copy");
      setSubmitting(false);
    }
  };

  const onPick = (card: DuplicateSourceCard) => {
    setSourceId(card.id);
    if (isAdmin && !target.id) setTarget({ id: card.advertiser_id, name: card.brand_name });
  };

  const showPicker = !sourceId;
  const canGoBack = !sourceContestId && !!sourceId && !submitting;
  const advisoryWarnings = preview?.warnings ?? [];
  const datesWillShift = !!preview?.datesPassed && selection.sections.has("dates");
  const backToPicker = () => {
    setSourceId(null);
    setPreview(null);
    if (isAdmin && !targetAdvertiserId) setTarget({ id: null, name: null });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)} isdark={isDark}>
      <DialogContent
        className={cn(
          "flex max-h-[92vh] w-[calc(100vw-16px)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[88vh]",
          isDark && "dark text-white",
        )}
      >
        <DialogHeader className="space-y-1 px-4 pb-3 pt-5 text-left sm:px-6">
          <div className="flex items-center gap-2 pr-8">
            {canGoBack && (
              <button
                type="button"
                onClick={backToPicker}
                className="-ml-1 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC]"
                aria-label="Pick a different campaign"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <DialogTitle className="text-lg">
              {showPicker ? "Copy an existing campaign" : "Choose what to copy"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            {showPicker
              ? isAdmin
                ? "Pick the campaign to start from. You'll choose what to copy next."
                : "Pick one of your campaigns to start from. You'll choose what to copy next."
              : "The copy is a new draft. You'll review every step before submitting."}
          </DialogDescription>
        </DialogHeader>

        {showPicker ? (
          <SourcePicker
            isAdmin={isAdmin}
            brandFilterId={target.id}
            brandFilterName={target.name}
            onPick={onPick}
          />
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6">
              {loadingPreview ? (
                <div className="flex min-h-[240px] items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading campaign…
                </div>
              ) : previewError ? (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {previewError}
                </div>
              ) : preview ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 rounded-xl border border-purple-100/80 p-3 dark:border-violet-500/20">
                    <SourceThumb url={preview.source.thumbnail_url} className="h-14 w-14" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {preview.source.title || "Untitled campaign"}
                      </p>
                      <SourceMeta card={preview.source} showBrand={isAdmin} />
                    </div>
                    {canGoBack && (
                      <button
                        type="button"
                        onClick={backToPicker}
                        className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-[#7F39EC] hover:bg-purple-50 dark:text-violet-200 dark:hover:bg-violet-500/10"
                      >
                        Change
                      </button>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="space-y-2 rounded-xl border border-purple-100/80 p-3 dark:border-violet-500/20">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span>
                          Copy for{" "}
                          <span className="font-semibold">
                            {preview.target.brand_name || "this brand"}
                          </span>
                        </span>
                        {allowChangeTarget && !changingTarget && (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => setChangingTarget(true)}
                            className="rounded-md px-2 py-1 font-medium text-[#7F39EC] hover:bg-purple-50 dark:text-violet-200 dark:hover:bg-violet-500/10"
                          >
                            Change brand
                          </button>
                        )}
                      </div>
                      {allowChangeTarget && changingTarget && (
                        <AdvertiserSearchSelect
                          value={null}
                          isDark={isDark}
                          label="Brand for the copy"
                          onChange={(brand: AdvertiserSearchOption | null) => {
                            if (!brand) return;
                            setTarget({
                              id: brand.id,
                              name: brand.company_name || brand.full_name || brand.email,
                            });
                            setChangingTarget(false);
                          }}
                        />
                      )}
                    </div>
                  )}

                  {(advisoryWarnings.length > 0 || datesWillShift) && (
                    <ul className="space-y-2" aria-label="Before you copy">
                      {advisoryWarnings.map((w) => (
                        <li
                          key={w.code}
                          className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
                        >
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          {w.message}
                        </li>
                      ))}
                      {datesWillShift && (
                        <li className="flex items-start gap-2 rounded-xl border border-purple-100 bg-purple-50/50 px-3 py-2.5 text-sm text-muted-foreground dark:border-violet-500/20 dark:bg-violet-500/5">
                          <Info className="mt-0.5 h-4 w-4 shrink-0" />
                          The original dates have passed, so the copy will start tomorrow with the same length.
                        </li>
                      )}
                    </ul>
                  )}

                  <SectionChooser
                    preview={preview}
                    selection={selection}
                    setSelection={setSelection}
                    title={title}
                    setTitle={setTitle}
                    disabled={submitting}
                  />
                </div>
              ) : null}
            </div>

            <div className="border-t border-purple-100/80 bg-muted/20 px-4 py-3 dark:border-violet-500/20 sm:px-6">
              {submitError && (
                <p className="mb-2 flex items-start gap-2 text-sm text-red-600 dark:text-red-400" role="alert">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {submitError}
                </p>
              )}
              <button
                type="button"
                disabled={!preview || submitting || loadingPreview}
                onClick={() => void handleCreate()}
                className={cn(
                  "inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all",
                  "bg-[#4A00BE] hover:opacity-95 active:scale-[0.99] dark:bg-[#5F2BB1]",
                  "disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100",
                )}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating draft…
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Create draft
                  </>
                )}
              </button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Payment, approval and results are never copied.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
