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

const DISPLAY_SECTION_LABELS: Partial<Record<DuplicateSectionKey, string>> = {
  title: "Title",
  brief: "Brief & description",
  rules: "Rules & guidelines",
  rewards: "Prize structure",
  content_type: "Content type & categories",
  inspiration_links: "Links & resources",
  dates: "Dates",
};

const SECTION_HINT_FALLBACKS: Record<DuplicateSectionKey, string> = {
  title: "Used as the base for the new name",
  brief: "Brief text and per-platform scopes",
  rules: "Not allowed, make it yours, quality",
  rewards: "Podium prizes and ranked payouts",
  content_type: "CLIPPING · Education · Debate",
  categories: "Target categories and creator interests",
  setup: "Format, type and platforms it runs on",
  region: "Regions and country targeting",
  requirements: "Creator requirements, follower count and quality",
  thumbnail: "Campaign cover art and thumbnail",
  access: "Public, restricted or private access mode",
  questions: "Application questions creators must answer",
  invites: "Directly invited creators and saved lists",
  post_requirements: "Hashtags, mentions and scopes for X posts",
  resources: "Files, reference materials and brand assets",
  inspiration_links: "Inspiration, tracking link and files",
  tracking_links: "Attribution links and tracking URLs",
  bonus: "Milestones and performance bonuses",
  creator_limits: "Max submissions and payout limits per creator",
  dates: "Start and end are always set again",
};

