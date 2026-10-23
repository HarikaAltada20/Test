"use client";

import { useRef, type CSSProperties, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Coins,
  Layers,
  Lock,
  Medal,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";

export type RewardModel = "cpm" | "leaderboard" | "milestone" | "dual_rewards";

const MODELS: {
  id: RewardModel;
  title: string;
  subtitle: string;
  detail: string;
  /** Space-separated RGB channels for `rgb(var(--hue) / …)` art fills */
  hue: string;
  icon: LucideIcon;
  paidOnly?: boolean;
}[] = [
  {
    id: "cpm",
    title: "CPM",
    subtitle: "Pay per 1,000 views",
    detail:
      "Creators are paid for the views their content gets, at a CPM rate you set, with an optional minimum and maximum.",
    hue: "59 130 246",
    icon: Coins,
    paidOnly: true,
  },
  {
    id: "leaderboard",
    title: "Leaderboard",
    subtitle: "Top creators share a prize pool",
    detail:
      "Creators compete for top spots based on performance. Prizes are awarded to winners.",
    hue: "217 119 6",
    icon: Trophy,
  },
  {
    id: "milestone",
    title: "Milestone",
    subtitle: "Pay as posts reach view milestones",
    detail:
      "Creators are paid as their posts reach the view milestones you set.",
    hue: "22 163 74",
    icon: Medal,
    paidOnly: true,
  },
  {
    id: "dual_rewards",
    title: "Dual Rewards",
    subtitle: "Per-view pay plus a milestone reward",
    detail:
      "Creators earn for views and again when a post hits a milestone.",
    hue: "124 58 237",
    icon: Layers,
    paidOnly: true,
  },
];

export function CampaignRewardPicker({
  value,
  paidTypesLocked,
  onChange,
  onContinue,
  onCancel,
}: {
  value: RewardModel;
  paidTypesLocked: boolean;
  onChange: (value: RewardModel) => void;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const isDark = useDashboardDark();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const selected = MODELS.find((model) => model.id === value) ?? MODELS[0];
  const locked = Boolean(selected.paidOnly && paidTypesLocked);
  const lockedModels = MODELS.filter(
    (model) => model.paidOnly && paidTypesLocked,
  );
  const inkRgb = isDark ? "255 255 255" : "26 26 26";
  const cardSurface = isDark ? "#180438" : "#ffffff";
  const textOnFill = isDark ? "#180438" : "#ffffff";
  const controlFill = isDark ? "#2a1050" : "#f4f4f5";

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const open = MODELS.filter(
      (model) => !(model.paidOnly && paidTypesLocked),
    );
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step || !open.length) return;
    e.preventDefault();
    const i = open.findIndex((model) => model.id === value);
    const next = open[(i + step + open.length) % open.length];
    onChange(next.id);
    refs.current[next.id]?.focus();
  };

  const lockedLabel = lockedModels
    .map((model) => model.title)
    .join(", ")
    .replace(/, ([^,]*)$/, " and $1");

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={onCancel}
        className={cn(
          "mb-10 inline-flex items-center gap-2 text-sm font-medium",
          isDark ? "text-gray-300" : "text-[#3a3a40]",
        )}
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        Campaigns
      </button>

      <div className="mx-auto max-w-[720px] text-center">
        <h1
          className={cn(
            "text-[32px] font-semibold tracking-tight",
            isDark ? "text-white" : "text-[#1a1a1a]",
          )}
        >
          How will you reward creators?
        </h1>
        <p
          className={cn(
            "mt-2 text-[15px] leading-relaxed",
            isDark ? "text-gray-400" : "text-[#6d6d75]",
          )}
        >
          Pick a reward model to start. You can still change it while you build
          the campaign.
        </p>
      </div>

      <div
        className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4"
        role="radiogroup"
        aria-label="Reward model"
        onKeyDown={onKeyDown}
      >
        {MODELS.map((model) => {
          const active = value === model.id;
          const disabled = Boolean(model.paidOnly && paidTypesLocked);
          const Icon = model.icon;
          return (
            <button
              key={model.id}
              ref={(el) => {
                refs.current[model.id] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${model.title}: ${model.subtitle}${disabled ? " (needs a paid plan)" : ""}`}
              aria-describedby={`model-${model.id}-detail`}
              tabIndex={active ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(model.id)}
              onDoubleClick={() => !disabled && onContinue()}
              style={
                {
                  "--hue": model.hue,
                  "--ink-rgb": inkRgb,
                  "--goc-card": cardSurface,
                  "--goc-text-on-fill": textOnFill,
                  "--goc-control": controlFill,
                  "--fg": isDark ? "#ffffff" : "#1a1a1a",
                } as CSSProperties
              }
              className={cn(
                "group relative flex min-h-[280px] flex-col overflow-hidden rounded-[20px] border p-4 text-left transition-[border-color,box-shadow]",
                isDark ? "bg-[#180438]" : "bg-white",
                isDark
                  ? "shadow-[0_10px_28px_rgb(0_0_0_/_0.28)]"
                  : "shadow-[0_10px_28px_rgb(26_26_26_/_0.06)]",
                active
                  ? isDark
                    ? "border-white shadow-[0_0_0_1px_#fff,0_10px_28px_rgb(0_0_0_/_0.28)]"
                    : "border-[#1a1a1a] shadow-[0_0_0_1px_#1a1a1a,0_10px_28px_rgb(26_26_26_/_0.08)]"
                  : isDark
                    ? "border-white/10"
                    : "border-[#e8e8ec]",
                disabled && "cursor-not-allowed opacity-55",
              )}
            >
              {/* Soft hue shade — always on, matches reference cards */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_12%_0%,rgb(var(--hue)_/_0.2),transparent_58%)]"
              />

              <span className="relative z-[1] flex items-start justify-between gap-2">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[rgb(var(--hue)_/_0.14)] text-[rgb(var(--hue))]"
                  aria-hidden="true"
                >
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                {disabled ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium",
                      isDark
                        ? "bg-white/10 text-gray-300"
                        : "bg-[#f4f4f5] text-[#6d6d75]",
                    )}
                  >
                    <Lock size={11} strokeWidth={2} aria-hidden="true" />
                    Paid plans
                  </span>
                ) : (
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border",
                      active
                        ? isDark
                          ? "border-white bg-white text-[#1a1a1a]"
                          : "border-[#1a1a1a] bg-[#1a1a1a] text-white"
                        : isDark
                          ? "border-white/30 bg-transparent"
                          : "border-[#d4d4d8] bg-white",
                    )}
                    aria-hidden="true"
                  >
                    {active && <Check size={11} strokeWidth={3} />}
                  </span>
                )}
              </span>

              <span
                className={cn(
                  "relative z-[1] mt-4 text-lg font-semibold tracking-tight",
                  isDark ? "text-white" : "text-[#1a1a1a]",
                )}
              >
                {model.title}
              </span>
              <span
                className={cn(
                  "relative z-[1] mt-1 text-sm leading-snug",
                  isDark ? "text-gray-400" : "text-[#6d6d75]",
                )}
              >
                {model.subtitle}
              </span>

              <span
                className="relative z-[1] mt-auto -mx-4 -mb-4 pt-5 text-[rgb(var(--hue))]"
                aria-hidden="true"
              >
                <ModelArt type={model.id} />
              </span>

              <span id={`model-${model.id}-detail`} className="sr-only">
                {model.detail}
              </span>
            </button>
          );
        })}
      </div>

      <p
        className={cn(
          "mx-auto mt-6 max-w-[760px] text-center text-sm",
          isDark ? "text-gray-300" : "text-[#3a3a40]",
        )}
        aria-live="polite"
      >
        <strong>{selected.title}.</strong> {selected.detail}
      </p>

      {lockedModels.length > 0 && (
        <p
          className={cn(
            "mx-auto mt-3 flex max-w-[760px] flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm",
            isDark ? "text-gray-400" : "text-[#6d6d75]",
          )}
        >
          <Lock size={13} strokeWidth={1.75} aria-hidden="true" />
          <span>{lockedLabel} need a paid plan.</span>
          <Link
            href="/dashboard/billing?tab=subscription"
            className={cn(
              "font-medium underline underline-offset-2",
              isDark ? "text-white" : "text-[#1a1a1a]",
            )}
          >
            See plans
          </Link>
        </p>
      )}

      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            "rounded-full border px-5 py-2 text-sm font-medium",
            isDark
              ? "border-white/20 bg-transparent text-white"
              : "border-[#dedee3] bg-white text-[#1a1a1a]",
          )}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={onContinue}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium disabled:opacity-50",
            isDark ? "bg-white text-[#1a1a1a]" : "bg-[#1a1a1a] text-white",
          )}
        >
          Continue with {selected.title}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Small picture of each reward model in its own hue — chart, ranks, milestone
 * track — so the choice reads at a glance.
 */
function ModelArt({ type }: { type: RewardModel }) {
  return (
    <svg
      className="block h-auto w-full"
      viewBox="0 0 280 132"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`art-fill-${type}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {type === "cpm" && <Cpm />}
      {type === "leaderboard" && <Leaderboard />}
      {type === "milestone" && <Milestone />}
      {type === "dual_rewards" && <Dual />}
    </svg>
  );
}

const panel = {
  fill: "rgb(var(--ink-rgb) / 0.035)",
  stroke: "rgb(var(--ink-rgb) / 0.09)",
};

/** Rounded top, square bottom past the fold so the panel reads as continuing. */
function Panel() {
  return (
    <path
      d="M12 140 V22 A12 12 0 0 1 24 10 H256 A12 12 0 0 1 268 22 V140 Z"
      {...panel}
    />
  );
}

const quiet = "rgb(var(--ink-rgb) / 0.5)";
const faint = "rgb(var(--ink-rgb) / 0.12)";
const artLabel = { fontSize: 11, fontWeight: 500 } as const;
const artValue = { fontSize: 22, fontWeight: 650 } as const;
const artChip = { fontSize: 11, fontWeight: 600 } as const;

function Cpm() {
  const line =
    "M24,108 C50,104 62,98 84,100 C108,102 116,86 140,82 C164,78 176,88 198,72 C216,60 236,62 256,54";
  return (
    <g>
      <Panel />
      <text x="26" y="32" style={artLabel} fill={quiet}>
        Views
      </text>
      <text x="26" y="54" style={artValue} fill="var(--fg)">
        1.2M
      </text>
      <path d={`${line} L256,140 L24,140 Z`} fill="url(#art-fill-cpm)" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx="198"
        cy="72"
        r="4"
        fill="currentColor"
        stroke="var(--goc-card)"
        strokeWidth="2"
      />
      <g transform="translate(150 18)">
        <rect
          width="106"
          height="26"
          rx="13"
          fill="rgb(var(--hue) / 0.16)"
          stroke="rgb(var(--hue) / 0.4)"
        />
        <text
          x="53"
          y="17"
          textAnchor="middle"
          style={artChip}
          fill="var(--fg)"
        >
          $2.00 / 1K views
        </text>
      </g>
    </g>
  );
}

function Leaderboard() {
  const rows = [
    { y: 20, w: 130, rank: "1", lead: true },
    { y: 56, w: 96, rank: "2" },
    { y: 92, w: 68, rank: "3" },
  ];
  return (
    <g>
      <Panel />
      {rows.map((r) => (
        <g key={r.rank} transform={`translate(22 ${r.y})`}>
          <rect
            width="236"
            height="30"
            rx="8"
            fill={r.lead ? "rgb(var(--hue) / 0.1)" : panel.fill}
            stroke={r.lead ? "rgb(var(--hue) / 0.42)" : panel.stroke}
          />
          <text
            x="14"
            y="19.5"
            style={artLabel}
            fill={r.lead ? "currentColor" : quiet}
          >
            {r.rank}
          </text>
          <circle
            cx="40"
            cy="15"
            r="8"
            fill={r.lead ? "currentColor" : faint}
            opacity={r.lead ? 0.85 : 1}
          />
          <rect
            x="56"
            y="11"
            width={r.w}
            height="8"
            rx="4"
            fill={r.lead ? "rgb(var(--ink-rgb) / 0.5)" : faint}
          />
          {r.lead && (
            <g transform="translate(204 5)">
              <path
                d="M4 2h12v5a6 6 0 0 1-12 0z M10 13v4 M6 19h8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )}
        </g>
      ))}
    </g>
  );
}

function Milestone() {
  const stops = [
    { x: 40, label: "100K", done: true },
    { x: 140, label: "500K", done: true },
    { x: 240, label: "1M", done: false },
  ];
  return (
    <g>
      <Panel />
      <line
        x1="40"
        y1="78"
        x2="240"
        y2="78"
        stroke={faint}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <line
        x1="40"
        y1="78"
        x2="182"
        y2="78"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {stops.map((s) => (
        <g key={s.label} transform={`translate(${s.x} 78)`}>
          <circle
            r="11"
            fill={s.done ? "currentColor" : "var(--goc-control)"}
            stroke={
              s.done ? "var(--goc-card)" : "rgb(var(--ink-rgb) / 0.25)"
            }
            strokeWidth="2"
          />
          {s.done && (
            <path
              d="M-4.5 0.5 L-1.2 3.6 L4.6 -3"
              fill="none"
              stroke="var(--goc-text-on-fill)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          <text
            y="34"
            textAnchor="middle"
            style={artLabel}
            fill={s.done ? "var(--fg)" : quiet}
          >
            {s.label}
          </text>
        </g>
      ))}
      <g transform="translate(110 22)">
        <rect
          width="60"
          height="24"
          rx="12"
          fill="rgb(var(--hue) / 0.16)"
          stroke="rgb(var(--hue) / 0.4)"
        />
        <text
          x="30"
          y="16"
          textAnchor="middle"
          style={artChip}
          fill="var(--fg)"
        >
          Paid
        </text>
      </g>
    </g>
  );
}

function Dual() {
  const line =
    "M24,112 C56,108 70,96 96,96 C120,96 132,80 152,76 C172,72 184,84 204,70";
  return (
    <g>
      <Panel />
      <path
        d={`${line} L204,140 L24,140 Z`}
        fill="url(#art-fill-dual_rewards)"
      />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="204"
        y1="70"
        x2="204"
        y2="36"
        stroke="rgb(var(--ink-rgb) / 0.3)"
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />
      <g transform="translate(204 20)">
        <path
          d="M0 0 V22 M0 2 H20 L15 8 L20 14 H0"
          fill="rgb(var(--hue) / 0.25)"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </g>
      <g transform="translate(26 20)">
        <rect
          width="72"
          height="24"
          rx="12"
          fill="rgb(var(--hue) / 0.16)"
          stroke="rgb(var(--hue) / 0.4)"
        />
        <text
          x="36"
          y="16"
          textAnchor="middle"
          style={artChip}
          fill="var(--fg)"
        >
          Per view
        </text>
      </g>
      <g transform="translate(106 20)">
        <rect width="18" height="24" rx="9" fill="none" />
        <text
          x="9"
          y="17"
          textAnchor="middle"
          style={artChip}
          fill={quiet}
        >
          +
        </text>
      </g>
      <g transform="translate(130 20)">
        <rect
          width="62"
          height="24"
          rx="12"
          fill="rgb(var(--ink-rgb) / 0.05)"
          stroke="rgb(var(--ink-rgb) / 0.14)"
        />
        <text
          x="31"
          y="16"
          textAnchor="middle"
          style={artChip}
          fill="var(--fg)"
        >
          Milestone
        </text>
      </g>
    </g>
  );
}
