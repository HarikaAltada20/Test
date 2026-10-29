import { cn } from "@/lib/utils";

/**
 * Figma "Contest Details Redesign" neutral visual tokens for the brand
 * Submissions tab. Class strings only — no behavior.
 */
export function getBrandSubmissionsStyles(isDark: boolean) {
  const card = cn(
    "rounded-2xl border shadow-[0px_1px_3px_0px_rgba(10,10,10,0.04)]",
    isDark ? "bg-[#111113] border-white/10" : "bg-white border-[#e5e5e5]",
  );

  /** Stat tile (Expected reward etc.) */
  const statTile = cn(
    "rounded-2xl border px-5 py-4 shadow-[0px_1px_3px_0px_rgba(10,10,10,0.04)]",
    isDark ? "bg-[#111113] border-white/10" : "bg-white border-[#e5e5e5]",
  );
  const statLabel = cn(
    "text-[11px] font-medium uppercase tracking-wide",
    isDark ? "text-slate-400" : "text-[#737373]",
  );
  // Figma shows all tile values in the primary text color (no green accent).
  const statValue = (_green?: boolean) =>
    cn(
      "mt-1 text-[22px] leading-7 font-bold",
      isDark ? "text-white" : "text-[#0a0a0a]",
    );

  /** Segmented pill group for status filters */
  const pillList = cn(
    "flex flex-wrap items-center gap-1 w-full h-auto rounded-xl p-1 border-0 shadow-none",
    isDark ? "bg-white/5" : "bg-[#f5f5f5]",
  );
  const pill = cn(
    "group flex-1 gap-1.5 items-center px-3 py-1.5 h-9 rounded-lg border-0 shadow-none whitespace-nowrap disabled:opacity-100",
    "text-[13px] font-medium",
    "hover:scale-100 active:scale-100 hover:bg-transparent",
    "data-[state=active]:scale-100 data-[state=active]:shadow-none data-[state=active]:ring-0 data-[state=active]:border-0 data-[state=active]:font-medium",
    isDark
      ? "text-slate-300 hover:text-white data-[state=active]:bg-white data-[state=active]:text-[#0a0a0a]"
      : "text-[#404040] hover:text-[#0a0a0a] data-[state=active]:bg-[#0a0a0a] data-[state=active]:text-white",
  );
  const pillCount = cn(
    "inline-flex items-center gap-1 px-0 py-0 h-auto rounded-none border-0 bg-transparent shadow-none text-[13px] font-normal tabular-nums hover:bg-transparent",
    isDark
      ? "text-slate-400 group-data-[state=active]:text-[#0a0a0a]/60"
      : "text-[#737373] group-data-[state=active]:text-white/70",
  );

  /** Inputs / selects / outline buttons */
  const control = cn(
    "h-9 rounded-[10px] border text-[13px] shadow-none disabled:opacity-100",
    isDark
      ? "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
      : "border-[#e5e5e5] bg-white text-[#0a0a0a] hover:bg-[#fafafa]",
  );
  const outlineBtn = cn(control, "gap-2 px-3 font-medium");
  const primaryBtn = cn(
    "h-9 gap-2 rounded-[10px] px-3 text-[13px] font-medium shadow-none border-0 disabled:opacity-60",
    isDark
      ? "bg-white text-[#0a0a0a] hover:bg-slate-200"
      : "bg-[#0a0a0a] text-white hover:bg-[#262626]",
  );
  const dangerOutlineBtn = cn(
    "rounded-[10px] border text-[13px] font-medium shadow-none",
    isDark
      ? "border-white/10 bg-transparent text-red-400 hover:bg-red-500/10"
      : "border-[#e5e5e5] bg-white text-[#dc2626] hover:bg-[#fef2f2]",
  );
  const smOutlineBtn = cn(
    "rounded-[10px] border text-[13px] font-medium shadow-none",
    isDark
      ? "border-white/10 bg-transparent text-slate-100 hover:bg-white/10"
      : "border-[#e5e5e5] bg-white text-[#0a0a0a] hover:bg-[#fafafa]",
  );
  const smPrimaryBtn = cn(
    "rounded-[10px] border-0 text-[13px] font-medium shadow-none",
    isDark
      ? "bg-white text-[#0a0a0a] hover:bg-slate-200"
      : "bg-[#0a0a0a] text-white hover:bg-[#262626]",
  );

  /** Bulk selection bar */
  const bulkBar = cn(
    "rounded-2xl border p-3 mb-3",
    isDark ? "bg-white/5 border-white/10" : "bg-[#fafafa] border-[#e5e5e5]",
  );
  const bulkText = cn(
    "text-[13px] font-medium",
    isDark ? "text-slate-100" : "text-[#0a0a0a]",
  );

  /** Table */
  const tableWrap = cn(
    "overflow-hidden rounded-2xl border shadow-[0px_1px_3px_0px_rgba(10,10,10,0.04)]",
    isDark ? "bg-[#111113] border-white/10" : "bg-white border-[#e5e5e5]",
  );
  const th = cn(
    "text-sm font-semibold",
    isDark ? "text-slate-200" : "text-[#1a1a1a]",
  );
  /** Applied to the scroll wrapper of <Table> — gives the table its own rounded bordered card. */
  const tableScroll = cn(
    "rounded-2xl border shadow-[0px_1px_3px_0px_rgba(10,10,10,0.04)]",
    isDark ? "bg-[#111113] border-white/10" : "bg-white border-[#e5e5e5]",
  );
  /** Header <TableRow>: restyles every <th> via descendant selectors (cells keep their own alignment classes). */
  const headRow = cn(
    "border-b hover:bg-transparent",
    isDark
      ? "bg-white/5 border-white/10 hover:bg-white/5 [&_th]:text-slate-200"
      : "bg-[#fafafa] border-[#e5e5e5] hover:bg-[#fafafa] [&_th]:text-[#1a1a1a]",
    "[&_th]:h-12 [&_th]:px-4 [&_th]:text-sm [&_th]:font-semibold [&_th]:whitespace-nowrap",
  );
  /** Body <TableRow> look (no rank-tint / purple accents). */
  const bodyRow = cn(
    "border-b transition-colors text-[13px] [&>td]:px-4 [&>td]:py-3",
    isDark
      ? "border-white/10 hover:bg-white/5"
      : "border-[#f5f5f5] bg-white hover:bg-[#fafafa]",
  );
  /** Pagination footer wrapper: restyles shared <PaginationControls> buttons via descendant selectors. */
  const pagination = cn(
    "[&_button]:rounded-[10px] [&_button]:text-[13px] [&_button]:font-medium [&_button]:shadow-none",
    isDark
      ? ""
      : "[&_button]:border-[#e5e5e5] [&_button:not(.bg-primary)]:bg-white [&_button:not(.bg-primary)]:text-[#0a0a0a] [&_button.bg-primary]:border-[#0a0a0a] [&_button.bg-primary]:bg-[#0a0a0a] [&_button.bg-primary]:text-white",
  );
  /** Secondary text-link inside a row (e.g. "View Content", "Download"). */
  const rowLink = isDark
    ? "text-slate-300 hover:text-white"
    : "text-[#404040] hover:text-[#0a0a0a]";

  /** Status chips */
  const chip = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border-0";
  const chipOk = isDark
    ? "bg-emerald-500/15 text-emerald-300"
    : "bg-[#ecfdf5] text-[#059669]";
  const chipWarn = isDark
    ? "bg-amber-500/15 text-amber-300"
    : "bg-[#fffbeb] text-[#d97706]";
  const chipNeutral = isDark
    ? "bg-white/10 text-slate-200"
    : "bg-[#f5f5f5] text-[#404040]";
  const chipErr = isDark
    ? "bg-red-500/15 text-red-300"
    : "bg-[#fef2f2] text-[#dc2626]";

  return {
    card,
    statTile,
    statLabel,
    statValue,
    pillList,
    pill,
    pillCount,
    control,
    outlineBtn,
    primaryBtn,
    dangerOutlineBtn,
    smOutlineBtn,
    smPrimaryBtn,
    bulkBar,
    bulkText,
    tableWrap,
    th,
    tableScroll,
    headRow,
    bodyRow,
    pagination,
    rowLink,
    chip,
    chipOk,
    chipWarn,
    chipNeutral,
    chipErr,
  };
}