/** iOS-style toggle switch matching the mockup (black active, light gray inactive) */
function DuplicateToggle({
  checked,
  onCheckedChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onCheckedChange(!checked);
      }}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-40",
        checked
          ? "bg-black dark:bg-white"
          : "bg-slate-200 dark:bg-slate-700",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block h-5 w-5 rounded-full shadow-sm transition-transform duration-200 ease-in-out",
          checked
            ? "translate-x-5 bg-white dark:bg-black"
            : "translate-x-0 bg-white dark:bg-slate-300",
        )}
      />
    </button>
  );
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
        "peer mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-slate-900 text-white dark:border-white",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 dark:ring-offset-[#06021D]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "data-[state=checked]:bg-black data-[state=indeterminate]:bg-black dark:data-[state=checked]:bg-white dark:data-[state=checked]:text-black dark:data-[state=indeterminate]:bg-white dark:data-[state=indeterminate]:text-black",
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
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800",
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
    <div>
      <div className="space-y-3 border-b border-slate-100 px-4 pb-4 dark:border-slate-800 sm:px-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isAdmin ? "Search by title, brand or campaign ID" : "Search your campaigns by title"
            }
            aria-label="Search campaigns"
            className="rounded-2xl border border-slate-200 bg-slate-50/60 pl-10 text-sm focus-visible:ring-black dark:border-slate-800 dark:bg-slate-900/60 dark:focus-visible:ring-white"
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
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white",
                  onlyThisBrand === opt.value
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-[240px] px-4 py-3">
        {loading ? (
          <div className="flex h-full min-h-[200px] items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading campaigns…
          </div>
        ) : error ? (
          <div className="m-2 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              {error}{" "}
              <button type="button" className="font-semibold underline" onClick={() => void load(0)}>
                Try again
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center px-6 text-center text-slate-500 dark:text-slate-400">
            <Copy className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="mt-3 text-sm font-medium">
              {debounced
                ? "No campaigns match your search."
                : isAdmin
                  ? "No campaigns yet."
                  : "You haven't created any campaigns yet."}
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5" aria-label="Campaigns">
            {items.map((card) => (
              <li key={card.id}>
                <button
                  type="button"
                  onClick={() => onPick(card)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-transparent p-2.5 text-left transition-colors hover:border-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:hover:border-slate-800 dark:hover:bg-slate-900/60 sm:p-3"
                >
                  <SourceThumb url={card.thumbnail_url} className="h-12 w-12 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {card.title || "Untitled campaign"}
                    </p>
                    <SourceMeta card={card} showBrand={isAdmin} />
                  </div>
                </button>
              </li>
            ))}
            {hasMore && (
              <li className="pt-2">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void load(items.length)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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
    <div className="space-y-3">
      {/* What to copy count and Select all / Clear all */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          What to copy{" "}
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            ({selectedCount} of {usableCount} selected)
          </span>
        </p>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setSelection(allSelection(preview))}
            className="text-slate-600 hover:text-black dark:text-slate-300 dark:hover:text-white disabled:opacity-40 transition-colors"
          >
            Select all
          </button>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              setSelection({ sections: new Set(), savedListIds: new Set(), includeManual: false })
            }
            className="text-slate-600 hover:text-black dark:text-slate-300 dark:hover:text-white disabled:opacity-40 transition-colors"
          >
            Clear all
          </button>
        </div>
      </div>

      {/* Sections list */}
      <div className="space-y-3">
        {DUPLICATE_SECTION_GROUPS.map((group) => {
          const usable = group.sections.filter((k) => available.has(k));
          if (usable.length === 0) return null;
          const onCount = usable.filter((k) => isOn(k)).length;
          const allOn = onCount === usable.length;

          return (
            <div key={group.key} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {group.label}
                </span>
                {usable.length > 1 && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      const next = new Set(selection.sections);
                      for (const k of usable) {
                        if (allOn) next.delete(k);
                        else next.add(k);
                      }
                      const patch: Partial<Selection> = {};
                      if (usable.includes("invites")) {
                        patch.savedListIds = !allOn ? new Set(preview.savedLists.map((l) => l.id)) : new Set();
                        patch.includeManual = !allOn && preview.manualInviteCount > 0;
                      }
                      update(next, patch);
                    }}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                  >
                    {allOn ? "Deselect group" : "Select group"}
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {group.sections.map((k) => {
                  const reason = reasonFor(k);
                  const isChecked = isOn(k);
                  const label = DISPLAY_SECTION_LABELS[k] || DUPLICATE_SECTION_LABELS[k];
                  const hint = DUPLICATE_SECTION_HINTS[k] || SECTION_HINT_FALLBACKS[k];

                  return (
                    <div
                      key={k}
                      className={cn(
                        "rounded-2xl border transition-all select-none",
                        reason
                          ? "border-slate-200/60 bg-slate-50/50 dark:border-slate-800/60 dark:bg-slate-900/20 opacity-60"
                          : "border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs",
                      )}
                    >
                      <div
                        onClick={() => {
                          if (!reason && !disabled) {
                            toggle(k, !isChecked);
                          }
                        }}
                        className={cn(
                          "flex items-center justify-between gap-3 px-3.5 py-2.5",
                          !reason && !disabled && "cursor-pointer",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {label}
                            {k === "questions" && preview.questionCount > 0 && (
                              <span className="ml-1 text-xs font-normal text-slate-400">
                                ({preview.questionCount})
                              </span>
                            )}
                          </p>
                          {reason ? (
                            <p className="mt-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                              {reason}
                            </p>
                          ) : hint ? (
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-snug">
                              {hint}
                            </p>
                          ) : null}
                        </div>

                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                          <DuplicateToggle
                            checked={isChecked}
                            disabled={!!reason || disabled}
                            onCheckedChange={(on) => toggle(k, on)}
                            ariaLabel={`Toggle ${label}`}
                          />
                        </div>
                      </div>

                      {/* Nested sub-options for invites without removing any functionality */}
                      {k === "invites" && !reason && isChecked && (
                        <div className="space-y-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/50 p-2.5 dark:border-slate-800/80 dark:bg-slate-900/40">
                          {preview.savedLists.map((list) => {
                            const listId = `duplicate-list-${list.id}`;
                            const isListOn = selection.savedListIds.has(list.id);
                            return (
                              <div
                                key={list.id}
                                onClick={() => !disabled && toggleList(list.id, !isListOn)}
                                className="flex cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-slate-200/60 bg-white p-2 shadow-2xs dark:border-slate-800 dark:bg-slate-900"
                              >
                                <label htmlFor={listId} className="pointer-events-none text-xs text-slate-700 dark:text-slate-300">
                                  Saved list: <span className="font-semibold text-slate-900 dark:text-white">{list.name}</span>{" "}
                                  <span className="text-slate-400">
                                    ({list.creator_count} creator{list.creator_count === 1 ? "" : "s"})
                                  </span>
                                </label>
                                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <DuplicateToggle
                                    checked={isListOn}
                                    disabled={disabled}
                                    onCheckedChange={(on) => toggleList(list.id, on)}
                                    ariaLabel={`Include saved list ${list.name}`}
                                  />
                                </div>
                              </div>
                            );
                          })}
                          {preview.manualInviteCount > 0 && (
                            <div
                              onClick={() => !disabled && toggleManual(!selection.includeManual)}
                              className="flex cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-slate-200/60 bg-white p-2 shadow-2xs dark:border-slate-800 dark:bg-slate-900"
                            >
                              <label htmlFor="duplicate-manual-invites" className="pointer-events-none text-xs text-slate-700 dark:text-slate-300">
                                <span className="font-semibold text-slate-900 dark:text-white">{preview.manualInviteCount}</span> creator
                                {preview.manualInviteCount === 1 ? "" : "s"} added individually
                              </label>
                              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                <DuplicateToggle
                                  checked={selection.includeManual}
                                  disabled={disabled}
                                  onCheckedChange={toggleManual}
                                  ariaLabel="Include individually added creators"
                                />
                              </div>
                            </div>
                          )}
                          {preview.crossBrand && preview.savedLists.length > 0 && (
                            <p className="flex items-start gap-1.5 pt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              Saved lists stay with {preview.source.brand_name || "the original brand"}. Their
                              creators will be invited directly on the new campaign.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* New campaign name placed at bottom as shown in the screenshot */}
      <div className="space-y-1.5 pt-1">
        <label htmlFor="duplicate-title" className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
          New campaign name
        </label>
        <div
          className={cn(
            "relative flex w-full items-center rounded-2xl border-2 px-3.5 py-2.5 bg-white shadow-2xs transition-all dark:bg-slate-950",
            titleOn
              ? "border-black dark:border-white focus-within:ring-2 focus-within:ring-black/10 dark:focus-within:ring-white/10"
              : "border-slate-200 dark:border-slate-800 opacity-60",
          )}
        >
          <input
            id="duplicate-title"
            type="text"
            value={titleOn ? title : ""}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={DUPLICATE_TITLE_MAX_LENGTH}
            disabled={!titleOn || disabled}
            placeholder={titleOn ? "Campaign name" : "Untitled campaign (title isn't copied)"}
            className="w-full bg-transparent pr-16 text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
          />
          {titleOn && (
            <span className="pointer-events-none absolute right-3.5 text-xs font-normal text-slate-400 dark:text-slate-500">
              {title.length}/{DUPLICATE_TITLE_MAX_LENGTH}
            </span>
          )}
        </div>
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
          "flex max-h-[92vh] w-[calc(100vw-24px)] max-w-xl flex-col gap-0 overflow-y-auto rounded-[24px] sm:rounded-[28px] border border-slate-200/80 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-[#121212] sm:max-h-[88vh]",
          isDark && "dark text-white",
        )}
      >
        <DialogHeader className="space-y-2 p-4 pb-2 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 pr-8">
              {canGoBack && (
                <button
                  type="button"
                  onClick={backToPicker}
                  className="-ml-1 rounded-xl p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  aria-label="Pick a different campaign"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-slate-100">
                <Copy className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {showPicker ? "Copy an existing campaign" : "Choose what to copy"}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-xs sm:text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {showPicker
                    ? isAdmin
                      ? "Pick the campaign to start from. You'll choose what to copy next."
                      : "Pick one of your campaigns to start from. You'll choose what to copy next."
                    : preview?.source?.title
                      ? `Starting from “${preview.source.title}”. Switch off anything you want to set up fresh.`
                      : "The copy is a new draft. You'll review every step before submitting."}
                </DialogDescription>
              </div>
            </div>
          </div>
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
            <div className="px-4 py-2">
              {loadingPreview ? (
                <div className="flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading campaign…
                </div>
              ) : previewError ? (
                <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {previewError}
                </div>
              ) : preview ? (
                <div className="space-y-3">
                  {/* Source campaign badge & change button */}
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-900/40">
                    <SourceThumb url={preview.source.thumbnail_url} className="h-11 w-11 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {preview.source.title || "Untitled campaign"}
                      </p>
                      <SourceMeta card={preview.source} showBrand={isAdmin} />
                    </div>
                    {canGoBack && (
                      <button
                        type="button"
                        onClick={backToPicker}
                        className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        Change
                      </button>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/40 p-2.5 dark:border-slate-800 dark:bg-slate-900/30">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-slate-600 dark:text-slate-300">
                          Copy for{" "}
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {preview.target.brand_name || "this brand"}
                          </span>
                        </span>
                        {allowChangeTarget && !changingTarget && (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => setChangingTarget(true)}
                            className="text-xs font-semibold text-slate-800 hover:underline dark:text-slate-200"
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
                          className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs sm:text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
                        >
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                          {w.message}
                        </li>
                      ))}
                      {datesWillShift && (
                        <li className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs sm:text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
                          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
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

            <div className="border-t border-slate-100 p-4 dark:border-slate-800">
              {submitError && (
                <p className="mb-2 flex items-start gap-2 text-xs sm:text-sm text-red-600 dark:text-red-400" role="alert">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {submitError}
                </p>
              )}
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    if (canGoBack) backToPicker();
                    else onOpenChange(false);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-900 shadow-2xs transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700/80"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!preview || submitting || loadingPreview}
                  onClick={() => void handleCreate()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-slate-100"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating duplicate…
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Create duplicate
                    </>
                  )}
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
                Payment, approval and results are never copied.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
